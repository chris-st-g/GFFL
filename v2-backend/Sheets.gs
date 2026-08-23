/**
 * Sheets.gs — All Google Sheets read/write operations
 *
 * Sheet ID is stored in PropertiesService — never hardcoded.
 * Run Setup.gs > setupSheet() once to create the sheet and save the ID.
 *
 * Sheet tabs:
 *   Config      — key/value league settings
 *   Players     — Grahamchise nickname + conference/division/rookie status
 *   Picks       — one row per weekly pick
 *   BonusPoints — commissioner-applied bonus points
 */

// ─── League Structure ─────────────────────────────────────────────────────────
//
// The ordered source of truth for conferences and their divisions. Display order
// in standings/pick flow follows this order. To add/rename/move divisions, edit
// here (and move grahamchises via the Players sheet's Conference/Division cells).
// Each conference holds 2–4 divisions.

var LEAGUE_STRUCTURE = [
  { conference: 'Mt. Washington Chapter', divisions: ['Wiseman', 'Moeller'] },
  { conference: 'Louisville Chapter',     divisions: ['IRISH Muskie-Tigers', 'Lioness', 'Mustang', 'Valkyrie'] },
  { conference: 'St. Gertrude Chapter',   divisions: ['Navy Flyer', 'Noodles', 'Grace', 'Carl'] },
  { conference: 'St. George Chapter',     divisions: ['St. George', 'Rogers', 'Graham', 'Moeller'] }
];

/** Ordered list of conference names. */
function getConferenceNames() {
  return LEAGUE_STRUCTURE.map(function(c) { return c.conference; });
}

/** Ordered list of division names for a given conference (empty if unknown). */
function getDivisionsForConference(conference) {
  var found = LEAGUE_STRUCTURE.filter(function(c) { return c.conference === conference; })[0];
  return found ? found.divisions.slice() : [];
}

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

/**
 * Returns a sheet by name, creating it with the given headers if missing.
 * @param {string} name
 * @param {string[]} headers
 * @returns {Sheet}
 */
function getOrCreateSheet(name, headers) {
  var ss = getLeagueSheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return sh;
}

// ─── Team Bonuses (per team, scoped to the League or a single conference) ─────
//
// Scope = 'LEAGUE' (applies to everyone who picks the team) or a conference name
// (applies only to that conference's pickers). A pick's total bonus for a team =
// LEAGUE bonus + that picker's-conference bonus (additive).

var TEAM_BONUS_HEADERS = ['Season', 'Week', 'Scope', 'GameId', 'TeamAbbr', 'Bonus', 'Timestamp'];

/**
 * Returns all bonuses for a season/week as { league:{team:pts}, conf:{confName:{team:pts}} }.
 */
function getBonusData(season, week) {
  var sheet = getOrCreateSheet('GameTeamBonuses', TEAM_BONUS_HEADERS);
  var data  = sheet.getDataRange().getValues();
  var res = { league: {}, conf: {} };
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] == season && data[i][1] == week) {
      var scope = String(data[i][2] || 'LEAGUE');
      var team  = String(data[i][4]);
      var pts   = Number(data[i][5]) || 0;
      if (scope === 'LEAGUE') res.league[team] = pts;
      else (res.conf[scope] = res.conf[scope] || {})[team] = pts;
    }
  }
  return res;
}

/**
 * Total bonus applied to a team for a picker in the given conference.
 * @param {object} bonusData - from getBonusData
 * @param {string} team
 * @param {string|null} conference
 * @returns {number}
 */
function teamBonusFor(bonusData, team, conference) {
  var b = bonusData.league[team] || 0;
  if (conference && bonusData.conf[conference]) b += (bonusData.conf[conference][team] || 0);
  return b;
}

/**
 * Sets (or clears, when bonus <= 0) the bonus for one team at one scope this week.
 * @param {number} season
 * @param {number} week
 * @param {string} scope    - 'LEAGUE' or a conference name
 * @param {string} gameId
 * @param {string} teamAbbr
 * @param {number} bonus
 */
function setTeamBonus(season, week, scope, gameId, teamAbbr, bonus) {
  var sheet = getOrCreateSheet('GameTeamBonuses', TEAM_BONUS_HEADERS);
  var data  = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] == season && data[i][1] == week &&
        String(data[i][2]) === String(scope) && String(data[i][4]) === String(teamAbbr)) {
      if (bonus > 0) {
        sheet.getRange(i + 1, 6).setValue(bonus);
        sheet.getRange(i + 1, 7).setValue(new Date().toISOString());
      } else {
        sheet.deleteRow(i + 1);
      }
      return;
    }
  }
  if (bonus > 0) {
    sheet.appendRow([season, week, scope, gameId, teamAbbr, bonus, new Date().toISOString()]);
  }
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

