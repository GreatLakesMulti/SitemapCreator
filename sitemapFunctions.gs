/**
 * Sitemap Processing Functions: Fetches and processes URLs from sitemaps.
 * 
 * File: sitemapFunctions.gs
 */

/**
 * Fetches URLs from a sitemap XML file.
 * @param {string} sitemapUrl - The URL of the sitemap to fetch.
 * @returns {string[]} - An array of valid URLs from the sitemap.
 */
function fetchSitemapUrls(sitemapUrl) {
    try {
        const response = UrlFetchApp.fetch(sitemapUrl);
        const contentText = response.getContentText();
        const document = XmlService.parse(contentText).getRootElement();
        return extractURLs(document, document.getNamespace());
    } catch (error) {
        Logger.log(`Error fetching sitemap: ${sitemapUrl}, Error: ${error.message}`);
        return [];
    }
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
 * @returns {string[]} - An array of URLs from the sitemaps.
 */
function getPropertyUrls(baseUrl) {
    let urlsFromSitemap = fetchSitemapUrls(`${baseUrl}/sitemap.xml`);
    if (urlsFromSitemap.length === 0) {
        const alternateSitemap = `${baseUrl}/pages-sitemap.xml`;
        urlsFromSitemap = fetchSitemapUrls(alternateSitemap);
    }
    return urlsFromSitemap;
}

/**
 * Processes multiple sitemaps of a property and appends the data to the sheet.
 * @param {string} primaryUrl - The base URL of the property.
 * @param {Sheet} propertySheet - The Google Sheet to append the URLs.
 */
function processSitemaps(primaryUrl, propertySheet) {
    const sitemapUrls = [
        `${primaryUrl}/pages-sitemap.xml`,
        `${primaryUrl}/blog-categories-sitemap.xml`,
        `${primaryUrl}/blog-posts-sitemap.xml`
    ];

    sitemapUrls.forEach(sitemapUrl => {
        const urlsFromSitemap = fetchSitemapUrls(sitemapUrl);
        processUrlsToSheet(urlsFromSitemap, propertySheet, urlsFromSitemap.length, sitemapUrl);
    });
    finalizePropertySheet(propertySheet);
}
