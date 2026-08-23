/**
 * Standings.gs — Season standings aggregation
 *
 * W-L-T record rules:
 *   W = picked team won
 *   L = picked team lost OR no pick submitted that week
 *   T = picked team tied (earns HALF the point value)
 *
 * Ranking order: total points → fewest losses → most ties → alphabetical
 */

/**
 * Calculates standings for a given season.
 *
 * @param {number} season
 * @returns {{
 *   standings: Array<PlayerStanding>,
 *   conferences: Array<{conference: string, divisions: Array}>,
 *   rookieStandings: Array<PlayerStanding>,
 *   currentWeek: number,
 *   season: number
 * }}
 */
function getStandings(season) {
  // Score-on-open: fill in any games that went final since the last view. Cheap and
  // gated (see autoScoreOnOpen_) — no ESPN call unless the active week has unscored
  // picks. Runs before we read picks below so fresh results show this same load.
  autoScoreOnOpen_(season, getActiveWeek());

  var picks          = getPicksFromSheet(season, null);
  var bonuses        = getBonusPoints(season);
  var players        = getPlayers();
  var currentWeek    = getActiveWeek();
  var completedWeeks = Math.max(0, currentWeek - 1);

  // Initialize a record for every registered grahamchise
  var map = {};
  players.forEach(function(p) {
    map[p.name] = {
      playerName:   p.name,
      conference:   p.conference,
      division:     p.division,
      isRookie:     p.isRookie,
      pickPoints:   0,
      bonusPoints:  0,
      totalPoints:  0,
      wins:         0,
      losses:       0,
      ties:         0,
      weeklyDetail: {}
    };
  });

  // Accumulate pick results
  picks.forEach(function(pick) {
    if (!map[pick.playerName]) return;
    var p = map[pick.playerName];

    if (pick.pointsEarned !== null) p.pickPoints += pick.pointsEarned;

    if (pick.result === 'W') p.wins++;
    else if (pick.result === 'T') p.ties++;
    else if (pick.result === 'L') p.losses++;

    p.weeklyDetail[pick.week] = {
      team:         pick.teamAbbr,
      pointsEarned: pick.pointsEarned,
      result:       pick.result
    };
  });

  // Accumulate bonus points
  bonuses.forEach(function(bonus) {
    if (map[bonus.playerName]) map[bonus.playerName].bonusPoints += bonus.points;
  });

  function sortStandings(arr) {
    return arr.sort(function(a, b) {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (a.losses !== b.losses)           return a.losses - b.losses;
      if (b.ties !== a.ties)               return b.ties - a.ties;
      return a.playerName.localeCompare(b.playerName);
    });
  }

  // Totals + missed-week losses
  var standings = players.map(function(p) {
    var entry = map[p.name];
    entry.totalPoints = entry.pickPoints + entry.bonusPoints;
    var missedWeeks = Math.max(0, completedWeeks - Object.keys(entry.weeklyDetail).length);
    entry.losses += missedWeeks;
    return entry;
  });

  sortStandings(standings);

  // Group by conference → division (following LEAGUE_STRUCTURE order), with rank
  var byConfDiv = {};
  standings.forEach(function(p) {
    if (!byConfDiv[p.conference]) byConfDiv[p.conference] = {};
    if (!byConfDiv[p.conference][p.division]) byConfDiv[p.conference][p.division] = [];
    byConfDiv[p.conference][p.division].push(p);
  });

  var conferences = LEAGUE_STRUCTURE.map(function(conf) {
    var divMap = byConfDiv[conf.conference] || {};
    var divisions = conf.divisions.map(function(divName) {
      var divPlayers = divMap[divName] || [];
      sortStandings(divPlayers);
      divPlayers.forEach(function(p, i) { p.divisionRank = i + 1; });
      return { division: divName, players: divPlayers };
    }).filter(function(d) { return d.players.length > 0; });
    return { conference: conf.conference, divisions: divisions };
  }).filter(function(c) { return c.divisions.length > 0; });

  // Rookie sub-standings (already globally sorted); conference field lets the UI
  // group them for per-conference Rookie of the Year.
  var rookieStandings = standings.filter(function(p) { return p.isRookie; });

  return {
    standings:       standings,
    conferences:     conferences,
    rookieStandings: rookieStandings,
    currentWeek:     currentWeek,
    season:          season
  };
}
