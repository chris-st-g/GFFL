/**
 * Setup.gs — One-time initialization + sample data
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
  var props    = PropertiesService.getScriptProperties();
  var existing = props.getProperty('SHEET_ID');

  if (existing) {
    Logger.log('⚠️  SHEET_ID already set: ' + existing);
    Logger.log('Sheet URL: https://docs.google.com/spreadsheets/d/' + existing);
    Logger.log('Run resetSetup() first if you want to start over.');
    return;
  }

  var ss = SpreadsheetApp.create('GFFL');
  Logger.log('✅ Created spreadsheet: ' + ss.getUrl());

  // Config tab (renames the default Sheet1)
  var configSheet = ss.getActiveSheet();
  configSheet.setName('Config');
  configSheet.getRange(1, 1, 1, 2).setValues([['Key', 'Value']]);
  configSheet.getRange(1, 1, 1, 2).setFontWeight('bold');
  seedConfig(configSheet);

  // Players tab
  var playersSheet = ss.insertSheet('Players');
  playersSheet.getRange(1, 1, 1, 5).setValues([['PlayerID', 'Name', 'Conference', 'Division', 'IsRookie']]);
  playersSheet.getRange(1, 1, 1, 5).setFontWeight('bold');

  // Picks tab
  var picksSheet = ss.insertSheet('Picks');
  picksSheet.getRange(1, 1, 1, 8).setValues([['PickID', 'Season', 'Week', 'PlayerName', 'TeamAbbr', 'PointsEarned', 'Timestamp', 'Result']]);
  picksSheet.getRange(1, 1, 1, 8).setFontWeight('bold');

  // BonusPoints tab
  var bonusSheet = ss.insertSheet('BonusPoints');
  bonusSheet.getRange(1, 1, 1, 7).setValues([['BonusID', 'Season', 'Week', 'PlayerName', 'Points', 'Reason', 'Timestamp']]);
  bonusSheet.getRange(1, 1, 1, 7).setFontWeight('bold');

  props.setProperty('SHEET_ID', ss.getId());
  Logger.log('✅ SHEET_ID saved to PropertiesService');
  Logger.log('✅ Setup complete! Now run seedSampleLeague(). Sheet: ' + ss.getUrl());
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

// ─── Sample League Data ───────────────────────────────────────────────────────
//
// PLACEHOLDER roster. Nicknames are sample data — rename/add/move any time by
// editing the Players sheet (or just ask Claude). Division keys must match the
// divisions declared in LEAGUE_STRUCTURE (Sheets.gs).

var SAMPLE_ROSTERS = {
  Wiseman:    ['Team Queen', 'Legend', 'Dusty Bottoms', 'Skyline Wednesdays', 'Teach', 'St. Gator', 'Flash', 'Team Carolina', 'Otto', 'O.T.', 'Invinnie'],
  Moeller:    ['CollaR', 'Bug', 'Knight Time', 'Gilligan', 'Shaka', 'Chips', 'Gurge', 'Knife', 'Big Red', 'Swamp Fox', 'Aquaman'],
  Halpin:     ['Mowgli', 'First Lady', 'Bomber', 'Lone Ranger', 'Pearl', 'Golden Bear', 'SCStG', "Lil' Peanut", 'Globetrotter', 'El Guapa', 'LouHoo'],
  Altenau:    ['Sugar', 'Preacher', 'T3', 'NavyBaby', 'Dominator', 'Roo', "Lil' Bear", 'Relax', 'Ellrish', 'REMBO', 'Barracuda'],
  Gunning:    ['Belle', 'Heimlich', 'Tater', 'Team Loveland', 'Team Fleur-de-lis', 'Team Snoqualmie', 'Sweet T', 'Fairy Godmother', 'Danger Boy', 'Crazy Legs'],
  Buchanan:   ['Spellcheck', 'Marsh Madness', 'Lady Wolverine', 'Team Gyrenes', 'Team Firecrackers', 'MarBear', 'Ti Eagle', 'Snow White', 'JuJu Bean'],
  Kensington: ['Royal Flush', 'The Duke', 'Crown Jewel', 'Big Ben', 'Tea Time', 'Redcoat', 'Windsor', 'Paddington'],
  Thornbury:  ['Bramble', 'Thistle', 'Ironwood', 'Wren', 'Foxglove', 'Hollyhock', 'Sparrow', 'Nettle']
};

// A handful of rookies per conference so Rookie-of-the-Year has data to rank.
var SAMPLE_ROOKIES = ['Otto', 'Aquaman', 'LouHoo', 'Barracuda', 'Crazy Legs', 'JuJu Bean', 'Paddington', 'Nettle'];

/**
 * Seeds the Players sheet with the sample league following LEAGUE_STRUCTURE.
 * Safe to run multiple times — skips nicknames that already exist.
 */
