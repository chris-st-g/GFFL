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

  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Graham Family Football League')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Runs all one-time setup functions and returns a status page.
 * Triggered by visiting the app URL with ?action=setup
 */
function runSetupRoute() {
  var log = [];
  try {
    migrateAddResultColumn();
    log.push('✅ Result column added to Picks sheet');

    seedTestPlayers();
    log.push('✅ Player1–Player25 added');

    setConfig('CurrentWeek', 6);
    log.push('✅ Current week set to 6');

    seedRandomPicks();
    log.push('✅ Random picks seeded for weeks 1–6');

    var appUrl = ScriptApp.getService().getUrl();
    var html = '<h2 style="font-family:sans-serif;color:#27ae60">Setup Complete!</h2>' +
      '<ul style="font-family:sans-serif">' +
      log.map(function(l) { return '<li>' + l + '</li>'; }).join('') +
      '</ul>' +
      '<p style="font-family:sans-serif"><a href="' + appUrl + '">→ Open the GFFL App</a></p>';
    return HtmlService.createHtmlOutput(html);
  } catch (err) {
    var errHtml = '<h2 style="font-family:sans-serif;color:#c0392b">Setup Error</h2>' +
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
 * @returns {{ players: string[], currentWeek: number, season: number }}
 */
function getLeagueData() {
  var currentWeek = Number(getConfig('CurrentWeek')) || 1;
  var season      = Number(getConfig('Season')) || 2025;
  var players     = getPlayerNames();

  return {
    players:     players,
    currentWeek: currentWeek,
    season:      season
  };
}
