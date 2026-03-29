/**
 * Sheets.gs — Google Sheets read/write functions
 *
 * Sheet ID is stored in PropertiesService, never hardcoded.
 * To set it (run once manually in the Apps Script editor):
 *   PropertiesService.getScriptProperties().setProperty('SHEET_ID', 'your-sheet-id-here');
 */

/**
 * Returns the active Google Sheet for the league.
 */
function getLeagueSheet() {
  const sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!sheetId) throw new Error('SHEET_ID not set in PropertiesService. Run setup first.');
  return SpreadsheetApp.openById(sheetId);
}

/**
 * Reads picks data from the sheet.
 * TODO: Update column mappings once the sheet layout is confirmed.
 */
function getPicksFromSheet() {
  const ss = getLeagueSheet();
  const sheet = ss.getActiveSheet();
  const data = sheet.getDataRange().getValues();
  return data;
}