function seedSampleLeague() {
  var sheet    = getLeagueSheet().getSheetByName('Players');
  var existing = getPlayerNames();
  var rookies  = {};
  SAMPLE_ROOKIES.forEach(function(n) { rookies[n] = true; });

  var added = 0;
  LEAGUE_STRUCTURE.forEach(function(conf) {
    conf.divisions.forEach(function(division) {
      var names = SAMPLE_ROSTERS[division] || [];
      names.forEach(function(name) {
        if (existing.indexOf(name) !== -1) return;
        var nextId = sheet.getLastRow();
        sheet.appendRow([nextId, name, conf.conference, division, rookies[name] === true]);
        existing.push(name);
        added++;
      });
    });
  });

  Logger.log('✅ Seeded ' + added + ' grahamchises. Total: ' + getPlayerNames().length);
}

/**
 * Clears all grahamchise rows (keeps header), resets headers to 5 columns.
 */
function clearPlayersSheet() {
  var sheet = getLeagueSheet().getSheetByName('Players');
  sheet.getRange(1, 1, 1, 5).setValues([['PlayerID', 'Name', 'Conference', 'Division', 'IsRookie']]);
  sheet.getRange(1, 1, 1, 5).setFontWeight('bold');
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.deleteRows(2, lastRow - 1);
}

/**
 * Real chapter rosters (Nickname = display name), keyed by conference then
 * division. Source: the family's Weekly Picks & Standings sheets. Mt. Washington
 * is still the sample roster (not yet provided).
 */
var REAL_ROSTERS = {
  // Placeholder roster until the real Mt. Washington names are provided.
  'Mt. Washington Chapter': {
    'Wiseman': ['MtW Alpha', 'MtW Bravo', 'MtW Charlie', 'MtW Delta', 'MtW Echo'],
    'Moeller': ['MtW Foxtrot', 'MtW Golf', 'MtW Hotel', 'MtW India', 'MtW Juliet']
  },
  'Louisville Chapter': {
    'IRISH Muskie-Tigers': ['Hank', 'Legend', 'Glide', 'Giligan', 'Coach Oeaux', 'Ellrish'],
    'Lioness':             ['LorenaRadina', 'Teach', 'GuateMary', 'Knight Time', 'Fleaux'],
    'Mustang':             ['Boomer', 'Preacher', 'Lone Ranger', 'Crockett', 'Hat Trick', 'NavyBaby', 'T3'],
    'Valkyrie':            ['Pearl', 'Little Flower', 'Roux', 'Light-Time', 'Bayou Baby']
  },
  'St. Gertrude Chapter': {
    'Navy Flyer': ['Fairway', 'Dusty Bottoms', 'Invinnie', 'Urban', 'Lego'],
    'Noodles':    ['Road Rage', 'Flash', 'Otto', 'Condi', 'Bean'],
    'Grace':      ['El Guapa', 'Dominator', 'Striker Queen', 'Anna Banana', 'Noodelette'],
    'Carl':       ['Barracuda', 'Lou Hoo', 'Truckster', 'Carpenter']
  },
  'St. George Chapter': {
    'St. George': ['O.T.', 'Shaka', 'Snow White', 'Globetrotter', 'Dip', 'Valley Girl'],
    'Rogers':     ['CollaR', 'St. Gator', 'Sweet T', 'Relax', "Lil' Peanut", 'Colonel'],
    'Graham':     ['Ti Eagle', 'Danger Boy', 'Big Red', 'Golden Hour', "Lil' Bear", 'SCStG'],
    'Moeller':    ['Knife Hands', 'Crazy Legs', 'Chips', 'Golden Bear', 'Pope', 'GK Cheeserton']
  }
};

/**
 * Family groupings (an alternative to Division in the pick-name flow), ordered.
 * Keyed by conference. Members are player nicknames. Only chapters listed here
 * get family grouping; others fall back to division grouping in the UI.
 */
var FAMILIES = {
  'St. George Chapter': [
    { family: 'Micah',    members: ['O.T.', 'St. Gator', "Lil' Bear", 'Golden Bear', "Lil' Peanut"] },
    { family: 'Tom',      members: ['Knife Hands', 'Big Red', 'Globetrotter', 'Relax', 'SCStG', 'Colonel'] },
    { family: 'Connor',   members: ['Shaka', 'Chips', 'Dip', 'Pope'] },
    { family: 'Chris',    members: ['Danger Boy', 'Sweet T', 'Valley Girl', 'GK Cheeserton'] },
    { family: 'Dad',      members: ['Ti Eagle', 'Snow White'] },
    { family: 'Siblings', members: ['CollaR', 'Golden Hour', 'Crazy Legs'] }
  ]
};

