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

/**
 * Adds Player1 through Player25 to the Players sheet for testing.
 * Safe to run multiple times — skips names that already exist.
 * Run this from the Apps Script editor.
 */
function seedTestPlayers() {
  var sheet    = getLeagueSheet().getSheetByName('Players');
  var existing = getPlayerNames();
  var added    = 0;

  for (var i = 1; i <= 25; i++) {
    var name = 'Player' + i;
    if (existing.indexOf(name) === -1) {
      var nextId = sheet.getLastRow();
      sheet.appendRow([nextId, name]);
      added++;
    }
  }

  Logger.log('✅ Added ' + added + ' players. Total players: ' + getPlayerNames().length);
}

/**
 * Sets the current week to 6 for testing.
 * Run this from the Apps Script editor.
 */
function setWeekToSix() {
  setConfig('CurrentWeek', 6);
  Logger.log('✅ CurrentWeek set to 6');
}

/**
 * Adds the Result column header (column H) to the Picks sheet.
 * Run once after deploying the W-L-T update.
 * Safe to run again — skips if header already exists.
 */
function migrateAddResultColumn() {
  var sheet = getLeagueSheet().getSheetByName('Picks');
  var header = sheet.getRange(1, 8).getValue();
  if (header === 'Result') {
    Logger.log('Result column already exists — nothing to do.');
    return;
  }
  sheet.getRange(1, 8).setValue('Result');
  Logger.log('✅ Result column added to Picks sheet.');
}

/**
 * Seeds random picks for Player1-25, weeks 1-6, with pre-filled results.
 * For testing standings display. Does NOT call ESPN.
 * Safe to run once — clears any existing picks first.
 * Run from the Apps Script editor.
 */
function seedRandomPicks() {
  var picksSheet = getLeagueSheet().getSheetByName('Picks');
  var season     = Number(getConfig('Season')) || 2025;
  var players    = getPlayerNames();

  // Remove any existing seeded picks for this season
  var data = picksSheet.getDataRange().getValues();
  var rowsToKeep = [data[0]]; // keep header
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] != season) rowsToKeep.push(data[i]);
  }
  picksSheet.clearContents();
  picksSheet.getRange(1, 1, rowsToKeep.length, rowsToKeep[0].length).setValues(rowsToKeep);

  // NFL teams pool for random assignment
  var teams = ['KC','BUF','BAL','SF','PHI','DAL','DET','CIN','MIA','LAR',
               'GB','SEA','MIN','NYJ','PIT','TEN','HOU','ATL','NO','TB',
               'DEN','LAC','CLE','IND','CHI','NE','NYG','WAS','ARI','CAR','LV','JAX'];

  // Point value options: Regular(1), Deuce(2), Trey-underdog(3)
  var pointOptions = [1,1,1,1,1,1,1,2,2,3]; // 70% Regular, 20% Deuce, 10% Trey

  var rows    = [];
  var pickId  = picksSheet.getLastRow(); // start IDs after existing rows

  // Deterministic pseudo-random using a simple hash so results are consistent
  var seed = 42;
  function rand() {
    seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
    return seed / 0x7fffffff;
  }

  for (var week = 1; week <= 6; week++) {
    players.forEach(function(name) {
      // ~80% chance player submitted a pick
      if (rand() < 0.20) return; // no pick this week → will count as L in standings

      var team   = teams[Math.floor(rand() * teams.length)];
      var pts    = pointOptions[Math.floor(rand() * pointOptions.length)];
      var r      = rand();
      var result, earned;

      if (r < 0.55)      { result = 'W'; earned = pts; }   // 55% win
      else if (r < 0.95) { result = 'L'; earned = 0; }     // 40% loss
      else               { result = 'T'; earned = pts; }   // 5% tie

      rows.push([pickId++, season, week, name, team, earned, new Date().toISOString(), result]);
    });
  }

  if (rows.length > 0) {
    picksSheet.getRange(picksSheet.getLastRow() + 1, 1, rows.length, 8).setValues(rows);
  }

  Logger.log('✅ Seeded ' + rows.length + ' picks for ' + players.length + ' players across weeks 1-6.');
}
