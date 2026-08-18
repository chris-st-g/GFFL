/**
 * Scoring.gs — Point classification engine
 *
 * All GFFL scoring rules live here. Everything else calls these functions.
 *
 * CLASSIFICATION — computed from WIN TOTALS ONLY (ties and losses are ignored):
 *   Equal wins      → Deuce:  both teams = 2 pts
 *   Wins differ by 1→ Trey:   the LOWER-win team (who would TIE the other by winning)
 *                             = 3 pts; the higher-win team = 1 pt
 *   Wins differ 2+  → Regular: both teams = 1 pt
 *   Fully computable before kickoff — no need to wait for results.
 *
 * RESULT SCORING:
 *   Win  → full point value
 *   Tie  → HALF the point value   (e.g. a Trey tie on the 3-pt side = 1.5)
 *   Loss → 0
 *
 * EARLY_FLAT_WEEKS — number of opening weeks forced to flat 1-pt Regular games.
 *   Early in the season every team is near 0-0, so without this every game is a
 *   Deuce. Weeks 1-3 are flat 1-pt Regular games; Deuce/Trey begins Week 4.
 *   Set to 0 to apply Deuce/Trey from Week 1 instead.
 */

var EARLY_FLAT_WEEKS = 3;

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
  if (week <= EARLY_FLAT_WEEKS) {
    return { gameType: 'Regular', homePoints: 1, awayPoints: 1 };
  }

  var diff = Math.abs(homeWins - awayWins);

  if (diff === 0) {
    return { gameType: 'Deuce', homePoints: 2, awayPoints: 2 };
  }

  if (diff === 1) {
    // The team with FEWER wins would tie the other by winning → 3-pt pick.
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
 * Win = full value, Tie = HALF value, Loss / not-final = 0.
 *
 * @param {string} pickedTeamAbbr - Team the player picked, e.g. 'KC'
 * @param {string|null} winnerAbbr - Winning team abbreviation, null if tied, undefined if not final
 * @param {number} pointValue      - Point value for the picked team (from classifyGame)
 * @param {boolean} isTie          - True if game ended in a tie (completed, no winner)
 * @returns {number} Points earned (may be fractional on a tie)
 */
function resolvePickPoints(pickedTeamAbbr, winnerAbbr, pointValue, isTie) {
  if (isTie) return pointValue / 2;                           // tie → half points
  if (!winnerAbbr) return 0;                                  // not final yet
  return pickedTeamAbbr === winnerAbbr ? pointValue : 0;      // win or loss
}

/**
 * Returns the result string for a pick: 'W', 'L', or 'T'.
 *
 * @param {string} pickedTeamAbbr
 * @param {string|null} winnerAbbr
 * @param {boolean} isTie
 * @returns {string}
 */
function resolvePickResult(pickedTeamAbbr, winnerAbbr, isTie) {
  if (isTie) return 'T';
  if (!winnerAbbr) return '';   // game not final
  return pickedTeamAbbr === winnerAbbr ? 'W' : 'L';
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
