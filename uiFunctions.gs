/**
 * UI Functions: Manages dialogs and custom menus in Google Sheets.
 * 
 * File: uiFunctions.gs
 */

let isProcessingStopped = false;

/**
 * Displays a modeless dialog indicating that URLs are being processed.
 */
function showProgressDialog() {
    isProcessingStopped = false; // Reset the flag when showing the dialog
    const ui = SpreadsheetApp.getUi();
    const htmlOutput = HtmlService.createHtmlOutputFromFile('progress.html')
        .setWidth(300)
        .setHeight(100);
    ui.showModelessDialog(htmlOutput, 'Processing URLs');
}

function updateClientProgress(progress) {
    return HtmlService.createHtmlOutput(`<script>window.top.updateProgress(${progress});</script>`);
}

/**
 * Closes the previously displayed progress dialog in the UI.
 */
function closeProgressDialog() {
    const ui = SpreadsheetApp.getUi();
    ui.showModelessDialog(HtmlService.createHtmlOutput('<script>window.close();</script>'), 'Processing URLs');
}

/**
 * Stops the ongoing processing.
 */
function stopProcessing() {
    isProcessingStopped = true;
}
/**
 * Resets the application by deleting all sheets except the summary sheet and clearing its contents.
 */
function resetApp() {
    const ui = SpreadsheetApp.getUi();
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const summarySheetName = 'Properties';

    spreadsheet.getSheets().forEach(sheet => {
        if (sheet.getName() !== summarySheetName) {
            spreadsheet.deleteSheet(sheet);
        }
    });

    const summarySheet = spreadsheet.getSheetByName(summarySheetName);
    if (summarySheet) {
        summarySheet.clearContents();
        summarySheet.appendRow(['Property Name', 'Top-Level URL', 'Last Updated']);
    }

    ui.alert('Application reset. All properties deleted except the summary sheet.');
}

/**
 * Adds a custom menu to the Google Sheet when it is opened.
 */
function onOpen() {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('Property Controller')
        .addItem('Initialize Summary Sheet', 'initializeSummarySheet')
        .addItem('Add Property', 'addProperty')
        .addItem('Update All Properties', 'updateAllProperties')  // Add this line
        .addItem('Reset App', 'resetApp')
        .addToUi();
}

/**
 * Initializes a summary sheet that stores property names and URLs.
 */
function initializeSummarySheet() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet();
    const summarySheetName = 'Properties'; 

    let summarySheet = sheet.getSheetByName(summarySheetName);

    if (!summarySheet) {
        summarySheet = sheet.insertSheet(summarySheetName);
        summarySheet.appendRow(['Property Name', 'Top-Level URL', 'Last Updated']);
        // Add this line to resize columns after creating the header row
        summarySheet.autoResizeColumns(1, 3);
        SpreadsheetApp.getUi().alert('Summary sheet initialized successfully.');
    } else {
        SpreadsheetApp.getUi().alert('Summary sheet already exists.');
    }
}
/**
 * Prompts the user to add up to 10 property URLs from its sitemap.
 */
/**
 * Prompts the user to add up to 10 property URLs from its sitemap.
 */
function addProperty() {
    const ui = SpreadsheetApp.getUi();
    const response = ui.prompt(
        'Add Property',
        'Enter up to 10 base URLs (e.g., example.com, example2.com):',
        ui.ButtonSet.OK_CANCEL
    );

    if (response.getSelectedButton() === ui.Button.OK) {
        console.log('User input received:', response.getResponseText());
        let propertyBaseUrls = response.getResponseText().trim().split(',');

        if (propertyBaseUrls.length > 10) {
            console.error('Error: More than 10 URLs entered:', propertyBaseUrls.length);
            ui.alert('You can enter up to 10 URLs only. Please try again.');
            return;
        }

        propertyBaseUrls = propertyBaseUrls.map(url => url.trim());
        console.log('Processed URLs:', propertyBaseUrls);

        const validUrls = [];
        for (let url of propertyBaseUrls) {
            url = normalizeUrl(url);
            if (isValidUrl(url)) {
                validUrls.push(url);
            } else {
                console.error('Invalid URL detected:', url);
                ui.alert(`Invalid URL entered: ${url}. Please try again.`);
                return;
            }
        }
        console.log('Valid URLs:', validUrls);

        try {
            const summarySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Properties');
            if (!summarySheet) {
                console.error('Summary sheet not found');
                ui.alert('Error: Summary sheet does not exist. Please initialize it first.');
                return;
            }

            showProgressDialog(); // Show progress dialog before processing

            const currentTime = new Date();
            let isFirstEntry = true;
            for (let [index, url] of validUrls.entries()) {
                console.log('Processing URL:', url);
                let urlsFromSitemap;
                try {
                    urlsFromSitemap = getPropertyUrls(url);
                    console.log(`URLs found for ${url}:`, urlsFromSitemap.length);
                } catch (error) {
                    console.error(`Error fetching URLs for ${url}:`, error);
                    ui.alert(`Error fetching URLs for ${url}: ${error.message}`);
                    continue;
                }

                if (urlsFromSitemap.length === 0) {
                    console.warn(`No URLs found in the sitemaps for ${url}`);
                    ui.alert(`No URLs found in the sitemaps for ${url}.`);
                    continue;
                }

                const topLevelUrl = getTopLevelDomain(url);
                summarySheet.appendRow([url, topLevelUrl, currentTime]);
                console.log(`Added to summary sheet: ${url}, ${topLevelUrl}, ${currentTime}`);

                if (isFirstEntry) {
                    summarySheet.autoResizeColumns(1, 3);
                    isFirstEntry = false;
                }

                try {
                    processPropertySheet(url, urlsFromSitemap, currentTime);
                    console.log(`Processed property sheet for ${url}`);
                } catch (error) {
                    console.error(`Error processing property sheet for ${url}:`, error);
                    ui.alert(`Error processing property sheet for ${url}: ${error.message}`);
                }

                // Update progress
                const progress = Math.round(((index + 1) / validUrls.length) * 100);
                updateClientProgress(progress);
            }

            closeProgressDialog(); // Close progress dialog after processing
        } catch (error) {
            console.error('General error in addProperty:', error);
            closeProgressDialog(); // Make sure to close the dialog even if an error occurs
            ui.alert(`Error: ${error.message}`);
        }
    } else {
        console.log('Operation cancelled by user');
        ui.alert('Operation cancelled.');
    }
}