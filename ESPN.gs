/**
 * ESPN.gs — ESPN public API functions
 *
 * No API key required. Uses the public ESPN scoreboard endpoint.
 */

const ESPN_NFL_SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';

/**
 * Fetches current NFL scores from ESPN.
 * Returns an array of game objects with teams and scores.
 */
function getESPNScores() {
  try {
    const response = UrlFetchApp.fetch(ESPN_NFL_SCOREBOARD);
    const data = JSON.parse(response.getContentText());
    const games = data.events || [];

    return games.map(function(game) {
      const competition = game.competitions[0];
      const home = competition.competitors.find(function(c) { return c.homeAway === 'home'; });
      const away = competition.competitors.find(function(c) { return c.homeAway === 'away'; });

      return {
        id: game.id,
        name: game.name,
        status: game.status.type.description,
        homeTeam: home ? home.team.abbreviation : '',
        homeScore: home ? home.score : 0,
        awayTeam: away ? away.team.abbreviation : '',
        awayScore: away ? away.score : 0,
        completed: game.status.type.completed
      };
    });
  } catch (e) {
    Logger.log('ESPN fetch error: ' + e.message);
    return [];
  }
}