/** The family a player belongs to, or '' if none. */
function familyOf(conference, name) {
  var fams = FAMILIES[conference];
  if (!fams) return '';
  for (var i = 0; i < fams.length; i++) {
    if (fams[i].members.indexOf(name) !== -1) return fams[i].family;
  }
  return '';
}

/**
 * Ordered family names for a conference, derived from the Players sheet's Family
 * column. Preserves the legacy FAMILIES order for chapters that had one, then
 * appends any newer families alphabetically. Empty if the chapter has no families.
 */
function familiesForConference(conference) {
  var present = {};
  getPlayersByConference(conference).forEach(function(p) { if (p.family) present[p.family] = true; });
  var ordered = [];
  var legacy = FAMILIES[conference];
  if (legacy) {
    legacy.forEach(function(f) { if (present[f.family]) { ordered.push(f.family); delete present[f.family]; } });
  }
  Object.keys(present).sort().forEach(function(f) { ordered.push(f); });
  return ordered;
}

/**
 * One-time migration: ensures the Players sheet has a Family column (F) and
 * backfills each blank Family cell from the legacy FAMILIES map. Idempotent.
 * @returns {number} how many rows were backfilled
 */
function migrateAddFamilyColumn() {
  var sheet = getLeagueSheet().getSheetByName('Players');
  var data  = sheet.getDataRange().getValues();
  var header = data[0] || [];
  if (header.length < 6 || header[5] !== 'Family') {
    sheet.getRange(1, 6).setValue('Family').setFontWeight('bold');
  }
  var backfilled = 0;
  for (var i = 1; i < data.length; i++) {
    if (!data[i][1]) continue;
    var cur = data[i][5];
    if (cur === undefined || cur === null || cur === '') {
      var f = familyOf(data[i][2] || '', data[i][1]);
      if (f) { sheet.getRange(i + 1, 6).setValue(f); backfilled++; }
    }
  }
  return backfilled;
}

/**
 * Route (?action=realroster): replaces the sample roster for the chapters in
 * REAL_ROSTERS with the real Grahamchises (by nickname). Leaves other chapters
 * (Mt. Washington) untouched. Also drops any picks that referenced removed names.
 */
function runRealRosterRoute() {
  var log = [];
  try {
    var targets = Object.keys(REAL_ROSTERS);

    // Set of all incoming nicknames (so sample names that collide are removed too).
    var incoming = {};
    targets.forEach(function(conf) {
      var divs = REAL_ROSTERS[conf];
      Object.keys(divs).forEach(function(div) {
        divs[div].forEach(function(n) { incoming[n] = true; });
      });
    });

    // 1) Remove existing players in the target chapters OR any leftover sample
    //    player whose name collides with an incoming nickname.
    var pl = getLeagueSheet().getSheetByName('Players');
    var data = pl.getDataRange().getValues();
    var header = data[0];
    var keep = [header];
    for (var i = 1; i < data.length; i++) {
      var conf = String(data[i][2]), name = String(data[i][1]);   // col2=Conference, col1=Name
      if (targets.indexOf(conf) === -1 && !incoming[name]) keep.push(data[i]);
    }
    pl.clearContents();
    pl.getRange(1, 1, keep.length, header.length).setValues(keep);
    log.push('Cleared target chapters + colliding sample names.');

    // 2) Add the real rosters.
    var added = 0, skipped = [];
    targets.forEach(function(conf) {
      var divs = REAL_ROSTERS[conf];
      Object.keys(divs).forEach(function(div) {
        divs[div].forEach(function(nick) {
          var r = addPlayer(nick, conf, div, false);
          if (r.success) added++; else skipped.push(nick + ' (' + r.message + ')');
        });
      });
    });
    log.push('Added ' + added + ' grahamchises.');
    if (skipped.length) log.push('Skipped: ' + skipped.join('; '));

    var html = '<h2 style="font-family:sans-serif;color:#14265C">Rosters updated</h2>' +
      '<ul style="font-family:sans-serif;line-height:1.5">' + log.map(function(l){return '<li>'+l+'</li>';}).join('') + '</ul>';
    return HtmlService.createHtmlOutput(html);
  } catch (err) {
    return HtmlService.createHtmlOutput('<h2 style="font-family:sans-serif;color:#C8202F">Roster error</h2><p style="font-family:sans-serif">' + err.message + '</p>');
  }
}

