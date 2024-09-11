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
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
}

/**
 * Counts the number of top-level URLs (with only one '/' after the domain).
 * @param {string[]} urls - Array of URLs to count.
 * @returns {number} - The count of top-level URLs.
 */
function countTopLevelUrls(urls) {
    return urls.filter(url => {
        if (typeof url !== 'string') return false;
        const pathSegments = (url.match(/\//g) || []).length;
        return pathSegments === 3;
    }).length;
}