// ─── Players (Grahamchises) ──────────────────────────────────────────────────

/**
 * Returns all active grahamchises as full objects, sorted alphabetically.
 * Columns: [PlayerID, Name, Conference, Division, IsRookie, Family]
 * Family is read from column F; for rows predating the Family column (blank), it
 * falls back to the legacy FAMILIES map. Run rosteradmin op=migrate to backfill.
 * @returns {Array<{playerId, name, conference, division, isRookie, family}>}
 */
function getPlayers() {
  var sheet = getLeagueSheet().getSheetByName('Players');
  var data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1)
    .filter(function(row) { return row[1]; })
    .map(function(row) {
      // Family is authoritative from column F (migrateAddFamilyColumn backfilled it).
      // Read as-is so an intentionally-blank cell clears the family; no legacy fallback
      // here, or clearing a mapped name would silently re-derive it.
      var fam = (row[5] === undefined || row[5] === null) ? '' : String(row[5]);
      return {
        playerId:   row[0],
        name:       row[1],
        conference: row[2] || '',
        division:   row[3] || '',
        isRookie:   row[4] === true || row[4] === 'TRUE',
        family:     fam
      };
    })
    .sort(function(a, b) { return a.name.localeCompare(b.name); });
}

/**
 * Returns all active grahamchise names, sorted alphabetically.
 * @returns {string[]}
 */
function getPlayerNames() {
  return getPlayers().map(function(p) { return p.name; });
}

/**
 * Returns grahamchises for one conference, sorted alphabetically.
 * @param {string} conference
 * @returns {Array}
 */
function getPlayersByConference(conference) {
  return getPlayers().filter(function(p) { return p.conference === conference; });
}

/** Returns the conference name for a grahamchise, or null. */
function getPlayerConference(name) {
  var p = getPlayers().filter(function(x) { return x.name === name; })[0];
  return p ? p.conference : null;
}

/**
 * Adds a new grahamchise to the Players sheet.
 * @param {string} name
 * @param {string} conference
 * @param {string} division
 * @param {boolean} [isRookie=false]
 * @param {string} [family='']
 * @returns {{ success: boolean, message: string }}
 */
function addPlayer(name, conference, division, isRookie, family) {
  name = (name || '').trim();
  if (!name) return { success: false, message: 'Name cannot be empty.' };
  conference = (conference || '').trim();
  division   = (division || '').trim();
  isRookie   = isRookie === true || isRookie === 'true';
  family     = (family || '').trim();

  var existing = getPlayerNames();
  if (existing.indexOf(name) !== -1) {
    return { success: false, message: name + ' is already in the league.' };
  }

  var sheet  = getLeagueSheet().getSheetByName('Players');
  var nextId = sheet.getLastRow();
  sheet.appendRow([nextId, name, conference, division, isRookie, family]);
  return { success: true, message: name + ' added.' };
}

/**
 * Moves a grahamchise to a different conference and/or division.
 * @param {string} name
 * @param {string} conference
 * @param {string} division
 * @returns {{ success: boolean, message: string }}
 */
function movePlayer(name, conference, division) {
  var sheet = getLeagueSheet().getSheetByName('Players');
  var data  = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === name) {
      sheet.getRange(i + 1, 3).setValue(conference);
      sheet.getRange(i + 1, 4).setValue(division);
      return { success: true, message: name + ' moved to ' + conference + ' / ' + division + '.' };
    }
  }
  return { success: false, message: 'Grahamchise not found: ' + name };
}

/**
 * Updates the rookie status for an existing grahamchise.
 * @param {string} name
 * @param {boolean} isRookie
 * @returns {{ success: boolean, message: string }}
 */
function updatePlayerRookieStatus(name, isRookie) {
  var sheet = getLeagueSheet().getSheetByName('Players');
  var data  = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === name) {
      sheet.getRange(i + 1, 5).setValue(isRookie === true || isRookie === 'true');
      return { success: true, message: name + ' updated.' };
    }
  }
  return { success: false, message: 'Grahamchise not found.' };
}

/**
 * Renames a grahamchise everywhere. Names are the join key, so this cascades the
 * new name across Players, Picks (PlayerName) and BonusPoints (PlayerName) so no
 * history orphans. Family/points/picks are preserved (they live on the same rows).
 * @param {string} oldName
 * @param {string} newName
 * @returns {{ success, message, picksUpdated, bonusUpdated }}
 */