/**
 * Clears all picks for a given season (keeps header and other seasons).
 * @param {number} season
 */
function clearPicksForSeason(season) {
  var sheet  = getLeagueSheet().getSheetByName('Picks');
  var data   = sheet.getDataRange().getValues();
  var header = data[0];
  var keep   = [header];
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] != season) keep.push(data[i]);
  }
  sheet.clearContents();
  sheet.getRange(1, 1, keep.length, header.length).setValues(keep);
}

/**
 * Removes all bonus rows for a season from both bonus sheets (zeroes bonus points).
 * GameTeamBonuses: Season in col 0. BonusPoints: Season in col 1.
 * @param {number} season
 */
function clearBonusesForSeason(season) {
  [['GameTeamBonuses', 0], ['BonusPoints', 1]].forEach(function(pair) {
    var sheet = getLeagueSheet().getSheetByName(pair[0]);
    if (!sheet) return;
    var col  = pair[1];
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return;
    var keep = [data[0]];
    for (var i = 1; i < data.length; i++) {
      if (data[i][col] != season) keep.push(data[i]);
    }
    sheet.clearContents();
    sheet.getRange(1, 1, keep.length, data[0].length).setValues(keep);
  });
}

/**
 * Live-test route (?action=livetest): flips the app to LIVE auto mode against the
 * real current NFL slate and zeroes all points (clears picks + bonuses for the
 * detected season). Use this to test auto week-advance and the picks-open/unlock
 * window end-to-end. Shared Config affects BOTH deployments.
 */
function runLiveTestRoute() {
  var log = [];
  try {
    if (getPlayerNames().length === 0) { seedSampleLeague(); log.push('✅ Sample league seeded'); }

    setConfig('AutoWeek', 'TRUE');
    log.push('✅ Automatic Week ON');

    var c      = espnCurrent();
    var season = c ? c.season : (Number(getConfig('Season')) || 2026);
    setConfig('Season', season);     // fallback only; auto mode reads ESPN live

    clearPicksForSeason(season);
    clearBonusesForSeason(season);
    log.push('✅ Zeroed all points — picks & bonuses cleared for ' + season);

    var typeName = c ? (c.seasonType === 1 ? 'Preseason' : (c.seasonType === 3 ? 'Postseason' : 'Regular Season')) : '?';
    var detected = c ? (typeName + ', Week ' + c.week + ' (' + c.season + ')') : 'ESPN unavailable — check later';
    log.push('📡 ESPN reports current: <strong>' + detected + '</strong>');
    log.push('The app now follows ESPN automatically — when the NFL rolls to the next week, it appears here and picks unlock ~24h after the prior week\'s last game.');

    var html = '<h2 style="font-family:sans-serif;color:#14265C">Live test armed</h2>' +
      '<ul style="font-family:sans-serif;line-height:1.5">' + log.map(function(l){return '<li>'+l+'</li>';}).join('') + '</ul>' +
      '<p style="font-family:sans-serif">Open the app — you should see the live slate above with points at zero.</p>';
    return HtmlService.createHtmlOutput(html);
  } catch (err) {
    return HtmlService.createHtmlOutput('<h2 style="font-family:sans-serif;color:#C8202F">Live test error</h2><p style="font-family:sans-serif">' + err.message + '</p>');
  }
}

/**
 * Bonus admin route (?action=bonusadmin) — JSON API used by the GFFL-bonus skill to
 * review / add / clear / manage bonuses without the interactive commissioner login.
 * Never touches picks or players. Returns JSON.
 *
 * Two bonus kinds (see the skill for the full model):
 *   • TEAM bonuses  (GameTeamBonuses sheet) — the normal case. Extra points on a team
 *     this week; applies to whoever picks that team. Scope = LEAGUE or a chapter name.
 *   • PLAYER bonuses (BonusPoints sheet) — RARE. Flat points to one Grahamchise.
 *
 * Ops (all scoped to the ESPN-active season; team ops default to the active week):
 *   op=list                                            → all team + player bonuses this season
 *   op=clear   [kind=all|team|player]                  → delete season bonus rows (default all)
 *   op=addteam    game=&team=&points=&scope=&week=     → set/replace a team bonus (points>0)
 *   op=removeteam game=&team=&scope=&week=             → delete one team bonus
 *   op=addplayer  player=&points=&reason=&week=        → add a rare per-player bonus
 */
