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

    // Ensure urlsFromSitemap is an array
    if (!Array.isArray(urlsFromSitemap)) {
        Logger.log(`urlsFromSitemap is not an array for ${propertyName}. Converting to array.`);
        urlsFromSitemap = urlsFromSitemap ? [urlsFromSitemap] : [];
    }

    let progressDialog = null;
    let isProgressDialogCreated = false;

    try {
        const htmlOutput = HtmlService.createHtmlOutputFromFile('progress.html')
            .setWidth(300)
            .setHeight(100);
        const ui = SpreadsheetApp.getUi();
        progressDialog = ui.showModelessDialog(htmlOutput, 'Processing URLs');
        isProgressDialogCreated = true;
    } catch (error) {
        Logger.log(`Error creating progress dialog: ${error.message}`);
    }

    const topLevelUrlCount = countTopLevelUrls(urlsFromSitemap.map(entry => Array.isArray(entry) ? entry[0] : entry));
    const totalUrls = urlsFromSitemap.length;
    
    // Process URLs in batches and update progress
    const batchSize = 10;
    for (let i = 0; i < totalUrls; i += batchSize) {
        const batch = urlsFromSitemap.slice(i, i + batchSize);
        processUrlsToSheet(batch, propertySheet, topLevelUrlCount, propertyName);
        
        // Update progress
        if (isProgressDialogCreated && progressDialog) {
            const progress = Math.round(((i + batchSize) / totalUrls) * 100);
            try {
                progressDialog.execute(`updateProgress(${progress})`);
            } catch (error) {
                Logger.log(`Error updating progress: ${error.message}`);
            }
        }
    }

    // Close the progress dialog
    if (isProgressDialogCreated && progressDialog) {
        try {
            progressDialog.execute('closeDialog()');
        } catch (error) {
            Logger.log(`Error closing progress dialog: ${error.message}`);
        }
    }

    processSitemaps(propertyName, propertySheet);
}

function updateProgress(processedUrls, totalUrls, progressDialog, isProgressDialogCreated) {
    if (isProgressDialogCreated && progressDialog) {
        const progress = Math.round((processedUrls / totalUrls) * 100);
        try {
            progressDialog.execute(`updateProgress(${progress})`);
        } catch (error) {
            Logger.log(`Error updating progress: ${error.message}`);
        }
    }
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

    // Sort groups by level (descending order, level 1 being the highest)
    const sortedGroupedUrls = groupedUrls.sort((a, b) => b.level - a.level);

    const currentTime = new Date();
    const processedUrls = new Set();
    const targetLikes = calculateTargetLikes(normalizedUrl); 

    // Process Level 1 URLs first
    const level1Group = sortedGroupedUrls.find(group => group.level === 1);
    if (level1Group) {
        processUrlGroup(level1Group, propertySheet, topLevelUrlCount, currentTime, processedUrls);
    }

    // Process other levels in descending order
    sortedGroupedUrls.forEach(group => {
        if (group.level !== 1) {
            processUrlGroup(group, propertySheet, topLevelUrlCount, currentTime, processedUrls);
        }
    });

    Logger.log(`Finished processing ${processedUrls.size} URLs and appending to the sheet.`);
}