function renamePlayer(oldName, newName) {
  oldName = (oldName || '').trim();
  newName = (newName || '').trim();
  if (!oldName || !newName) return { success: false, message: 'Both old and new names are required.' };
  if (oldName === newName)  return { success: false, message: 'Old and new names are the same.' };

  var names = getPlayerNames();
  if (names.indexOf(oldName) === -1) return { success: false, message: 'Grahamchise not found: ' + oldName };
  if (names.indexOf(newName) !== -1) return { success: false, message: newName + ' already exists.' };

  var ss = getLeagueSheet();
  var pSheet = ss.getSheetByName('Players');
  var pData  = pSheet.getDataRange().getValues();
  for (var i = 1; i < pData.length; i++) {
    if (pData[i][1] === oldName) { pSheet.getRange(i + 1, 2).setValue(newName); break; }
  }
  var picksUpdated = renameInSheet_(ss, 'Picks', 3, oldName, newName);        // PlayerName = col D
  var bonusUpdated = renameInSheet_(ss, 'BonusPoints', 3, oldName, newName);  // PlayerName = col D

  return {
    success: true,
    message: 'Renamed ' + oldName + ' → ' + newName + '.',
    picksUpdated: picksUpdated,
    bonusUpdated: bonusUpdated
  };
}

/** Replaces a name value in `col` (0-based) of a sheet; returns rows changed. */
function renameInSheet_(ss, sheetName, col, oldName, newName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return 0;
  var data = sheet.getDataRange().getValues(), n = 0;
  for (var i = 1; i < data.length; i++) {
    if (data[i][col] === oldName) { sheet.getRange(i + 1, col + 1).setValue(newName); n++; }
  }
  return n;
}

/** Sets a grahamchise's Family (Players col F). Empty string = no family. */
function setPlayerFamily(name, family) {
  var sheet = getLeagueSheet().getSheetByName('Players');
  var data  = sheet.getDataRange().getValues();
  if (data[0].length < 6 || data[0][5] !== 'Family') { sheet.getRange(1, 6).setValue('Family'); }
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === name) {
      sheet.getRange(i + 1, 6).setValue(family || '');
      return { success: true, message: name + ' family set to ' + (family || '(none)') + '.' };
    }
  }
  return { success: false, message: 'Grahamchise not found: ' + name };
}

/** Sets a grahamchise's Division (Players col D) without changing conference. */
function setPlayerDivision(name, division) {
  var sheet = getLeagueSheet().getSheetByName('Players');
  var data  = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === name) {
      sheet.getRange(i + 1, 4).setValue(division);
      return { success: true, message: name + ' division set to ' + division + '.' };
    }
  }
  return { success: false, message: 'Grahamchise not found: ' + name };
}

/** Removes a grahamchise's Players row. Their past picks/bonuses stay in the sheets
 *  but go inert (standings only counts registered players). */
function removePlayer(name) {
  var sheet = getLeagueSheet().getSheetByName('Players');
  var data  = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === name) {
      sheet.deleteRow(i + 1);
      return { success: true, message: name + ' removed.' };
    }
  }
  return { success: false, message: 'Grahamchise not found: ' + name };
}

// ─── Picks ───────────────────────────────────────────────────────────────────

/**
 * Returns picks for a season, optionally filtered by week.
 * Each pick: { pickId, season, week, playerName, teamAbbr, pointsEarned, timestamp, result }
 * pointsEarned is null if game not yet scored.
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
 * Returns the existing pick object for a player this week, or null.
 * @param {number} season
 * @param {number} week
 * @param {string} playerName
 * @returns {object|null}
 */
function getPickForWeek(season, week, playerName) {
  var picks = getPicksFromSheet(season, week);
  return picks.filter(function(p) { return p.playerName === playerName; })[0] || null;
}

/**
 * Returns true if the player already has a pick for this week/season.
 * @param {number} season
 * @param {number} week
 * @param {string} playerName
 * @returns {boolean}
 */
function hasPickForWeek(season, week, playerName) {
  return getPickForWeek(season, week, playerName) !== null;
}

/**
 * Saves a NEW pick to the Picks sheet (appends).
 * Does NOT validate — callers validate first.
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
 * Updates an EXISTING pick's team (used when a player changes their pick before
 * kickoff). Clears any prior scoring. Returns false if no existing row found.
 *
 * @param {number} season
 * @param {number} week
 * @param {string} playerName
 * @param {string} teamAbbr
 * @returns {boolean}
 */
