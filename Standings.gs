/**
 * Standings.gs — Season standings aggregation
 *
 * W-L-T record rules:
 *   W = picked team won
 *   L = picked team lost OR no pick submitted that week
 *   T = picked team tied (earns full point value)
 *
 * Ranking order: total points → fewest losses → most ties → alphabetical
 */

/**
 * Calculates standings for a given season.
 *
 * @param {number} season
 * @returns {{ standings: Array<PlayerStanding>, currentWeek: number, season: number }}
 */
function getStandings(season) {
  var picks       = getPicksFromSheet(season, null);
  var bonuses     = getBonusPoints(season);
  var players     = getPlayerNames();
  var currentWeek = Number(getConfig('CurrentWeek')) || 1;
  var completedWeeks = Math.max(0, currentWeek - 1);

  // Initialize map for every registered player
  var map = {};
  players.forEach(function(name) {
    map[name] = {
      playerName:  name,
      pickPoints:  0,
      bonusPoints: 0,
      totalPoints: 0,
      wins:        0,
      losses:      0,
      ties:        0,
      weeklyDetail: {}  // week → { team, pointsEarned, result }
    };
  });

  // Accumulate pick results
  picks.forEach(function(pick) {
    if (!map[pick.playerName]) return;
    var p = map[pick.playerName];

    if (pick.pointsEarned !== null) {
      p.pickPoints += pick.pointsEarned;
    }

    if (pick.result === 'W') p.wins++;
    else if (pick.result === 'T') p.ties++;
    else if (pick.result === 'L') p.losses++;
    // result null = pending (game not yet scored — don't count yet)

    p.weeklyDetail[pick.week] = {
      team:         pick.teamAbbr,
      pointsEarned: pick.pointsEarned,
      result:       pick.result
    };
  });

  // Accumulate bonus points
  bonuses.forEach(function(bonus) {
    if (!map[bonus.playerName]) return;
    map[bonus.playerName].bonusPoints += bonus.points;
  });

  // Compute totals and missed-week losses
  var standings = players.map(function(name) {
    var p = map[name];
    p.totalPoints = p.pickPoints + p.bonusPoints;

    // Weeks with no pick that have already completed = automatic loss
    var scoredWeeks = p.wins + p.losses + p.ties;
    var missedWeeks = Math.max(0, completedWeeks - Object.keys(p.weeklyDetail).length);
    p.losses += missedWeeks;

    return p;
  });

  // Sort: points desc → losses asc → ties desc → alphabetical
  standings.sort(function(a, b) {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (a.losses !== b.losses)           return a.losses - b.losses;
    if (b.ties !== a.ties)               return b.ties - a.ties;
    return a.playerName.localeCompare(b.playerName);
  });

  return {
    standings:   standings,
    currentWeek: currentWeek,
    season:      season
  };
}
