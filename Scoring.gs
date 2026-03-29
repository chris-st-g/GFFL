/**
 * Scoring.gs — Point classification engine
 *
 * All GFFL scoring rules live here. Everything else calls these functions.
 *
 * Rules:
 *   Weeks 1-3:  all teams = 1 pt (Regular)
 *   Weeks 4-18: based on win records at game time
 *     Equal wins          → Deuce: both teams = 2 pts
 *     Win diff = 1        → Trey:  underdog = 3 pts, favorite = 1 pt
 *     Win diff > 1        → Regular: both teams = 1 pt
 *   Grace Bowl = Weeks 16-18, same scoring rules, different UI label
 */

/**
 * Classifies a game and returns point values for each team.
 *
 * @param {number} week       - Week number 1-18
 * @param {number} homeWins   - Home team win count at time of game
 * @param {number} awayWins   - Away team win count at time of game
 * @returns {{ gameType: string, homePoints: number, awayPoints: number }}
 *   gameType: 'Regular' | 'Deuce' | 'Trey'
 */
function classifyGame(week, homeWins, awayWins) {
  if (week <= 3) {
    return { gameType: 'Regular', homePoints: 1, awayPoints: 1 };
  }

  var diff = Math.abs(homeWins - awayWins);

  if (diff === 0) {
    return { gameType: 'Deuce', homePoints: 2, awayPoints: 2 };
  }

  if (diff === 1) {
    var underdogIsHome = homeWins < awayWins;
    return {
      gameType: 'Trey',
      homePoints: underdogIsHome ? 3 : 1,
      awayPoints: underdogIsHome ? 1 : 3
    };
  }

  return { gameType: 'Regular', homePoints: 1, awayPoints: 1 };
}

/**
 * After a game is final, calculates how many points a pick earns.
 *
 * @param {string} pickedTeamAbbr - Team the player picked, e.g. 'KC'
 * @param {string|null} winnerAbbr - Winning team abbreviation, null if tie or not final
 * @param {number} pointValue      - Point value for the picked team (from classifyGame)
 * @returns {number} Points earned
 */
function resolvePickPoints(pickedTeamAbbr, winnerAbbr, pointValue) {
  if (!winnerAbbr) return 0;
  return pickedTeamAbbr === winnerAbbr ? pointValue : 0;
}

/**
 * Returns true if the week falls in the Grace Bowl range (16-18).
 * Scoring rules are the same — this is used for UI labeling only.
 *
 * @param {number} week
 * @returns {boolean}
 */
function isGraceBowlWeek(week) {
  return week >= 16 && week <= 18;
}
