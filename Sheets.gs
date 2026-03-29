/**
 * Sheets.gs — All Google Sheets read/write operations
 *
 * Sheet ID is stored in PropertiesService — never hardcoded.
 * Run Setup.gs > setupSheet() once to create the sheet and save the ID.
 *
 * Sheet tabs:
 *   Config      — key/value league settings
 *   Players     — Grahamchise names
 *   Picks       — one row per weekly pick
 *   BonusPoints — commissioner-applied bonus points
 */

// ─── Sheet Access ────────────────────────────────────────────────────────────

/**
 * Returns the GFFL spreadsheet object.
 * Throws if SHEET_ID has not been set (run setupSheet() first).
 */
function getLeagueSheet() {
  var sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!sheetId) throw new Error('SHEET_ID not set. Run setupSheet() from Setup.gs first.');
  return SpreadsheetApp.openById(sheetId);
}

// ─── Config ──────────────────────────────────────────────────────────────────

/**
 * Reads a value from the Config sheet by key.
 * @param {string} key
 * @returns {string|number|null}
 */
function getConfig(key) {
  var sheet = getLeagueSheet().getSheetByName('Config');
  var data  = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === key) return data[i][1];
  }
  return null;
}

/**
 * Sets a value in the Config sheet. Updates existing row or appends new one.
 * @param {string} key
 * @param {*} value
 */
function setConfig(key, value) {
  var sheet = getLeagueSheet().getSheetByName('Config');
  var data  = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value]);
}

// ─── Players ─────────────────────────────────────────────────────────────────

/**
 * Returns all active Grahamchise names, sorted alphabetically.
 * @returns {string[]}
 */
function getPlayerNames() {
  var sheet = getLeagueSheet().getSheetByName('Players');
  var data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1)
    .map(function(row) { return row[1]; })
    .filter(Boolean)
    .sort();
}

/**
 * Adds a new player to the Players sheet.
 * @param {string} name
 * @returns {{ success: boolean, message: string }}
 */
function addPlayer(name) {
  name = (name || '').trim();
  if (!name) return { success: false, message: 'Name cannot be empty.' };

  var existing = getPlayerNames();
  if (existing.indexOf(name) !== -1) {
    return { success: false, message: name + ' is already in the league.' };
  }

  var sheet  = getLeagueSheet().getSheetByName('Players');
  var nextId = sheet.getLastRow(); // header = row 1, so lastRow = next id
  sheet.appendRow([nextId, name]);
  return { success: true, message: name + ' added.' };
}

// ─── Picks ───────────────────────────────────────────────────────────────────

/**
 * Returns picks for a season, optionally filtered by week.
 * Each pick: { pickId, season, week, playerName, teamAbbr, pointsEarned, timestamp }
 * pointsEarned is null if game not yet scored, 0 if team lost, N if team won.
 *
 * @param {number} season
 * @param {number|null} week - pass null to get all weeks
 * @returns {Array}
 */
function getPicksFromSheet(season, week) {
  var sheet = getLeagueSheet().getSheetByName('Picks');
  var data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  return data.slice(1)
    .filter(function(row) {
      var seasonMatch = !season || row[1] == season;
      var weekMatch   = (week === null || week === undefined) || row[2] == week;
      return seasonMatch && weekMatch && row[3]; // row[3] = playerName (skip blank rows)
    })
    .map(function(row) {
      var earned = row[5];
      return {
        pickId:       row[0],
        season:       row[1],
        week:         row[2],
        playerName:   row[3],
        teamAbbr:     row[4],
        pointsEarned: (earned === '' || earned === null || earned === undefined) ? null : Number(earned),
        timestamp:    row[6],
        result:       row[7] || null   // 'W', 'L', 'T', or null if pending
      };
    });
}

/**
 * Returns true if the player already has a pick for this week/season.
 * @param {number} season
 * @param {number} week
 * @param {string} playerName
 * @returns {boolean}
 */
