/**
 * Processes URLs and appends the data (meta info, tags, headers) to the given sheet.
 * @param {string[]} urlsFromSitemap - Array of URLs to process.
 * @param {Sheet} propertySheet - The sheet to append the data.
 * @param {number} topLevelUrlCount - The count of top-level URLs.
 * @param {string} sitemapUrl - The URL of the sitemap these URLs came from.
 */
function processUrlsToSheet(urlsFromSitemap, propertySheet, topLevelUrlCount, sitemapUrl) {
    // Extract URLs from the array of arrays
    const urls = urlsFromSitemap.map(entry => entry[0]);

    Logger.log(`Input URLs: ${JSON.stringify(urls)}`);
    Logger.log(`Sitemap URL: ${sitemapUrl}`);

    if (!Array.isArray(urls)) {
        Logger.log(`Invalid input: urls is not an array`);
        return;
    }

    const groupedUrls = groupUrlsByLevel(urls, sitemapUrl);
    Logger.log(`Grouped URLs: ${JSON.stringify(groupedUrls)}`);

    // Sort groups by level (ascending order, level 1 being the highest)
    const sortedGroupedUrls = groupedUrls.sort((a, b) => a.level - b.level);

    // Log grouped URLs by level
    sortedGroupedUrls.forEach(group => {
        Logger.log(`Level ${group.level}: ${JSON.stringify(group.urls)}`);
    });

    const currentTime = new Date();

    // Process URLs by level
    sortedGroupedUrls.forEach(group => {
        group.urls.forEach(url => {
            if (!isValidUrl(url)) {
                Logger.log(`Skipping invalid URL: ${url}`);
                return; // Skip invalid URL
            }

            try {
                Logger.log(`Processing URL: ${url} at level ${group.level}`);

                const normalizedUrl = normalizeUrl(url);
                const metaTitle = fetchMetaTitle(normalizedUrl);
                const metaDescription = fetchMetaDescription(normalizedUrl);
                const headerTags = fetchHeaderTags(normalizedUrl);
                const version = `Version ${currentTime.toISOString()}`;
                let likeCount = 'N/A';
                if (group.level === 4) {
                    likeCount = fetchLikeCount(normalizedUrl);
                }

                Logger.log(`Appending data for URL: ${normalizedUrl}`);
                Logger.log(`Meta Title: ${metaTitle}, Meta Description: ${metaDescription}, Header Tags: ${JSON.stringify(headerTags)}, Like Count: ${likeCount}`);

                const targetLikes = calculateTargetLikes(normalizedUrl, group.level);
propertySheet.appendRow([normalizedUrl, metaTitle, metaDescription, JSON.stringify(headerTags), version, currentTime, topLevelUrlCount, group.level, likeCount, targetLikes]);

            } catch (error) {
                Logger.log(`Error processing URL ${url}: ${error.message}`);
            }
        });
    });

    Logger.log(`Finished processing ${groupedUrls.length} URLs and appending to the sheet.`);
}

/**
 * Counts the number of top-level URLs (with only one '/' after the domain).
 * @param {string[]} urls - Array of URLs to count.
 * @returns {number} - The count of top-level URLs.
 */
