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

/** Ordered family names for a conference (empty if that chapter has none). */
function familiesForConference(conference) {
  var fams = FAMILIES[conference];
  return fams ? fams.map(function(f) { return f.family; }) : [];
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
