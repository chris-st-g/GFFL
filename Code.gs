/**
 * GFFL — Graham Family Football League
 * Code.gs — Main entry point
 */

/**
 * Serves the web app HTML page.
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Graham Family Football League')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Called by the frontend to get all league data in one shot.
 * Returns standings and current week picks from Google Sheets,
 * plus live scores from ESPN.
 */
function getLeagueData() {
  const picks = getPicksFromSheet();
  const scores = getESPNScores();
  return { picks: picks, scores: scores };
}
