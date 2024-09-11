/**
 * UI Functions: Manages dialogs and custom menus in Google Sheets.
 * 
 * File: uiFunctions.gs
 */

/**
 * Displays a modeless dialog indicating that URLs are being processed.
 */
function showProgressDialog() {
    const ui = SpreadsheetApp.getUi();
    const htmlOutput = HtmlService.createHtmlOutput('<p>Processing URLs...</p>')
        .setWidth(300)
        .setHeight(100);
    ui.showModelessDialog(htmlOutput, 'Processing URLs');
}

/**
 * Closes the previously displayed progress dialog in the UI.
 */
function closeProgressDialog() {
    const ui = SpreadsheetApp.getUi();
    ui.showModelessDialog(HtmlService.createHtmlOutput('<script>window.close();</script>'), 'Processing URLs');
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
        SpreadsheetApp.getUi().alert('Summary sheet initialized successfully.');
    } else {
        SpreadsheetApp.getUi().alert('Summary sheet already exists.');
    }
}

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
        let propertyBaseUrls = response.getResponseText().trim().split(',');

        if (propertyBaseUrls.length > 10) {
            ui.alert('You can enter up to 10 URLs only. Please try again.');
            return;
        }

        propertyBaseUrls = propertyBaseUrls.map(url => url.trim());

        const validUrls = [];
        for (let url of propertyBaseUrls) {
            url = normalizeUrl(url);
            if (isValidUrl(url)) {
                validUrls.push(url);
            } else {
                ui.alert(`Invalid URL entered: ${url}. Please try again.`);
                return;
            }
        }

        try {
            const summarySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Properties');
            if (!summarySheet) {
                ui.alert('Error: Summary sheet does not exist. Please initialize it first.');
                return;
            }

            const currentTime = new Date();
            for (let url of validUrls) {
                const urlsFromSitemap = getPropertyUrls(url);

                if (urlsFromSitemap.length === 0) {
                    ui.alert(`No URLs found in the sitemaps for ${url}.`);
                    continue;
                }

                const topLevelUrl = getTopLevelDomain(url);
                summarySheet.appendRow([url, topLevelUrl, currentTime]);

                processPropertySheet(url, urlsFromSitemap, currentTime);
            }
        } catch (error) {
            ui.alert(`Error fetching URLs: ${error.message}`);
        }
    } else {
        ui.alert('Operation cancelled.');
    }
}