function hasPickForWeek(season, week, playerName) {
  var sheet = getLeagueSheet().getSheetByName('Picks');
  var data  = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] == season && data[i][2] == week && data[i][3] === playerName) {
      return true;
    }
  }
  return false;
}

/**
 * Saves a pick to the Picks sheet.
 * Does NOT validate — call hasPickForWeek() and player validation before this.
 *
 * @param {number} season
 * @param {number} week
 * @param {string} playerName
 * @param {string} teamAbbr
 * @returns {{ success: boolean, message: string }}
 */
function savePick(season, week, playerName, teamAbbr) {
  var sheet  = getLeagueSheet().getSheetByName('Picks');
  var nextId = sheet.getLastRow(); // 1-based; header is row 1, so this = next id
  sheet.appendRow([nextId, season, week, playerName, teamAbbr, '', new Date().toISOString(), '']);
  return { success: true, message: 'Pick saved.' };
}

/**
 * Scores all pending picks for a completed week.
 * Looks up each pick's team in the ESPN matchup results and writes PointsEarned.
 * Only updates rows where PointsEarned is still blank AND game is final.
 *
 * @param {number} season
 * @param {number} week
 */
function scoreWeekPicks(season, week) {
  var sheet    = getLeagueSheet().getSheetByName('Picks');
  var allData  = sheet.getDataRange().getValues();
  var matchups = getWeeklyMatchups(week, season);

  // Build a lookup: teamAbbr → { winner, pointValue, completed, isTie }
  var gameMap = {};
  matchups.forEach(function(game) {
    var isTie = game.completed && game.winner === null;
    gameMap[game.homeAbbr] = { winner: game.winner, pointValue: game.homePoints, completed: game.completed, isTie: isTie };
    gameMap[game.awayAbbr] = { winner: game.winner, pointValue: game.awayPoints, completed: game.completed, isTie: isTie };
  });

  for (var i = 1; i < allData.length; i++) {
    var row = allData[i];
    var rowSeason = row[1];
    var rowWeek   = row[2];
    var team      = row[4];
    var earned    = row[5];

    if (rowSeason != season || rowWeek != week) continue;
    if (earned !== '' && earned !== null) continue; // already scored

    var info = gameMap[team];
    if (!info || !info.completed) continue; // game not final yet

    var points = resolvePickPoints(team, info.winner, info.pointValue, info.isTie);
    var result = resolvePickResult(team, info.winner, info.isTie);
    sheet.getRange(i + 1, 6).setValue(points);
    sheet.getRange(i + 1, 8).setValue(result);  // column H
  }

  Logger.log('Scored picks for week ' + week + ', ' + season);
}

// ─── Bonus Points ─────────────────────────────────────────────────────────────

/**
 * Saves a commissioner bonus point entry.
 * @param {number} season
 * @param {number|null} week  - can be null for season-level bonuses
 * @param {string} playerName
 * @param {number} points
 * @param {string} reason
 */
function saveBonusPoints(season, week, playerName, points, reason) {
  var sheet  = getLeagueSheet().getSheetByName('BonusPoints');
  var nextId = sheet.getLastRow();
  sheet.appendRow([nextId, season, week || '', playerName, points, reason, new Date().toISOString()]);
}

/**
 * Returns all bonus point entries for a season.
 * @param {number} season
 * @returns {Array<{ bonusId, season, week, playerName, points, reason, timestamp }>}
 */
function getBonusPoints(season) {
  var sheet = getLeagueSheet().getSheetByName('BonusPoints');
  var data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  return data.slice(1)
    .filter(function(row) { return row[1] == season && row[3]; })
    .map(function(row) {
      return {
        bonusId:    row[0],
        season:     row[1],
        week:       row[2],
        playerName: row[3],
        points:     Number(row[4]) || 0,
        reason:     row[5],
        timestamp:  row[6]
      };
    });
}