function runBonusAdminRoute(e) {
  var p      = (e && e.parameter) || {};
  var op     = String(p.op || 'list').toLowerCase();
  var season = getActiveSeason();
  var week   = p.week ? Number(p.week) : getActiveWeek();
  var out    = { ok: true, op: op, season: season, week: week };

  try {
    if (op === 'list') {
      out.teamBonuses   = readTeamBonusRows_(season);
      out.playerBonuses = getBonusPoints(season);

    } else if (op === 'clear') {
      var kind = String(p.kind || 'all').toLowerCase();
      out.cleared = {};
      if (kind === 'all' || kind === 'team')   out.cleared.team   = clearSheetSeason_('GameTeamBonuses', 0, season);
      if (kind === 'all' || kind === 'player') out.cleared.player = clearSheetSeason_('BonusPoints', 1, season);

    } else if (op === 'addteam') {
      var team = String(p.team || ''), gameId = String(p.game || '');
      var scope = String(p.scope || 'LEAGUE'), pts = Number(p.points);
      if (scope !== 'LEAGUE' && getConferenceNames().indexOf(scope) === -1) throw new Error('Invalid scope: ' + scope);
      if (!pts || pts <= 0) throw new Error('Positive points required (use op=removeteam to clear).');
      var games = getWeeklyMatchups(week, season), g = null;
      for (var i = 0; i < games.length; i++) { if (String(games[i].gameId) === gameId) { g = games[i]; break; } }
      if (!g) throw new Error('Game ' + gameId + ' not found in week ' + week + '.');
      if (g.homeAbbr !== team && g.awayAbbr !== team) throw new Error(team + ' is not in game ' + gameId + '.');
      setTeamBonus(season, week, scope, gameId, team, pts);
      out.added = { type: 'team', team: team, gameId: gameId, scope: scope, week: week, points: pts, gameStarted: !!g.locked };

    } else if (op === 'removeteam') {
      var rteam = String(p.team || ''), rgame = String(p.game || ''), rscope = String(p.scope || 'LEAGUE');
      setTeamBonus(season, week, rscope, rgame, rteam, 0);
      out.removed = { type: 'team', team: rteam, gameId: rgame, scope: rscope, week: week };

    } else if (op === 'addplayer') {
      var player = String(p.player || '');
      if (getPlayerNames().indexOf(player) === -1) throw new Error('Player not found: ' + player);
      var ppts = Number(p.points);
      if (!ppts) throw new Error('Non-zero points required.');
      saveBonusPoints(season, week, player, ppts, String(p.reason || ''));
      out.added = { type: 'player', player: player, week: week, points: ppts, reason: String(p.reason || '') };

    } else {
      throw new Error('Unknown op: ' + op + ' (use list|clear|addteam|removeteam|addplayer)');
    }
  } catch (err) {
    out.ok = false;
    out.error = err.message;
  }

  return ContentService.createTextOutput(JSON.stringify(out, null, 1)).setMimeType(ContentService.MimeType.JSON);
}

/** All GameTeamBonuses rows for a season, as objects. */
function readTeamBonusRows_(season) {
  var sheet = getLeagueSheet().getSheetByName('GameTeamBonuses');
  if (!sheet) return [];
  var d = sheet.getDataRange().getValues(), rows = [];
  for (var i = 1; i < d.length; i++) {
    if (d[i][0] == season) {
      rows.push({ week: d[i][1], scope: d[i][2], gameId: d[i][3], team: d[i][4], points: Number(d[i][5]) || 0, timestamp: d[i][6] });
    }
  }
  return rows;
}

/** Deletes all rows for a season from a sheet (season value in column `col`), keeps header. Returns count removed. */
function clearSheetSeason_(name, col, season) {
  var sheet = getLeagueSheet().getSheetByName(name);
  if (!sheet) return 0;
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return 0;
  var keep = [data[0]], removed = 0;
  for (var i = 1; i < data.length; i++) {
    if (data[i][col] == season) removed++; else keep.push(data[i]);
  }
  sheet.clearContents();
  sheet.getRange(1, 1, keep.length, data[0].length).setValues(keep);
  return removed;
}

/**
 * Roster admin route (?action=rosteradmin) — JSON API behind the GFFL-roster skill.
 * Edit grahamchise identity/placement without the interactive commissioner login.
 *
 * Ops:
 *   op=list                                          → all players (incl. family)
 *   op=migrate                                       → ensure/backfill the Family column (run once)
 *   op=rename       old=&new=                        → rename everywhere (cascades Picks + BonusPoints)
 *   op=setfamily    player=&family=                  → set family (empty family= clears it)
 *   op=setdivision  player=&division=                → change division (same conference)
 *   op=move         player=&conference=&division=    → change conference (+ division)
 *   op=setrookie    player=&rookie=true|false        → set rookie flag
 *   op=add          name=&conference=&division=&rookie=&family=
 *   op=remove       player=                          → delete the player's roster row
 */