function countTopLevelUrls(urls) {
    return urls.filter(url => typeof url === 'string' && (url.match(/\//g) || []).length === 3).length;
}
/**
 * Groups URLs by the number of path segments and optional predefined level mappings.
 * Also considers sitemap source and section headers (H1-H6) within the pages.
 * @param {string[]} urls - An array of URLs to group.
 * @param {string} sitemapUrl - The sitemap from which the URLs were fetched.
 * @returns {Object[]} - An array of objects containing URL and level.
 */
function groupUrlsByLevel(urls, sitemapUrl) {
    Logger.log(`Input to groupUrlsByLevel: ${JSON.stringify(urls)}`);
    Logger.log(`Sitemap URL: ${sitemapUrl}`);

    const levelMappings = {
        1: [/^\/$/, /home$/, /about/, /contact/, /services$/, /products$/, /portfolio$/], // Main sections
        2: [/team/, /history/, /services\/[a-z0-9-]+$/, /products\/[a-z0-9-]+$/, /solutions/], // Subpages or subsections
        3: [/blog$/, /news$/, /press-releases$/, /categories$/, /faq$/], // Blog categories, FAQ
        4: [/blog\/[a-z0-9-]+$/, /news\/[a-z0-9-]+$/, /events\/[a-z0-9-]+$/, /products\/details\/[a-z0-9-]+$/], // Blog posts, detailed products, events
        5: [/careers$/, /jobs$/, /contact\/form$/, /support\/help$/], // Job listings, contact forms
        6: [/book-online/, /booking-services/, /events\/register$/, /dynamic-content\/[a-z0-9-]+$/], // Booking or dynamic pages
        7: [/terms-of-service/, /privacy-policy/, /legal/], // Legal and terms pages
        8: [/testimonials/, /reviews/, /case-studies/, /projects\/[a-z0-9-]+$/], // Testimonials, reviews, case studies
        9: [/portfolio\/[a-z0-9-]+$/, /categories\/[a-z0-9-]+$/, /dynamic-categories\/[a-z0-9-]+$/], // Dynamic categories or portfolio items
    };

    const groupedUrls = Object.keys(levelMappings).map(level => ({
        level: parseInt(level, 10),
        urls: []
    }));

    urls.forEach(url => {
        if (!isValidUrl(url)) {
            Logger.log(`Skipping invalid URL: ${url}`);
            return; // Skip invalid URL
        }

        const { pathname } = parseUrl(url);
        const path = pathname.toLowerCase();

        // Match the path with predefined level mappings or use sitemap influence
        let level = Object.keys(levelMappings).find(lvl =>
            levelMappings[lvl].some(pattern => pattern.test(path))
        ) || path.split('/').filter(Boolean).length || 1;

        // Add a check to handle undefined or empty sitemapUrl
        if (sitemapUrl) {
            // Adjust the level based on the sitemap the URL came from
            if (sitemapUrl.includes('blog-posts-sitemap.xml')) {
                level = 4; // Blog posts
            } else if (sitemapUrl.includes('blog-categories-sitemap.xml')) {
                level = 3; // Blog categories
            } else if (sitemapUrl.includes('pages-sitemap.xml')) {
                level = 1; // General pages
            } else if (sitemapUrl.includes('booking-services-sitemap.xml')) {
                level = 6; // Booking-related pages
            } else if (sitemapUrl.includes('portfolio-sitemap.xml')) {
                level = 8; // Portfolio items
            }
        } else {
            Logger.log('Warning: sitemapUrl is undefined or null.');
        }

        groupedUrls.find(group => group.level === parseInt(level)).urls.push(url);
    });

    return groupedUrls.filter(group => group.urls.length > 0); // Filter out any empty groups
}
/**
 * Parses a URL and returns an object with the hostname and pathname using regex.
 * @param {string} url - The URL to parse.
 * @returns {Object} - An object containing hostname and pathname.
 * @throws {Error} - If the URL is invalid.
 */
function parseUrl(url) {
    try {
        // Ensure the URL has a protocol (http or https)
        if (!/^https?:\/\//i.test(url)) {
            url = 'https://' + url;
        }

        // Use a regular expression to extract hostname and pathname
        const urlPattern = /^(https?:\/\/)?([^\/\s]+)(\/.*)?$/;
        const match = url.match(urlPattern);

        if (match) {
            const hostname = match[2]; // Hostname
            const pathname = match[3] || '/'; // Pathname or root '/'
            return { hostname, pathname };
        } else {
            throw new Error('Invalid URL format');
        }
    } catch (error) {
        Logger.log(`Error parsing URL: ${url}, Error Message: ${error.message}`);
        throw new Error(`Invalid URL: ${url}. Error Message: ${error.message}`);
    }
}



/**
 * Extracts URLs and their metadata from a regular sitemap.
 * @param {XmlElement} document - The XML document.
 * @param {Namespace} [namespace] - The XML namespace.
 * @param {string} [filter] - Keyword to filter URLs.
 * @returns {string[][]} - An array of URLs and their metadata.
 */
function extractURLs(document, namespace, filter) {
    const urls = namespace ? document.getChildren('url', namespace) : document.getChildren('url');
    let results = [];

    Logger.log(`Found ${urls.length} <url> entries in the sitemap`);

    urls.forEach(url => {
        try {
            const loc = namespace 
                ? url.getChild('loc', namespace).getText().trim() 
                : url.getChild('loc').getText().trim();
            
            Logger.log(`Processing URL: ${loc}`);

            if (!filter || (filter && loc.includes(filter))) {
                const lastmod = namespace 
                    ? (url.getChild('lastmod', namespace) || {getText: () => ""}).getText().trim() 
                    : (url.getChild('lastmod') || {getText: () => ""}).getText().trim();

                const changefreq = namespace 
                    ? (url.getChild('changefreq', namespace) || {getText: () => ""}).getText().trim() 
                    : (url.getChild('changefreq') || {getText: () => ""}).getText().trim();

                const priority = namespace 
                    ? (url.getChild('priority', namespace) || {getText: () => ""}).getText().trim() 
                    : (url.getChild('priority') || {getText: () => ""}).getText().trim();

                results.push([loc, lastmod, changefreq, priority]);
            }
        } catch (error) {
            Logger.log(`Error extracting URL from sitemap: ${error.message}`);
        }
    });

    Logger.log(`Extracted ${results.length} URLs from the sitemap`);

    return results;
}


/**
 * Counts the number of top-level URLs (with only one '/' after the domain).
 * @param {string[]} urls - Array of URLs to count.
 * @returns {number} - The count of top-level URLs.
 */
function countTopLevelUrls(urls) {
    return urls.filter(url => {
        if (typeof url !== 'string') return false;

        // Ensure the URL has a protocol (http or https)
        if (!/^https?:\/\//i.test(url)) {
            url = 'https://' + url;
        }

        // Use a regular expression to extract the pathname
        const urlPattern = /^(https?:\/\/)?([^\/\s]+)(\/.*)?$/;
        const match = url.match(urlPattern);

        if (match && match[3]) {
            const pathSegments = match[3].split('/').filter(segment => segment.length > 0);
            Logger.log(`URL: ${url}, Path Segments: ${JSON.stringify(pathSegments)}`);
            return pathSegments.length === 1; // e.g., https://domain.com/aboutus
        }

        return false;
    }).length;
}


/**
 * URL Handling Functions: Validates, normalizes, and parses URLs.
 * 
 * File: urlFunctions.gs
 */

/**
 * Validates the format of a URL using a regex pattern.
 * @param {string} url - The URL to validate.
 * @returns {boolean} - Whether the URL is valid.
 */
function isValidUrl(url) {
    if (!url || typeof url !== 'string' || url.trim() === '') {
        return false;
    }
    const urlPattern = /^(https?:\/\/)?([\w\-]+(\.[\w\-]+)+)(\/[\w\-.\/?%&=,]*)?$/i;
    return urlPattern.test(url);
}

/**
 * Normalizes a URL by adding https:// if missing and removing www.
 * @param {string} url - The URL to normalize.
 * @returns {string} - The normalized URL.
 */
function normalizeUrl(url) {
    if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
    }
    return url.replace(/^https?:\/\/www\./i, 'https://');
}

/**
 * Parses a URL and returns its hostname and pathname.
 * @param {string} url - The URL to parse.
 * @returns {Object} - An object with hostname and pathname.
 */
function parseUrl(url) {
    if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
    }
    const urlPattern = /^(https?:\/\/)?([^\/\s]+)(\/.*)?$/;
    const match = url.match(urlPattern);
    if (match) {
        return { hostname: match[2], pathname: match[3] || '/' };
    } else {
        throw new Error('Invalid URL format');
    }
}

/**
 * Retrieves the top-level domain from a URL, removing www if necessary.
 * @param {string} url - The URL to extract the top-level domain from.
 * @returns {string} - The top-level domain.
 */
function getTopLevelDomain(url) {
    // Ensure the URL has a protocol
    if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
    }
    
    // Use a regular expression to extract the hostname
    const hostnameMatch = url.match(/^https?:\/\/(?:www\.)?([^\/]+)/i);
    
    if (hostnameMatch) {
        return hostnameMatch[1];
    } else {
        throw new Error('Invalid URL format');
    }
}




