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
