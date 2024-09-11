/**
 * Property Sheet Management Functions: Manages the Google Sheets operations.
 * 
 * File: sheetFunctions.gs
 */

/**
 * Processes the property sheet, handling URLs, progress tracking, and sitemap processing.
 * @param {string} propertyName - The property name or base URL.
 * @param {string[]} urlsFromSitemap - Array of URLs retrieved from the sitemap.
 * @param {Date} currentTime - The current date/time for tracking.
 */
function processPropertySheet(propertyName, urlsFromSitemap, currentTime) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet();
    const sanitizedPropertyName = sanitizeSheetName(propertyName);
    let propertySheet = sheet.getSheetByName(sanitizedPropertyName);
    
    if (!propertySheet) {
        propertySheet = sheet.insertSheet(sanitizedPropertyName);
        propertySheet.appendRow(['URL', 'Meta Title', 'Meta Description', 'Header Tags', 'Version', 'Timestamp', '#ofUrls', 'Level', 'Like Count', 'Target Likes']);
    }

    // Use the progress.html file for the progress dialog
    const htmlOutput = HtmlService.createHtmlOutputFromFile('progress.html')
        .setWidth(300)
        .setHeight(100);
    const ui = SpreadsheetApp.getUi();
    const progressDialog = ui.showModelessDialog(htmlOutput, 'Processing URLs');

    const topLevelUrlCount = countTopLevelUrls(urlsFromSitemap.map(entry => entry[0]));
    const totalUrls = urlsFromSitemap.length;
    
    // Process URLs in batches and update progress
    const batchSize = 10;
    for (let i = 0; i < totalUrls; i += batchSize) {
        const batch = urlsFromSitemap.slice(i, i + batchSize);
        processUrlsToSheet(batch, propertySheet, topLevelUrlCount, propertyName);
        
        // Update progress
        const progress = Math.round(((i + batchSize) / totalUrls) * 100);
        progressDialog.execute(`updateProgress(${progress})`);
    }

    // Close the progress dialog
    progressDialog.execute('closeDialog()');

    processSitemaps(propertyName, propertySheet);
}
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
                const likeCount = fetchLikeCount(normalizedUrl); // This now returns a number or 'Not Available'

                Logger.log(`Appending data for URL: ${normalizedUrl}`);
                Logger.log(`Meta Title: ${metaTitle}, Meta Description: ${metaDescription}, Header Tags: ${JSON.stringify(headerTags)}, Like Count: ${likeCount}`);

                // Append data to the property sheet, including the like count
                propertySheet.appendRow([normalizedUrl, metaTitle, metaDescription, JSON.stringify(headerTags), version, currentTime, topLevelUrlCount, group.level, likeCount]);

            } catch (error) {
                Logger.log(`Error processing URL ${url}: ${error.message}`);
            }
        });
    });

    Logger.log(`Finished processing ${groupedUrls.length} URLs and appending to the sheet.`);
}

function processUrlsBatch() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('URLQueue');
    const data = sheet.getDataRange().getValues();
    const batchSize = 50; // Process 50 URLs at a time

    if (data.length > 1) { // Assuming first row is header
        const batch = data.slice(1, batchSize + 1);
        // Process this batch
        processBatch(batch);
        // Remove processed URLs from the queue
        sheet.deleteRows(2, batch.length);
    }
}

function setupTrigger() {
    ScriptApp.newTrigger('processUrlsBatch')
        .timeBased()
        .everyMinutes(5)
        .create();
}
/**
 * Finalizes the property sheet by sorting, expanding levels, and applying filters.
 * @param {Sheet} propertySheet - The sheet to finalize.
 */
function finalizePropertySheet(propertySheet) {
    sortPropertySheet(propertySheet);
    autoExpandLevels(propertySheet);
    applyFilterToPropertySheet(propertySheet);
}

/**
 * Sanitizes a sheet name by removing invalid characters and limiting its length to 100 characters.
 * @param {string} name - The name to sanitize.
 * @returns {string} - The sanitized sheet name.
 */
function sanitizeSheetName(name) {
    return name.replace(/[\/\\?*[\]]/g, '_').substring(0, 100);
}

/**
 * Sorts the property sheet first by timestamp (descending) and then by URL (ascending).
 * @param {Sheet} propertySheet - The sheet to sort.
 */
function sortPropertySheet(propertySheet) {
    const lastRow = propertySheet.getLastRow();
    if (lastRow > 1) {
        propertySheet.getRange(2, 1, lastRow - 1, 8).sort({ column: 6, ascending: false });
        propertySheet.getRange(2, 1, lastRow - 1, 8).sort({ column: 1, ascending: true });
    }
}

/**
 * Expands level 1 and 2 URLs and groups other levels in the sheet for easier viewing.
 * @param {Sheet} propertySheet - The sheet to expand.
 */
function autoExpandLevels(propertySheet) {
    const lastRow = propertySheet.getLastRow();
    if (lastRow > 1) {
        const dataRange = propertySheet.getRange(2, 1, lastRow - 1, 6);
        const data = dataRange.getValues();
        let groupStart = null;
        let currentLevel = null;

        data.forEach((row, i) => {
            const level = parseInt(row[3].replace('Level ', ''), 10);
            if (currentLevel !== null && currentLevel !== level && groupStart !== null && currentLevel > 2) {
                propertySheet.getRange(groupStart + 2, 1, i - groupStart, 6).shiftRowGroupDepth(1);
                propertySheet.hideRows(groupStart + 2, i - groupStart);
            }

            if (level <= 2) {
                propertySheet.showRows(i + 2);
            }

            currentLevel = level;
            groupStart = i;
        });
    }
}

/**
 * Applies a filter to the property sheet.
 * @param {Sheet} propertySheet - The sheet to apply the filter to.
 */
function applyFilterToPropertySheet(propertySheet) {
    const range = propertySheet.getRange(1, 1, propertySheet.getLastRow(), propertySheet.getLastColumn());
    if (propertySheet.getFilter()) {
        propertySheet.getFilter().remove();
    }
    range.createFilter();
}