function addNewUrlToSheet(propertySheet, url, currentTime) {
  const normalizedUrl = normalizeUrl(url);
  const metaTitle = fetchMetaTitle(normalizedUrl);
  const metaDescription = fetchMetaDescription(normalizedUrl);
  const headerTags = fetchHeaderTags(normalizedUrl);
  const version = `Version ${currentTime.toISOString()}`;
  const level = determineUrlLevel(normalizedUrl);
  const likeCount = level === 4 ? fetchLikeCount(normalizedUrl) : 'N/A';
  const topLevelUrlCount = countTopLevelUrls(propertySheet.getRange('A:A').getValues().flat());
  const targetLikes = calculateTargetLikes(normalizedUrl, level); // Add this line

  propertySheet.appendRow([
    normalizedUrl,
    metaTitle,
    metaDescription,
    JSON.stringify(headerTags),
    version,
    currentTime,
    topLevelUrlCount,
    level,
    likeCount,
    targetLikes // Add this to the row
  ]);
}
/**
 * Adds a new blog URL to the property sheet and updates like count and target likes.
 * @param {string} url - The new blog URL to add.
 * @param {string} propertyName - The name of the property (sheet name).
 */
function addNewBlogUrl(url, propertyName) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet();
    const sanitizedPropertyName = sanitizeSheetName(propertyName);
    let propertySheet = sheet.getSheetByName(sanitizedPropertyName);
    
    if (!propertySheet) {
        Logger.log(`Property sheet ${sanitizedPropertyName} not found. Creating new sheet.`);
        propertySheet = sheet.insertSheet(sanitizedPropertyName);
        propertySheet.appendRow(['URL', 'Meta Title', 'Meta Description', 'Header Tags', 'Version', 'Timestamp', '#ofUrls', 'Level', 'Like Count', 'Target Likes']);
    }

    if (!isValidUrl(url)) {
        Logger.log(`Invalid URL: ${url}`);
        throw new Error(`Invalid URL: ${url}`);
    }

    const normalizedUrl = normalizeUrl(url);
    const currentTime = new Date();
    const metaTitle = fetchMetaTitle(normalizedUrl);
    const metaDescription = fetchMetaDescription(normalizedUrl);
    const headerTags = fetchHeaderTags(normalizedUrl);
    const version = `Version ${currentTime.toISOString()}`;
    const level = determineUrlLevel(normalizedUrl);
    const likeCount = level === 4 ? fetchLikeCount(normalizedUrl) : 'N/A';
    const targetLikes = calculateTargetLikes(normalizedUrl, level); // Add this line

    // Append the new row
    propertySheet.appendRow([
        normalizedUrl,
        metaTitle,
        metaDescription,
        JSON.stringify(headerTags),
        version,
        currentTime,
        '', // #ofUrls will be updated separately
        level,
        likeCount,
        targetLikes
    ]);

    // Update #ofUrls for all rows
    updateTopLevelUrlCount(propertySheet);

    // Add this line to update target likes
    updateTargetLikes(propertySheet);

    Logger.log(`Added new blog URL: ${normalizedUrl} to sheet ${sanitizedPropertyName}`);
}