function updatePick(season, week, playerName, teamAbbr) {
  var sheet = getLeagueSheet().getSheetByName('Picks');
  var data  = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] == season && data[i][2] == week && data[i][3] === playerName) {
      sheet.getRange(i + 1, 5).setValue(teamAbbr);                       // TeamAbbr
      sheet.getRange(i + 1, 6).setValue('');                            // PointsEarned (reset)
      sheet.getRange(i + 1, 7).setValue(new Date().toISOString());      // Timestamp
      sheet.getRange(i + 1, 8).setValue('');                            // Result (reset)
      return true;
    }
  }
  return false;
}

/**
 * Manually overrides a pick's PointsEarned (col F) and/or Result (col H) for a
 * given week — commissioner correction. Pass null to leave a field unchanged.
 * @returns {boolean} false if no matching pick row exists.
 */
function setPickPointsResult(season, week, playerName, points, result) {
  var sheet = getLeagueSheet().getSheetByName('Picks');
  var data  = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] == season && data[i][2] == week && data[i][3] === playerName) {
      if (points !== null && points !== undefined && points !== '') sheet.getRange(i + 1, 6).setValue(Number(points));
      if (result !== null && result !== undefined && result !== '')  sheet.getRange(i + 1, 8).setValue(result);
      return true;
    }
  }
  return false;
}

/** Deletes a player's pick row for a week. Returns false if none found. */
function deletePick(season, week, playerName) {
  var sheet = getLeagueSheet().getSheetByName('Picks');
  var data  = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] == season && data[i][2] == week && data[i][3] === playerName) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

/**
 * Scores all pending picks for a completed week.
 * Looks up each pick's team in the ESPN matchup results and writes PointsEarned.
 * Only updates rows where PointsEarned is still blank AND game is final.
 *
 * @param {number} season
 * @param {number} week
 */
function scoreWeekPicks(season, week, useCache) {
  var sheet     = getLeagueSheet().getSheetByName('Picks');
  var allData   = sheet.getDataRange().getValues();
  // Manual scoring forces a fresh ESPN read; auto/on-open scoring rides the shared
  // 120s cache so at most one viewer per window pays the fetch. Winners being up to
  // ~2 min stale is fine — the next open mops up anything missed (idempotent).
  var matchups  = getWeeklyMatchups(week, season, null, null, !useCache);
  var bonusData = getBonusData(season, week);

  // Picker name → conference (for conference-scoped bonuses)
  var confByName = {};
  getPlayers().forEach(function(p) { confByName[p.name] = p.conference; });

  // teamAbbr → { winner, base, completed, isTie }
  var gameMap = {};
  matchups.forEach(function(game) {
    var isTie = game.completed && game.winner === null;
    gameMap[game.homeAbbr] = { winner: game.winner, base: game.homeBasePoints, completed: game.completed, isTie: isTie };
    gameMap[game.awayAbbr] = { winner: game.winner, base: game.awayBasePoints, completed: game.completed, isTie: isTie };
  });

  for (var i = 1; i < allData.length; i++) {
    var row = allData[i];
    var rowSeason = row[1];
    var rowWeek   = row[2];
    var player    = row[3];
    var team      = row[4];
    var earned    = row[5];

    if (rowSeason != season || rowWeek != week) continue;
    if (earned !== '' && earned !== null) continue; // already scored

    var info = gameMap[team];
    if (!info || !info.completed) continue; // game not final yet

    var pointValue = info.base + teamBonusFor(bonusData, team, confByName[player]);
    var points = resolvePickPoints(team, info.winner, pointValue, info.isTie);
    var result = resolvePickResult(team, info.winner, info.isTie);
    sheet.getRange(i + 1, 6).setValue(points);
    sheet.getRange(i + 1, 8).setValue(result);  // column H
  }

  Logger.log('Scored picks for week ' + week + ', ' + season);
}

/**
 * Opportunistic scoring run on app open. Cheap by design:
 *   1. Bails immediately if the active week has no unscored picks — so once a week
 *      is fully scored, every future open does zero extra work (no ESPN call).
 *   2. When there IS work, scores using CACHED matchups (shared 120s window), so at
 *      most one viewer per window pays the ESPN fetch; everyone else rides the cache.
 * Idempotent and self-healing: any game not yet final is simply skipped and picked
 * up on a later open. Failures are swallowed so a scoring hiccup never breaks the
 * standings read.
 */
function autoScoreOnOpen_(season, week) {
  try {
    var picks = getPicksFromSheet(season, week);
    var hasUnscored = picks.some(function(p) { return p.pointsEarned === null; });
    if (!hasUnscored) return;            // nothing to do → no ESPN call, no writes
    scoreWeekPicks(season, week, true);  // true = use cached matchups
  } catch (err) {
    Logger.log('autoScoreOnOpen_ skipped: ' + err);
  }
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