function runRosterAdminRoute(e) {
  var p  = (e && e.parameter) || {};
  var op = String(p.op || 'list').toLowerCase();
  var out = { ok: true, op: op };
  try {
    if (op === 'list') {
      out.players = getPlayers();

    } else if (op === 'migrate') {
      out.backfilled = migrateAddFamilyColumn();
      out.message = 'Family column ensured; backfilled ' + out.backfilled + ' player(s) from the legacy map.';

    } else if (op === 'rename') {
      var r = renamePlayer(p['old'], p['new']);
      if (!r.success) throw new Error(r.message);
      out.result = r;

    } else if (op === 'setfamily') {
      var r2 = setPlayerFamily(p.player, p.family);
      if (!r2.success) throw new Error(r2.message);
      out.result = r2;

    } else if (op === 'setdivision') {
      if (!p.division) throw new Error('division is required.');
      var conf = getPlayerConference(p.player);
      if (conf && getDivisionsForConference(conf).indexOf(p.division) === -1) {
        out.warning = p.division + ' is not a listed division of ' + conf + '.';
      }
      var r3 = setPlayerDivision(p.player, p.division);
      if (!r3.success) throw new Error(r3.message);
      out.result = r3;

    } else if (op === 'move') {
      if (getConferenceNames().indexOf(p.conference) === -1) throw new Error('Unknown conference: ' + p.conference);
      if (!p.division) throw new Error('division is required when changing conference.');
      if (getDivisionsForConference(p.conference).indexOf(p.division) === -1) {
        out.warning = p.division + ' is not a listed division of ' + p.conference + '.';
      }
      var r4 = movePlayer(p.player, p.conference, p.division);
      if (!r4.success) throw new Error(r4.message);
      out.result = r4;

    } else if (op === 'setrookie') {
      var r5 = updatePlayerRookieStatus(p.player, p.rookie);
      if (!r5.success) throw new Error(r5.message);
      out.result = r5;

    } else if (op === 'add') {
      var r6 = addPlayer(p.name, p.conference, p.division, p.rookie, p.family);
      if (!r6.success) throw new Error(r6.message);
      out.result = r6;

    } else if (op === 'remove') {
      var r7 = removePlayer(p.player);
      if (!r7.success) throw new Error(r7.message);
      out.result = r7;

    } else {
      throw new Error('Unknown op: ' + op + ' (list|migrate|rename|setfamily|setdivision|move|setrookie|add|remove)');
    }
  } catch (err) {
    out.ok = false;
    out.error = err.message;
  }
  return ContentService.createTextOutput(JSON.stringify(out, null, 1)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Pick admin route (?action=pickadmin) — JSON API behind the GFFL-picks skill.
 * View/fix picks and points for any week, bypassing the kickoff lock. Season is the
 * ESPN-active season; week defaults to the active week (override with &week=N).
 *
 * Ops:
 *   op=list      [player=] [week=]                  → picks (all weeks if no week)
 *   op=setpick   player=&team=&week=                → set/replace a pick, IGNORING the
 *                                                     kickoff lock ("apply after games start").
 *                                                     Resets points/result — run op=score after.
 *   op=setpoints player=&week=&points=&result=      → override a pick's points and/or W|L|T
 *   op=score     [week=]                            → (re)score the week (fills blank points, final games)
 *   op=delpick   player=&week=                      → delete a pick row
 */
function runPickAdminRoute(e) {
  var p      = (e && e.parameter) || {};
  var op     = String(p.op || 'list').toLowerCase();
  var season = getActiveSeason();
  var week   = p.week ? Number(p.week) : getActiveWeek();
  var out    = { ok: true, op: op, season: season, week: week };
  try {
    if (op === 'list') {
      var picks = getPicksFromSheet(season, p.week ? week : null);
      if (p.player) picks = picks.filter(function(x) { return x.playerName === p.player; });
      out.picks = picks;

    } else if (op === 'setpick') {
      var player = p.player || '', team = String(p.team || '').toUpperCase();
      if (getPlayerNames().indexOf(player) === -1) throw new Error('Grahamchise not found: ' + player);
      var games = getWeeklyMatchups(week, season), inWeek = false, started = false;
      for (var i = 0; i < games.length; i++) {
        if (games[i].homeAbbr === team || games[i].awayAbbr === team) { inWeek = true; started = !!games[i].locked; break; }
      }
      if (!inWeek) throw new Error(team + ' is not playing in week ' + week + '.');
      var updated = updatePick(season, week, player, team);
      if (!updated) savePick(season, week, player, team);
      out.result = {
        player: player, week: week, team: team, mode: updated ? 'updated' : 'created', gameStarted: started,
        note: 'Points/result were reset to blank — run op=score once the game is final, or set them with op=setpoints.'
      };

    } else if (op === 'setpoints') {
      if (getPlayerNames().indexOf(p.player) === -1) throw new Error('Grahamchise not found: ' + p.player);
      var pts = (p.points === undefined || p.points === '') ? null : Number(p.points);
      var res = (p.result === undefined || p.result === '') ? null : String(p.result).toUpperCase();
      if (res !== null && ['W', 'L', 'T'].indexOf(res) === -1) throw new Error('result must be W, L, or T.');
      if (pts === null && res === null) throw new Error('Provide points and/or result.');
      var ok = setPickPointsResult(season, week, p.player, pts, res);
      if (!ok) throw new Error('No pick for ' + p.player + ' in week ' + week + ' (create one with op=setpick first).');
      out.result = { player: p.player, week: week, points: pts, result: res };

    } else if (op === 'score') {
      scoreWeekPicks(season, week);
      out.result = { message: 'Scored week ' + week + '.' };
      out.picks = getPicksFromSheet(season, week);

    } else if (op === 'delpick') {
      if (!deletePick(season, week, p.player)) throw new Error('No pick for ' + p.player + ' in week ' + week + '.');
      out.result = { player: p.player, week: week, deleted: true };

    } else if (op === 'clearall') {
      var before = getPicksFromSheet(season, null).length;
      clearPicksForSeason(season);
      out.result = { cleared: before, message: 'Cleared all ' + before + ' pick(s) for season ' + season + '.' };

    } else if (op === 'ensurecols') {
      // Label the SeasonType header (col I) added for preseason exclusion.
      var psheet = getLeagueSheet().getSheetByName('Picks');
      var hdr = psheet.getRange(1, 9).getValue();
      if (hdr !== 'SeasonType') psheet.getRange(1, 9).setValue('SeasonType');
      out.result = { header: 'SeasonType', wasBlank: hdr !== 'SeasonType' };

    } else {
      throw new Error('Unknown op: ' + op + ' (list|setpick|setpoints|score|delpick|clearall|ensurecols)');
    }
  } catch (err) {
    out.ok = false;
    out.error = err.message;
  }
  return ContentService.createTextOutput(JSON.stringify(out, null, 1)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Wipes players + picks, re-seeds the sample league, and seeds random picks for
 * weeks 1-6 so standings have data. Triggered via ?action=reseed.
 */
function runReseedRoute() {
  var log = [];
  try {
    clearPlayersSheet();
    log.push('✅ Players sheet cleared and headers reset');

    seedSampleLeague();
    log.push('✅ Sample league seeded (4 conferences × 2 divisions)');

    setConfig('CurrentWeek', 7);
    log.push('✅ Current week set to 7 (weeks 1–6 history, week 7 open)');

    var season = Number(getConfig('Season')) || 2025;
    clearPicksForSeason(season);
    log.push('✅ Picks sheet cleared');

    seedRandomPicks();
    log.push('✅ Random picks seeded for weeks 1–6');

    var html = '<h2 style="font-family:sans-serif;color:#14265C">Reseed Complete!</h2>' +
      '<ul style="font-family:sans-serif">' +
      log.map(function(l) { return '<li>' + l + '</li>'; }).join('') + '</ul>';
    return HtmlService.createHtmlOutput(html);
  } catch (err) {
    var errHtml = '<h2 style="font-family:sans-serif;color:#C8202F">Reseed Error</h2>' +
      '<p style="font-family:sans-serif">' + err.message + '</p>' +
      '<ul style="font-family:sans-serif">' +
      log.map(function(l) { return '<li>' + l + '</li>'; }).join('') + '</ul>';
    return HtmlService.createHtmlOutput(errHtml);
  }
}

/**
 * Demo route (?action=demo): sets the app to mid-season 2025 (manual Week 6) and
 * seeds standings data for Weeks 1–5. Uses real ESPN data (Week 6 2025 games are
 * final/locked). Lets you tour the standings/UI with populated data.
 */
function runDemoRoute() {
  var log = [];
  try {
    if (getPlayerNames().length === 0) { seedSampleLeague(); log.push('✅ Sample league seeded'); }
    setConfig('Season', 2025);
    setConfig('CurrentWeek', 6);
    setConfig('AutoWeek', 'FALSE');   // demo pins Week 6 — never live-detect
    log.push('✅ Season 2025, Week 6, AutoWeek OFF');

    clearPicksForSeason(2025);
    seedRandomPicks(5);            // Weeks 1–5 completed; Week 6 left open to pick
    log.push('✅ Standings seeded through Week 5');

    var html = '<h2 style="font-family:sans-serif;color:#14265C">Demo ready — 2025, Week 6</h2>' +
      '<ul style="font-family:sans-serif">' + log.map(function(l){return '<li>'+l+'</li>';}).join('') + '</ul>' +
      '<p style="font-family:sans-serif">Open the app and try Make Your Picks (Week 6 games are pickable) and See Leaderboard.</p>';
    return HtmlService.createHtmlOutput(html);
  } catch (err) {
    return HtmlService.createHtmlOutput('<h2 style="font-family:sans-serif;color:#C8202F">Demo error</h2><p style="font-family:sans-serif">' + err.message + '</p>');
  }
}

/**
 * Clears the saved Sheet ID so setupSheet() can run again.
 * WARNING: Does NOT delete the existing spreadsheet.
 */
function resetSetup() {
  PropertiesService.getScriptProperties().deleteProperty('SHEET_ID');
  Logger.log('SHEET_ID cleared. Run setupSheet() to create a new sheet.');
}

/**
 * Utility: logs the current Sheet ID and URL.
 */
function logSheetUrl() {
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) {
    Logger.log('No SHEET_ID set. Run setupSheet() first.');
  } else {
    Logger.log('Sheet URL: https://docs.google.com/spreadsheets/d/' + id);
  }
}

/**
 * Idempotent migration for an existing sheet: ensures Players has the
 * Conference/Division/IsRookie headers (col C/D/E) and Picks has Result (col H).
 * Safe to run multiple times.
 */
function migrateSchema() {
  var players = getLeagueSheet().getSheetByName('Players');
  var pHeader = players.getRange(1, 1, 1, 5).getValues()[0];
  if (pHeader[2] !== 'Conference') {
    players.getRange(1, 3, 1, 3).setValues([['Conference', 'Division', 'IsRookie']]);
    players.getRange(1, 3, 1, 3).setFontWeight('bold');
    Logger.log('✅ Players headers updated to Conference/Division/IsRookie.');
  }

  var picks = getLeagueSheet().getSheetByName('Picks');
  if (picks.getRange(1, 8).getValue() !== 'Result') {
    picks.getRange(1, 8).setValue('Result');
    Logger.log('✅ Result column added to Picks sheet.');
  }
}

/**
 * Seeds random picks for seeded grahamchises, weeks 1-6, with pre-filled results,
 * so standings have something to display. Test-only — does NOT call ESPN.
 * Clears existing picks for the season first.
 */
function seedRandomPicks(maxWeek) {
  maxWeek = maxWeek || 6;
  var picksSheet = getLeagueSheet().getSheetByName('Picks');
  var season     = Number(getConfig('Season')) || 2025;
  var players    = getPlayerNames();

  var data = picksSheet.getDataRange().getValues();
  var rowsToKeep = [data[0]];
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] != season) rowsToKeep.push(data[i]);
  }
  picksSheet.clearContents();
  picksSheet.getRange(1, 1, rowsToKeep.length, rowsToKeep[0].length).setValues(rowsToKeep);

  var teams = ['KC','BUF','BAL','SF','PHI','DAL','DET','CIN','MIA','LAR',
               'GB','SEA','MIN','NYJ','PIT','TEN','HOU','ATL','NO','TB',
               'DEN','LAC','CLE','IND','CHI','NE','NYG','WAS','ARI','CAR','LV','JAX'];
  var pointOptions = [1,1,1,1,1,1,1,2,2,3];

  var rows   = [];
  var pickId = picksSheet.getLastRow();

  // Deterministic pseudo-random so reseeds are reproducible.
  var seed = 42;
  function rand() {
    seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
    return seed / 0x7fffffff;
  }

  for (var week = 1; week <= maxWeek; week++) {
    players.forEach(function(name) {
      if (rand() < 0.20) return;               // ~80% submitted
      var team = teams[Math.floor(rand() * teams.length)];
      var pts  = pointOptions[Math.floor(rand() * pointOptions.length)];
      var r    = rand();
      var result, earned;
      if (r < 0.55)      { result = 'W'; earned = pts; }
      else if (r < 0.95) { result = 'L'; earned = 0; }
      else               { result = 'T'; earned = pts / 2; }   // tie = half points
      rows.push([pickId++, season, week, name, team, earned, new Date().toISOString(), result]);
    });
  }

  if (rows.length > 0) {
    picksSheet.getRange(picksSheet.getLastRow() + 1, 1, rows.length, 8).setValues(rows);
  }
  Logger.log('✅ Seeded ' + rows.length + ' picks across weeks 1-6.');
}
