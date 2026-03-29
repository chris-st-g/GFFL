/**
 * GFFL — Graham Family Football League
 * Code.gs — Web app entry point
 */

/**
 * Serves the web app. Called by Google when someone visits the app URL.
 */
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Graham Family Football League')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
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