/**
 * Determines the level of a URL based on its path.
 * @param {string} url - The URL to analyze.
 * @returns {number} - The determined level.
 */
function determineUrlLevel(url) {
    const { pathname } = parseUrl(url);
    const path = pathname.toLowerCase();

    const levelMappings = {
        1: [/^\/$/, /home$/, /about/, /contact/, /services$/, /products$/, /portfolio$/],
        2: [/team/, /history/, /services\/[a-z0-9-]+$/, /products\/[a-z0-9-]+$/, /solutions/],
        3: [/blog$/, /news$/, /press-releases$/, /categories$/, /faq$/],
        4: [/blog\/[a-z0-9-]+$/, /news\/[a-z0-9-]+$/, /events\/[a-z0-9-]+$/, /products\/details\/[a-z0-9-]+$/]
    };

    for (let level in levelMappings) {
        if (levelMappings[level].some(pattern => pattern.test(path))) {
            return parseInt(level);
        }
    }

    return path.split('/').filter(Boolean).length || 1;
}

/**
 * Updates the #ofUrls count for all rows in the sheet.
 * @param {Sheet} sheet - The sheet to update.
 */
function updateTopLevelUrlCount(sheet) {
    const data = sheet.getDataRange().getValues();
    const urls = data.slice(1).map(row => row[0]); // Assuming URL is in the first column
    const topLevelUrlCount = countTopLevelUrls(urls);

    // Update #ofUrls for all rows
    for (let i = 2; i <= sheet.getLastRow(); i++) {
        sheet.getRange(i, 7).setValue(topLevelUrlCount); // Assuming #ofUrls is in the 7th column
    }
}

function retryFailedUrls(failedUrls, propertySheet, topLevelUrlCount, sitemapUrl, maxRetries = 3) {
    let retryCount = 0;
    while (failedUrls.length > 0 && retryCount < maxRetries) {
        Logger.log(`Retry attempt ${retryCount + 1} for ${failedUrls.length} failed URLs`);
        const urlsToRetry = failedUrls.map(failed => failed.url);
        failedUrls = processUrlsToSheet(urlsToRetry, propertySheet, topLevelUrlCount, sitemapUrl);
        retryCount++;
    }
    
    if (failedUrls.length > 0) {
        Logger.log(`${failedUrls.length} URLs still failed after ${maxRetries} retries`);
    }
}

function discoverUrls(baseUrl, maxDepth = 2) {
    const discoveredUrls = new Set();
    const urlsToVisit = [baseUrl];
    let currentDepth = 0;

    while (urlsToVisit.length > 0 && currentDepth < maxDepth) {
        const currentUrl = urlsToVisit.shift();
        if (discoveredUrls.has(currentUrl)) continue;

        try {
            const response = UrlFetchApp.fetch(currentUrl);
            const htmlContent = response.getContentText();
            discoveredUrls.add(currentUrl);

            // Extract links from the page
            const linkRegex = /<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>/g;
            let match;
            while ((match = linkRegex.exec(htmlContent)) !== null) {
                const link = new URL(match[1], baseUrl).href;
                if (link.startsWith(baseUrl) && !discoveredUrls.has(link)) {
                    urlsToVisit.push(link);
                }
            }
        } catch (error) {
            Logger.log(`Error crawling ${currentUrl}: ${error.message}`);
        }

        if (urlsToVisit.length === 0) {
            currentDepth++;
            urlsToVisit.push(...Array.from(discoveredUrls));
        }
    }

    return Array.from(discoveredUrls);
}