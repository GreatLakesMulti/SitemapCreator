/**
 * Sitemap Processing Functions: Fetches and processes URLs from sitemaps.
 * 
 * File: sitemapFunctions.gs
 */

/**
 * Fetches URLs from a sitemap XML file with improved error handling and retry mechanism.
 * @param {string} sitemapUrl - The URL of the sitemap to fetch.
 * @param {number} maxRetries - Maximum number of retry attempts (default: 3).
 * @returns {string[]} - An array of valid URLs from the sitemap.
 */
function fetchSitemapUrls(sitemapUrl, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = UrlFetchApp.fetch(sitemapUrl, {muteHttpExceptions: true});
            const responseCode = response.getResponseCode();
            Logger.log(`Fetching sitemap: ${sitemapUrl}, Response code: ${responseCode}, Attempt: ${attempt}`);

            switch (responseCode) {
                case 200:
                    const contentText = response.getContentText();
                    const document = XmlService.parse(contentText).getRootElement();
                    return extractURLs(document, document.getNamespace());
                case 404:
                    Logger.log(`Sitemap not found: ${sitemapUrl}`);
                    return [];
                case 403:
                    Logger.log(`Access forbidden to sitemap: ${sitemapUrl}`);
                    return [];
                case 500:
                case 502:
                case 503:
                case 504:
                    if (attempt < maxRetries) {
                        Logger.log(`Server error (${responseCode}) for sitemap: ${sitemapUrl}. Retrying...`);
                        Utilities.sleep(1000 * attempt); // Exponential backoff
                        continue;
                    }
                    Logger.log(`Server error (${responseCode}) for sitemap: ${sitemapUrl}. Max retries reached.`);
                    return [];
                default:
                    Logger.log(`Unexpected response code ${responseCode} for sitemap: ${sitemapUrl}`);
                    return [];
            }
        } catch (error) {
            if (attempt < maxRetries) {
                Logger.log(`Error fetching sitemap: ${sitemapUrl}, Error: ${error.message}. Retrying...`);
                Utilities.sleep(1000 * attempt); // Exponential backoff
                continue;
            }
            Logger.log(`Error fetching sitemap: ${sitemapUrl}, Error: ${error.message}. Max retries reached.`);
            return [];
        }
    }
    return []; // If all retries fail
}
/**
 * Extracts URLs and metadata from an XML sitemap document.
 * @param {XmlElement} document - The XML document containing the sitemap.
 * @param {Namespace} namespace - The XML namespace.
 * @returns {string[][]} - An array of URLs and metadata from the sitemap.
 */
function extractURLs(document, namespace) {
    const urls = namespace ? document.getChildren('url', namespace) : document.getChildren('url');
    return urls.map(url => {
        const loc = url.getChild('loc', namespace).getText().trim();
        return [loc];
    });
}
/**
 * Extracts sitemap URLs from a sitemap index file.
 * @param {XmlElement} document - The XML document containing the sitemap index.
 * @param {Namespace} namespace - The XML namespace.
 * @returns {string[]} - An array of sitemap URLs.
 */
function extractSitemapIndexes(document, namespace) {
    const sitemaps = namespace ? document.getChildren('sitemap', namespace) : document.getChildren('sitemap');
    return sitemaps.map(sitemap => sitemap.getChild('loc', namespace).getText().trim());
}

/**
 * Retrieves property URLs from the main sitemap and checks alternate sitemaps if no URLs are found.
 * @param {string} baseUrl - The base URL of the property.
 * @returns {string[]} - An array of URLs from the sitemaps and crawled sources.
 */
function getPropertyUrls(baseUrl) {
    const maxRetries = 3;
    const alternateSitemaps = [
        'sitemap.xml',
        'pages-sitemap.xml',
        'blog-sitemap.xml',
        'product-sitemap.xml'
    ];
    let urlsFromSitemap = [];

    try {
        for (let sitemap of alternateSitemaps) {
            Logger.log(`Attempting to fetch sitemap: ${baseUrl}/${sitemap}`);
            urlsFromSitemap = retryFetch(`${baseUrl}/${sitemap}`, maxRetries);
            if (urlsFromSitemap.length > 0) {
                Logger.log(`Found ${urlsFromSitemap.length} URLs in ${sitemap}`);
                break;
            }
        }

        let crawledUrls = [];
        try {
            crawledUrls = discoverUrls(baseUrl);
            Logger.log(`Discovered ${crawledUrls.length} URLs by crawling`);
        } catch (crawlError) {
            Logger.log(`Error in discoverUrls: ${crawlError.message}`);
        }

        // Combine and deduplicate URLs
        const allUrls = new Set([...urlsFromSitemap, ...crawledUrls]);
        
        Logger.log(`Total unique URLs found: ${allUrls.size}`);
        return Array.from(allUrls);
    } catch (error) {
        Logger.log(`Error in getPropertyUrls: ${error.message}`);
        throw new Error(`Failed to fetch URLs for ${baseUrl}: ${error.message}`);
    }
}

/**
 * Retries fetching sitemap URLs with a specified number of attempts.
 * @param {string} sitemapUrl - The URL of the sitemap to fetch.
 * @param {number} maxRetries - The maximum number of retry attempts.
 * @returns {string[]} - An array of URLs from the sitemap.
 */
function retryFetch(sitemapUrl, maxRetries) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            Logger.log(`Fetching sitemap: ${sitemapUrl}, Attempt: ${attempt}`);
            const urls = fetchSitemapUrls(sitemapUrl);
            if (urls.length > 0) {
                return urls;
            }
        } catch (error) {
            Logger.log(`Error fetching sitemap (Attempt ${attempt}): ${error.message}`);
            if (attempt === maxRetries) {
                Logger.log(`Max retries reached for ${sitemapUrl}`);
            }
        }
    }
    return [];
}
/**
 * Processes multiple sitemaps of a property and appends the data to the sheet.
 * @param {string} primaryUrl - The base URL of the property.
 * @param {Sheet} propertySheet - The Google Sheet to append the URLs.
 */
function processSitemaps(primaryUrl, propertySheet) {
    const sitemapUrls = [
        `${primaryUrl}/sitemap.xml`,
        `${primaryUrl}/pages-sitemap.xml`,
        `${primaryUrl}/blog-categories-sitemap.xml`,
        `${primaryUrl}/blog-posts-sitemap.xml`
    ];

    sitemapUrls.forEach(sitemapUrl => {
        try {
            const urlsFromSitemap = fetchSitemapUrls(sitemapUrl);
            if (urlsFromSitemap.length > 0) {
                processUrlsToSheet(urlsFromSitemap, propertySheet, urlsFromSitemap.length, sitemapUrl);
                Logger.log(`Processed ${urlsFromSitemap.length} URLs from ${sitemapUrl}`);
            } else {
                Logger.log(`No URLs found in sitemap: ${sitemapUrl}`);
            }
        } catch (error) {
            Logger.log(`Error processing sitemap ${sitemapUrl}: ${error.message}`);
        }
    });
    finalizePropertySheet(propertySheet);
}