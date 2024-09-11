/**
 * Metadata Fetching Functions: Fetches meta information like title, description, and headers.
 * 
 * File: metadataFunctions.gs
 */

/**
 * Fetches the meta title from a URL.
 * @param {string} url - The URL to fetch the meta title from.
 * @returns {string} - The meta title of the page.
 */
function fetchMetaTitle(url) {
    try {
        const response = UrlFetchApp.fetch(url);
        const htmlContent = response.getContentText();
        const titleMatch = htmlContent.match(/<title>([^<]+)<\/title>/i);
        return titleMatch ? titleMatch[1] : 'No Title Found';
    } catch (error) {
        return 'Error Fetching Title';
    }
}

/**
 * Fetches the meta description from a URL.
 * @param {string} url - The URL to fetch the meta description from.
 * @returns {string} - The meta description of the page.
 */
function fetchMetaDescription(url) {
    try {
        const response = UrlFetchApp.fetch(url);
        const htmlContent = response.getContentText();
        const descriptionMatch = htmlContent.match(/<meta name="description" content="([^"]*)"/i);
        return descriptionMatch ? descriptionMatch[1] : 'No Description Found';
    } catch (error) {
        return 'Error Fetching Description';
    }
}

/**
 * Fetches and categorizes header tags (H1-H6) from a URL.
 * @param {string} url - The URL to fetch the header tags from.
 * @returns {Object} - An object with keys H1-H6 containing their respective contents.
 */
function fetchHeaderTags(url) {
    try {
        const response = UrlFetchApp.fetch(url);
        const htmlContent = response.getContentText();
        const headerTags = { H1: [], H2: [], H3: [], H4: [], H5: [], H6: [] };

        for (let i = 1; i <= 6; i++) {
            const headerMatches = htmlContent.match(new RegExp(`<h${i}>(.*?)<\/h${i}>`, 'gi'));
            if (headerMatches) {
                headerMatches.forEach(tag => {
                    const tagContent = tag.match(new RegExp(`<h${i}>(.*?)<\/h${i}>`, 'i'))[1];
                    headerTags[`H${i}`].push(tagContent.trim());
                });
            }
        }
        return headerTags;
    } catch (error) {
        return { H1: [], H2: [], H3: [], H4: [], H5: [], H6: [] };
    }
}

function calculateTargetLikes(url) {
    // This is a placeholder function. You should implement your own logic
    // to determine the target number of likes based on the URL or other factors.
    // For now, let's return a random number between 50 and 200 as an example.
    return Math.floor(Math.random() * (200 - 50 + 1)) + 50;
}

function updateTargetLikesForNewUrl(url, propertySheet) {
    const targetLikes = calculateTargetLikes(url);
    const lastRow = propertySheet.getLastRow();
    propertySheet.getRange(lastRow, 10).setValue(targetLikes); // Assuming 'Target Likes' is in column 10
}

/**
 * Fetches the like count from a URL.
 * @param {string} url - The URL to fetch the like count from.
 * @returns {number|string} - The like count of the page or 'Not Available' if not present.
 */
function fetchLikeCount(url) {
    Logger.log(`Fetching like count for blog article: ${url}`);
    try {
        const response = UrlFetchApp.fetch(url);
        const htmlContent = response.getContentText();
        const likeCountMatch = htmlContent.match(/<span aria-hidden="true" class="like-button-with-count__like-count">(\d+)<\/span>/i);
        
        if (likeCountMatch) {
            return parseInt(likeCountMatch[1], 10);
        } else {
            // Check if the element exists but is empty
            const emptyLikeCountMatch = htmlContent.match(/<span aria-hidden="true" class="like-button-with-count__like-count"><\/span>/i);
            return emptyLikeCountMatch ? 0 : 'Not Available';
        }
    } catch (error) {
        Logger.log(`Error fetching like count for ${url}: ${error.message}`);
        return 'Not Available';
    }
}