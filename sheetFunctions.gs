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
        propertySheet.appendRow(['URL', 'Meta Title', 'Meta Description', 'Header Tags', 'Version', 'Timestamp', '#ofUrls', 'Level']);
                // Add this line to resize columns after creating the header row
        propertySheet.autoResizeColumns(1, 8);
    }

    showProgressDialog();
    const topLevelUrlCount = countTopLevelUrls(urlsFromSitemap.map(entry => entry[0]));
    processUrlsToSheet(urlsFromSitemap, propertySheet, topLevelUrlCount, propertyName);
    closeProgressDialog();
    processSitemaps(propertyName, propertySheet);
}

/**
 * Processes URLs and appends metadata such as title and description to the sheet.
 * @param {string[]} urlsFromSitemap - The URLs retrieved from the sitemap.
 * @param {Sheet} propertySheet - The sheet to append the data.
 * @param {number} topLevelUrlCount - The number of top-level URLs.
 * @param {string} sitemapUrl - The URL of the sitemap from which the URLs were retrieved.
 */
function processUrlsToSheet(urlsFromSitemap, propertySheet, topLevelUrlCount, sitemapUrl) {
    const urls = urlsFromSitemap.map(entry => entry[0]);
    const groupedUrls = groupUrlsByLevel(urls, sitemapUrl);
    const currentTime = new Date();
    const batchData = [];

    groupedUrls.forEach(group => {
        group.urls.forEach(url => {
            const normalizedUrl = normalizeUrl(url);
            const metaTitle = fetchMetaTitle(normalizedUrl);
            const metaDescription = fetchMetaDescription(normalizedUrl);
            const headerTags = fetchHeaderTags(normalizedUrl);

            batchData.push([normalizedUrl, metaTitle, metaDescription, JSON.stringify(headerTags), `Version ${currentTime.toISOString()}`, currentTime, topLevelUrlCount, group.level]);
        });
    });

    // Write all data in one batch operation
    if (batchData.length > 0) {
        propertySheet.getRange(propertySheet.getLastRow() + 1, 1, batchData.length, batchData[0].length).setValues(batchData);
                // Add this line to resize columns after adding the first URL entry
        propertySheet.autoResizeColumns(1, 8);
    }
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