function processUrlGroup(group, propertySheet, topLevelUrlCount, currentTime, processedUrls) {
    group.urls.forEach(url => {
        if (processedUrls.has(url) || !isValidUrl(url)) {
            Logger.log(`Skipping already processed or invalid URL: ${url}`);
            return;
        }

        try {
            Logger.log(`Processing URL: ${url} at level ${group.level}`);

            const normalizedUrl = normalizeUrl(url);
            const metaTitle = fetchMetaTitle(normalizedUrl);
            const metaDescription = fetchMetaDescription(normalizedUrl);
            const headerTags = fetchHeaderTags(normalizedUrl);
            const version = `Version ${currentTime.toISOString()}`;
            const likeCount = group.level === 4 ? fetchLikeCount(normalizedUrl) : 'N/A';
            const targetLikes = calculateTargetLikes(normalizedUrl, group.level);

            Logger.log(`Appending data for URL: ${normalizedUrl}`);
            Logger.log(`Meta Title: ${metaTitle}, Meta Description: ${metaDescription}, Header Tags: ${JSON.stringify(headerTags)}, Like Count: ${likeCount}, Target Likes: ${targetLikes}`);

            // Append data to the property sheet
            propertySheet.appendRow([normalizedUrl, metaTitle, metaDescription, JSON.stringify(headerTags), version, currentTime, topLevelUrlCount, group.level, likeCount, targetLikes]);

            processedUrls.add(url);
        } catch (error) {
            Logger.log(`Error processing URL ${url}: ${error.message}`);
        }
    });
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
 * Finalizes the property sheet by sorting, grouping URLs, and applying filters.
 * @param {Sheet} propertySheet - The sheet to finalize.
 */
function finalizePropertySheet(propertySheet) {
    sortPropertySheet(propertySheet);
    groupAndCollapseUrls(propertySheet);
    applyFilterToPropertySheet(propertySheet);
}

/**
 * Groups URLs with the same URL and collapses historic versions.
 * @param {Sheet} propertySheet - The sheet to group and collapse.
 */
function groupAndCollapseUrls(propertySheet) {
    const lastRow = propertySheet.getLastRow();
    if (lastRow <= 1) return; // No data to process

    const data = propertySheet.getRange(2, 1, lastRow - 1, propertySheet.getLastColumn()).getValues();
    let currentUrl = '';
    let groupStart = 2;
    let latestTimestamp = new Date(0);
    let latestRow = 2;

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const url = row[0];
        const timestamp = new Date(row[5]); // Assuming timestamp is in column 6

        if (url !== currentUrl) {
            // New URL group
            if (i > 0) {
                // Finish previous group
                if (groupStart < i + 1) {
                    propertySheet.getRange(groupStart, 1, i + 1 - groupStart, propertySheet.getLastColumn()).shiftRowGroupDepth(1);
                    propertySheet.hideRows(groupStart, i + 1 - groupStart);
                    propertySheet.showRows(latestRow, 1);
                }
            }
            currentUrl = url;
            groupStart = i + 2; // +2 because data array is 0-indexed and sheet is 1-indexed
            latestTimestamp = timestamp;
            latestRow = i + 2;
        } else {
            // Same URL group
            if (timestamp > latestTimestamp) {
                latestTimestamp = timestamp;
                latestRow = i + 2;
            }
        }
    }

    // Handle the last group
    if (groupStart < lastRow) {
        propertySheet.getRange(groupStart, 1, lastRow - groupStart + 1, propertySheet.getLastColumn()).shiftRowGroupDepth(1);
        propertySheet.hideRows(groupStart, lastRow - groupStart + 1);
        propertySheet.showRows(latestRow, 1);
    }
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


/**
 * Updates all properties by fetching the latest data and refreshing their respective sheets.
 */
function updateAllProperties() {
  const ui = SpreadsheetApp.getUi();
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const summarySheet = spreadsheet.getSheetByName('Properties');

  if (!summarySheet) {
    ui.alert('Error: Summary sheet "Properties" not found. Please initialize the app first.');
    return;
  }

  const propertyData = summarySheet.getDataRange().getValues();
  propertyData.shift(); // Remove header row

  if (propertyData.length === 0) {
    ui.alert('No properties found to update.');
    return;
  }

  showProgressDialog();

  for (let i = 0; i < propertyData.length; i++) {
    const [propertyUrl, topLevelUrl, lastUpdated] = propertyData[i];
    
    try {
      const urlsFromSitemap = getPropertyUrls(propertyUrl);
      
      if (urlsFromSitemap.length === 0) {
        Logger.log(`No URLs found in the sitemaps for ${propertyUrl}.`);
        continue;
      }

      const currentTime = new Date();
      const propertySheet = spreadsheet.getSheetByName(sanitizeSheetName(propertyUrl));

      if (!propertySheet) {
        processPropertySheet(propertyUrl, urlsFromSitemap, currentTime);
      } else {
        updateExistingPropertySheet(propertySheet, urlsFromSitemap, currentTime);
      }

      // Update last updated time in summary sheet
      summarySheet.getRange(i + 2, 3).setValue(currentTime);

      // Update progress
      const progress = Math.round(((i + 1) / propertyData.length) * 100);
      updateClientProgress(progress);

    } catch (error) {
      Logger.log(`Error updating property ${propertyUrl}: ${error.message}`);
    }
  }

  closeProgressDialog();
  ui.alert('All properties have been updated successfully.');
}

function updateExistingPropertySheet(propertySheet, urlsFromSitemap, currentTime) {
  const data = propertySheet.getDataRange().getValues();
  const headers = data[0];
  const urlIndex = headers.indexOf('URL');
  const existingUrls = new Set(data.slice(1).map(row => row[urlIndex]));

  for (const url of urlsFromSitemap) {
    if (existingUrls.has(url)) {
      // URL exists, add new version and group/collapse old versions
      addNewVersionAndGroup(propertySheet, url, currentTime);
    } else {
      // New URL, add it to the sheet
      addNewUrlToSheet(propertySheet, url, currentTime);
    }
  }

  // Sort and apply filters
  sortPropertySheet(propertySheet);
  applyFilterToPropertySheet(propertySheet);
}

function addNewVersionAndGroup(propertySheet, url, currentTime) {
  const data = propertySheet.getDataRange().getValues();
  const headers = data[0];
  const urlIndex = headers.indexOf('URL');
  const versionIndex = headers.indexOf('Version');
  const timestampIndex = headers.indexOf('Timestamp');

  let groupStart = null;
  let groupEnd = null;

  // Find the group of rows with the same URL
  for (let i = 1; i < data.length; i++) {
    if (data[i][urlIndex] === url) {
      if (groupStart === null) groupStart = i + 1; // +1 because sheet rows are 1-indexed
      groupEnd = i + 1;
    } else if (groupStart !== null) {
      break;
    }
  }

  if (groupStart !== null && groupEnd !== null) {
    // Add new version at the top of the group
    const newRow = [...data[groupStart - 1]];
    newRow[versionIndex] = `Version ${currentTime.toISOString()}`;
    newRow[timestampIndex] = currentTime;
    propertySheet.insertRowBefore(groupStart);
    propertySheet.getRange(groupStart, 1, 1, newRow.length).setValues([newRow]);

    // Group and collapse old versions
    if (groupEnd - groupStart > 0) {
      propertySheet.getRange(groupStart + 1, 1, groupEnd - groupStart + 1, propertySheet.getLastColumn()).shiftRowGroupDepth(1);
      propertySheet.hideRows(groupStart + 1, groupEnd - groupStart + 1);
    }
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

  propertySheet.appendRow([
    normalizedUrl,
    metaTitle,
    metaDescription,
    JSON.stringify(headerTags),
    version,
    currentTime,
    topLevelUrlCount,
    level,
    likeCount
  ]);
}
/**
 * Updates the "Last Updated" timestamp for a property in the summary sheet.
 * @param {string} propertyName - The name of the property to update.
 * @param {Date} updateTime - The timestamp to set.
 */
function updateSummarySheetTimestamp(propertyName, updateTime) {
  const summarySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Properties');
  if (!summarySheet) {
    Logger.log('Summary sheet not found');
    return;
  }

  const data = summarySheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === propertyName) {
      summarySheet.getRange(i + 1, 3).setValue(updateTime);
      Logger.log(`Updated timestamp for ${propertyName} to ${updateTime}`);
      break;
    }
  }
}