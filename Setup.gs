/**
 * Setup.gs — One-time initialization
 *
 * Run setupSheet() once from the Apps Script editor to:
 *   1. Create the GFFL Google Spreadsheet
 *   2. Create all tabs with correct headers
 *   3. Seed default Config values
 *   4. Save the Sheet ID to PropertiesService
 *
 * Safe to run again — checks if SHEET_ID already exists first.
 */

/**
 * Main setup function. Run this once from the Apps Script editor.
 * After it runs, the Sheet ID is saved automatically — no manual steps needed.
 */
function setupSheet() {
  var props   = PropertiesService.getScriptProperties();
  var existing = props.getProperty('SHEET_ID');

  if (existing) {
    Logger.log('⚠️  SHEET_ID already set: ' + existing);
    Logger.log('Sheet URL: https://docs.google.com/spreadsheets/d/' + existing);
    Logger.log('Run resetSetup() first if you want to start over.');
    return;
  }

  // Create the spreadsheet
  var ss = SpreadsheetApp.create('GFFL 2025');
  Logger.log('✅ Created spreadsheet: ' + ss.getUrl());

  // Build Config tab (renames the default Sheet1)
  var configSheet = ss.getActiveSheet();
  configSheet.setName('Config');
  configSheet.getRange(1, 1, 1, 2).setValues([['Key', 'Value']]);
  configSheet.getRange(1, 1, 1, 2).setFontWeight('bold');
  seedConfig(configSheet);

  // Build Players tab
  var playersSheet = ss.insertSheet('Players');
  playersSheet.getRange(1, 1, 1, 2).setValues([['PlayerID', 'Name']]);
  playersSheet.getRange(1, 1, 1, 2).setFontWeight('bold');

  // Build Picks tab
  var picksSheet = ss.insertSheet('Picks');
  var picksHeaders = [['PickID', 'Season', 'Week', 'PlayerName', 'TeamAbbr', 'PointsEarned', 'Timestamp']];
  picksSheet.getRange(1, 1, 1, 7).setValues(picksHeaders);
  picksSheet.getRange(1, 1, 1, 7).setFontWeight('bold');

  // Build BonusPoints tab
  var bonusSheet = ss.insertSheet('BonusPoints');
  var bonusHeaders = [['BonusID', 'Season', 'Week', 'PlayerName', 'Points', 'Reason', 'Timestamp']];
  bonusSheet.getRange(1, 1, 1, 7).setValues(bonusHeaders);
  bonusSheet.getRange(1, 1, 1, 7).setFontWeight('bold');

  // Save the Sheet ID to PropertiesService
  props.setProperty('SHEET_ID', ss.getId());
  Logger.log('✅ SHEET_ID saved to PropertiesService');
  Logger.log('✅ Setup complete! Open your sheet: ' + ss.getUrl());
}

/**
 * Seeds the Config sheet with default values.
 * @param {Sheet} configSheet
 */
function seedConfig(configSheet) {
  var defaults = [
    ['CurrentWeek', 1],
    ['Season', 2025],
    ['GraceBowlStart', 16]
  ];
  configSheet.getRange(2, 1, defaults.length, 2).setValues(defaults);
}

/**
 * Clears the saved Sheet ID so setupSheet() can run again.
 * WARNING: Does NOT delete the existing spreadsheet.
 * Only use this if you want to point the app at a new sheet.
 */
function resetSetup() {
  PropertiesService.getScriptProperties().deleteProperty('SHEET_ID');
  Logger.log('SHEET_ID cleared. Run setupSheet() to create a new sheet.');
}

/**
 * Utility: logs the current Sheet ID and URL (useful for debugging).
 */
function logSheetUrl() {
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) {
    Logger.log('No SHEET_ID set. Run setupSheet() first.');
  } else {
    Logger.log('Sheet ID: ' + id);
    Logger.log('Sheet URL: https://docs.google.com/spreadsheets/d/' + id);
  }
}
