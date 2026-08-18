/**
 * GFFL — Graham Family Football League
 * Code.gs — Web app entry point
 */

/**
 * Serves the web app. Called by Google when someone visits the app URL.
 * Special route: ?action=setup runs all one-time setup functions automatically.
 */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';

  if (action === 'setup') {
    return runSetupRoute();
  }

  if (action === 'reseed') {
    return runReseedRoute();
  }

  if (action === 'demo') {
    return runDemoRoute();
  }

  if (action === 'livetest') {
    return runLiveTestRoute();
  }

  if (action === 'realroster') {
    return runRealRosterRoute();
  }

  // JSON API for the GitHub Pages frontend (reads). GET ?action=api&fn=NAME&args=[...]
  if (action === 'api') {
    return apiDispatch_(e);
  }

  // Diagnostic: try several ESPN hosts/headers from Apps Script to find one
  // that isn't IP-blocked.
  if (action === 'espn') {
    var ewk = Number(getConfig('CurrentWeek')), esn = Number(getConfig('Season'));
    var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
    var candidates = [
      { name: 'site.api+UA+referer', url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=' + ewk + '&dates=' + esn,
        opts: { muteHttpExceptions: true, headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Referer': 'https://www.espn.com/', 'Origin': 'https://www.espn.com' } } },
      { name: 'cdn.core', url: 'https://cdn.espn.com/core/nfl/scoreboard?xhr=1&week=' + ewk + '&year=' + esn + '&seasontype=2',
        opts: { muteHttpExceptions: true, headers: { 'User-Agent': UA } } },
      { name: 'sports.core', url: 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/' + esn + '/types/2/weeks/' + ewk + '/events',
        opts: { muteHttpExceptions: true, headers: { 'User-Agent': UA } } }
    ];
    var out = candidates.map(function(c) {
      try {
        var r = UrlFetchApp.fetch(c.url, c.opts);
        var t = r.getContentText();
        var ev = null;
        try { var j = JSON.parse(t); ev = (j.events || (j.content && j.content.sbData && j.content.sbData.events) || j.items || []).length; } catch (x) {}
        return { name: c.name, code: r.getResponseCode(), len: t.length, events: ev, head: t.slice(0, 80) };
      } catch (err) { return { name: c.name, error: err.message }; }
    });
    return ContentService.createTextOutput(JSON.stringify(out, null, 1)).setMimeType(ContentService.MimeType.JSON);
  }

  // Diagnostic: returns this week's matchups as JSON.
  if (action === 'games') {
    var wk = Number(getConfig('CurrentWeek')), sn = Number(getConfig('Season'));
    var g = getWeeklyMatchups(wk, sn);
    return ContentService.createTextOutput(JSON.stringify({
      week: wk, season: sn,
      count: g.length,
      sample: g.slice(0, 2),
      lockedFlags: g.map(function(x){ return x.locked; })
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // Diagnostic: Alma Cup computation as JSON.
  if (action === 'alma') {
    return ContentService.createTextOutput(JSON.stringify(getAlmaCup()))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Diagnostic: returns getLeagueData() as JSON (used to debug the loader).
  if (action === 'data') {
    try {
      return ContentService.createTextOutput(JSON.stringify(getLeagueData()))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Graham Family Football League')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * POST entry point for the GitHub Pages frontend. The browser sends
 * Content-Type: text/plain (a CORS "simple request") so Apps Script — which
 * can't answer a preflight OPTIONS — is never preflighted.
 */
function doPost(e) {
  return apiDispatch_(e);
}

/**
 * Whitelist of backend functions the external frontend may call. Admin ones are
 * self-protected (they require a valid token as their first argument).
 */
function apiFunctions_() {
  return {
    getLeagueData:        getLeagueData,
    getConferencePickData: getConferencePickData,
    getConferencePicks:   getConferencePicks,
    getPickPageData:      getPickPageData,
    submitPick:           submitPick,
    getStandings:        getStandings,
    getAlmaCup:          getAlmaCup,
    adminLogin:          adminLogin,
    setCurrentWeek:      setCurrentWeek,
    triggerWeekScoring:  triggerWeekScoring,
    addBonusPoints:      addBonusPoints,
    adminAddPlayerFull:  adminAddPlayerFull,
    adminMovePlayer:     adminMovePlayer,
    adminToggleRookie:   adminToggleRookie,
    setAlmaWinner:       setAlmaWinner,
    adminSetAutoWeek:    adminSetAutoWeek,
    adminGetBonusEditor: adminGetBonusEditor,
    adminSetTeamBonus:   adminSetTeamBonus
  };
}

/**
 * Dispatches an API call from GET (?fn=&args=) or POST (JSON body {fn, args}).
 * Wraps the result as {__ok:true, data} or {__ok:false, error} so the frontend
 * shim can route thrown errors to its failure handler.
 */
function apiDispatch_(e) {
  var fn, args;
  try {
    if (e && e.postData && e.postData.contents) {
      var body = JSON.parse(e.postData.contents);
      fn = body.fn; args = body.args || [];
    } else {
      var p = (e && e.parameter) || {};
      fn = p.fn; args = p.args ? JSON.parse(p.args) : [];
    }
  } catch (err) {
    return jsonOut_({ __ok: false, error: 'Bad request: ' + err.message });
  }
  var map = apiFunctions_();
  if (!fn || !map[fn]) return jsonOut_({ __ok: false, error: 'Unknown function: ' + fn });
  try {
    var result = map[fn].apply(null, args || []);
    return jsonOut_({ __ok: true, data: (result === undefined ? null : result) });
  } catch (err2) {
    return jsonOut_({ __ok: false, error: err2.message });
  }
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Runs all one-time setup functions and returns a status page.
 * Triggered by visiting the app URL with ?action=setup
 */
function runSetupRoute() {
  var log = [];
  try {
    setupSheet();   // GFFL 2.0: create its OWN spreadsheet if one isn't set yet
    log.push('✅ Dedicated GFFL 2.0 spreadsheet ready');

    migrateSchema();
    log.push('✅ Schema migrated (Conference columns + Result column)');

    seedSampleLeague();
    log.push('✅ Sample league seeded');

    setConfig('CurrentWeek', 7);
    log.push('✅ Current week set to 7');

    seedRandomPicks();
    log.push('✅ Random picks seeded for weeks 1–6');

    var html = '<h2 style="font-family:sans-serif;color:#14265C">Setup Complete!</h2>' +
      '<ul style="font-family:sans-serif">' +
      log.map(function(l) { return '<li>' + l + '</li>'; }).join('') +
      '</ul>';
    return HtmlService.createHtmlOutput(html);
  } catch (err) {
    var errHtml = '<h2 style="font-family:sans-serif;color:#C8202F">Setup Error</h2>' +
      '<p style="font-family:sans-serif">' + err.message + '</p>' +
      '<ul style="font-family:sans-serif">' +
      log.map(function(l) { return '<li>' + l + '</li>'; }).join('') +
      '</ul>';
    return HtmlService.createHtmlOutput(errHtml);
  }
}

/**
 * Allows Index.html to include other HTML files (Styles.html, Scripts.html).
 * Usage in HTML: <?!= include('Styles') ?>
 *
 * @param {string} filename - file name without .html extension
 * @returns {string} raw HTML content
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Returns the initial data the app needs on load.
 * Called by the frontend via google.script.run on startup.
 *
 * @returns {{
 *   players: Array<{name, conference, division, isRookie}>,
 *   playerNames: string[],
 *   conferenceNames: string[],
 *   leagueStructure: Array<{conference, divisions}>,
 *   currentWeek: number,
 *   season: number
 * }}
 */
function getLeagueData() {
  var currentWeek  = getActiveWeek();
  var season       = getActiveSeason();
  var players      = getPlayers();
  var playerNames  = players.map(function(p) { return p.name; });

  return {
    players:         players,
    playerNames:     playerNames,
    conferenceNames: getConferenceNames(),
    leagueStructure: LEAGUE_STRUCTURE,
    familyStructure: getConferenceNames().map(function(c) {
      return { conference: c, families: familiesForConference(c) };
    }),
    currentWeek:     currentWeek,
    weekLabel:       weekLabel(currentWeek, getActiveSeasonType()),
    season:          season,
    autoWeek:        isAutoWeek()
  };
}
