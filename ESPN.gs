/**
 * ESPN.gs — ESPN public API functions
 *
 * No API key required. Uses ESPN's public scoreboard endpoint.
 * All fetches happen server-side — nothing sensitive is exposed to the browser.
 */

var ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';

/**
 * Fetches all games for a given week and season.
 * Applies GFFL point values via classifyGame().
 *
 * @param {number} week       - Week number 1-18
 * @param {number} season     - 4-digit year, e.g. 2025
 * @param {number} seasonType - 2 = regular season (covers all 18 weeks incl. Grace Bowl)
 * @returns {Array<GameObject>}
 */
function getWeeklyMatchups(week, season, seasonType) {
  seasonType = seasonType || 2;
  var url = ESPN_BASE + '?seasontype=' + seasonType + '&week=' + week + '&dates=' + season;

  try {
    var response = UrlFetchApp.fetch(url);
    var data = JSON.parse(response.getContentText());
    var events = data.events || [];

    return events.map(function(game) {
      var competition = game.competitions[0];
      var home = competition.competitors.find(function(c) { return c.homeAway === 'home'; });
      var away = competition.competitors.find(function(c) { return c.homeAway === 'away'; });

      var homeWins = extractWins(home ? home.records : []);
      var awayWins = extractWins(away ? away.records : []);
      var scoring  = classifyGame(week, homeWins, awayWins);

      var isCompleted = game.status.type.completed;
      var winner = null;
      if (isCompleted) {
        var winnerComp = competition.competitors.find(function(c) { return c.winner === true; });
        winner = winnerComp ? winnerComp.team.abbreviation : null;
      }

      return {
        gameId:      game.id,
        homeTeam:    home ? home.team.displayName : '',
        homeAbbr:    home ? home.team.abbreviation : '',
        homeScore:   home ? (home.score || 0) : 0,
        homeWins:    homeWins,
        homeLosses:  extractLosses(home ? home.records : []),
        homePoints:  scoring.homePoints,
        awayTeam:    away ? away.team.displayName : '',
        awayAbbr:    away ? away.team.abbreviation : '',
        awayScore:   away ? (away.score || 0) : 0,
        awayWins:    awayWins,
        awayLosses:  extractLosses(away ? away.records : []),
        awayPoints:  scoring.awayPoints,
        gameType:    scoring.gameType,
        status:      game.status.type.state,      // 'pre' | 'in' | 'post'
        statusDetail: game.status.type.description,
        completed:   isCompleted,
        winner:      winner,
        isGraceBowl: isGraceBowlWeek(week)
      };
    });

  } catch (e) {
    Logger.log('ESPN fetch error (week ' + week + ', ' + season + '): ' + e.message);
    return [];
  }
}

/**
 * Extracts win count from ESPN's records array.
 * Looks for the 'total' record type, then reads the 'wins' stat.
 * Falls back to parsing the summary string (e.g. "10-7").
 *
 * @param {Array} records - competitor.records from ESPN response
 * @returns {number}
 */
function extractWins(records) {
  return extractRecordStat(records, 'wins', 0);
}

/**
 * Extracts loss count from ESPN's records array.
 *
 * @param {Array} records
 * @returns {number}
 */
function extractLosses(records) {
  return extractRecordStat(records, 'losses', 1);
}

/**
 * Internal helper — reads a stat from the 'total' record.
 *
 * @param {Array}  records       - competitor.records
 * @param {string} statName      - 'wins' or 'losses'
 * @param {number} summaryIndex  - index in "W-L" summary string (0=wins, 1=losses)
 * @returns {number}
 */
function extractRecordStat(records, statName, summaryIndex) {
  if (!records || !records.length) return 0;

  var total = records.find(function(r) {
    return r.type === 'total' || r.name === 'overall';
  });
  if (!total) total = records[0];
  if (!total) return 0;

  // Try structured stats array first
  if (total.stats && total.stats.length) {
    var stat = total.stats.find(function(s) { return s.name === statName; });
    if (stat) return parseInt(stat.value, 10) || 0;
  }

  // Fallback: parse summary like "10-7"
  if (total.summary) {
    var parts = total.summary.split('-');
    return parseInt(parts[summaryIndex], 10) || 0;
  }

  return 0;
}
