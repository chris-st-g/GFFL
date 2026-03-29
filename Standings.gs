/**
 * Standings.gs — Season standings aggregation
 */

/**
 * Calculates standings for a given season.
 * Combines pick points + bonus points per player, sorted by total.
 *
 * @param {number} season
 * @returns {{ standings: Array<PlayerStanding>, currentWeek: number, season: number }}
 */
function getStandings(season) {
  var picks       = getPicksFromSheet(season, null);
  var bonuses     = getBonusPoints(season);
  var players     = getPlayerNames();
  var currentWeek = Number(getConfig('CurrentWeek')) || 1;

  // Initialize map for every registered player
  var map = {};
  players.forEach(function(name) {
    map[name] = {
      playerName:   name,
      pickPoints:   0,
      bonusPoints:  0,
      totalPoints:  0,
      weeksPlayed:  0,
      weeksMissed:  0,
      weeklyDetail: {}  // week -> { team, pointsEarned }
    };
  });

  // Accumulate pick points and build weekly detail
  picks.forEach(function(pick) {
    if (!map[pick.playerName]) return;
    var p = map[pick.playerName];
    if (pick.pointsEarned !== null) {
      p.pickPoints += pick.pointsEarned;
    }
    p.weeklyDetail[pick.week] = {
      team:         pick.teamAbbr,
      pointsEarned: pick.pointsEarned
    };
  });

  // Accumulate bonus points
  bonuses.forEach(function(bonus) {
    if (!map[bonus.playerName]) return;
    map[bonus.playerName].bonusPoints += bonus.points;
  });

  // Calculate totals, weeks played/missed
  var completedWeeks = Math.max(0, currentWeek - 1);

  var standings = players.map(function(name) {
    var p         = map[name];
    p.weeksPlayed = Object.keys(p.weeklyDetail).length;
    p.weeksMissed = Math.max(0, completedWeeks - p.weeksPlayed);
    p.totalPoints = p.pickPoints + p.bonusPoints;
    return p;
  });

  // Sort: highest total first, then alphabetical on tie
  standings.sort(function(a, b) {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    return a.playerName.localeCompare(b.playerName);
  });

  return {
    standings:   standings,
    currentWeek: currentWeek,
    season:      season
  };
}
