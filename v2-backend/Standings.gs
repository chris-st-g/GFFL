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

  // Exclude preseason picks (seasonType 1) — they share week numbers with the
  // regular season and must never count toward standings.
  var picks          = getPicksFromSheet(season, null).filter(function(p) { return p.seasonType !== 1; });
  var bonuses        = getBonusPoints(season);
  var players        = getPlayers();
  var currentWeek    = getActiveWeek();

  // Weeks whose pick window has fully CLOSED — a missed pick only becomes a loss
  // once you can no longer pick that week (its LAST game has locked). Past weeks
  // are always closed; the current week counts only after its final game kicks off.
  var closedWeeks = [];
  for (var cw = 1; cw < currentWeek; cw++) closedWeeks.push(cw);
  if (currentWeek >= 1 && weekPicksClosed_(currentWeek, season)) closedWeeks.push(currentWeek);

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

  // Totals + missed-week losses (one loss per closed week the player didn't pick)
  var standings = players.map(function(p) {
    var entry = map[p.name];
    entry.totalPoints = entry.pickPoints + entry.bonusPoints;
    closedWeeks.forEach(function(w) { if (!entry.weeklyDetail[w]) entry.losses++; });
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

/**
 * Full profile for one grahamchise: record, every week's pick + result, current
 * pick (even before kickoff), division & conference position, and trophies.
 * Reuses getStandings (so it inherits score-on-open + the same ranking/loss rules).
 *
 * @param {number} season
 * @param {string} name
 * @returns {object} profile, or { ok:false, error }
 */
function getGrahamchiseProfile(season, name) {
  season = season || getActiveSeason();
  var std = getStandings(season);
  var me  = std.standings.filter(function(p) { return p.playerName === name; })[0];
  if (!me) return { ok: false, error: 'Grahamchise not found: ' + name };
  var currentWeek = std.currentWeek;
  var seasonType  = getActiveSeasonType();

  // Division rank/size (divisionRank was set on the shared entry by getStandings).
  var confObj = (std.conferences || []).filter(function(c) { return c.conference === me.conference; })[0];
  var divObj  = confObj ? confObj.divisions.filter(function(d) { return d.division === me.division; })[0] : null;

  // Conference rank/size — std.standings is globally sorted, so filtering to this
  // conference preserves rank order.
  var confPlayers = std.standings.filter(function(p) { return p.conference === me.conference; });
  var confRank = 0;
  for (var i = 0; i < confPlayers.length; i++) { if (confPlayers[i].playerName === name) { confRank = i + 1; break; } }

  // Every week's pick (weeks 1..current). Missed past weeks are flagged; a missed
  // week only "counts" as a loss once closed — mirror getStandings via weekPicksClosed_.
  var mine = getPicksFromSheet(season, null).filter(function(p) { return p.playerName === name && p.seasonType !== 1; });
  var byWeek = {}; mine.forEach(function(p) { byWeek[p.week] = p; });
  var currentClosed = weekPicksClosed_(currentWeek, season);
  var picks = [];
  for (var w = 1; w <= currentWeek; w++) {
    var pk = byWeek[w];
    var closed = (w < currentWeek) || currentClosed;
    picks.push({
      week:         w,
      weekLabel:    weekLabel(w, seasonType),
      team:         pk ? pk.teamAbbr : null,
      pointsEarned: pk ? pk.pointsEarned : null,
      result:       pk ? pk.result : null,
      missed:       !pk && closed,          // no pick AND the window has closed → counted loss
      pending:      !pk && !closed          // no pick yet but can still pick
    });
  }

  // Current pick — shown even if the game hasn't started.
  var currentPick = null;
  var cur = byWeek[currentWeek];
  if (cur) {
    var g = findGameForTeam(getWeeklyMatchups(currentWeek, season, me.conference), cur.teamAbbr);
    currentPick = {
      week:         currentWeek,
      weekLabel:    weekLabel(currentWeek, seasonType),
      team:         cur.teamAbbr,
      started:      g ? (g.status === 'in' || g.status === 'post') : false,
      locked:       g ? !!g.locked : false,
      result:       cur.result,
      pointsEarned: cur.pointsEarned
    };
  }

  return {
    ok:             true,
    season:         season,
    currentWeek:    currentWeek,
    player:         { name: me.playerName, conference: me.conference, division: me.division, isRookie: me.isRookie },
    record:         { wins: me.wins || 0, losses: me.losses || 0, ties: me.ties || 0 },
    totalPoints:    me.totalPoints,
    pickPoints:     me.pickPoints,
    bonusPoints:    me.bonusPoints,
    divisionRank:   me.divisionRank || null,
    divisionSize:   divObj ? divObj.players.length : null,
    conferenceRank: confRank || null,
    conferenceSize: confPlayers.length,
    picks:          picks,
    currentPick:    currentPick,
    trophies:       getTrophiesFor_(season, name, me, std)
  };
}

/** Honors earned by a grahamchise this season (empty early on). */
function getTrophiesFor_(season, name, me, std) {
  var t = [];
  // Alma Cup champion (only once a conference is actually decided).
  try {
    var alma = getAlmaCup(season);
    (alma.conferences || []).forEach(function(c) {
      var decided = c.status && c.status !== 'in_progress' && c.status !== 'needs_manual';
      if (decided && c.winner === name) {
        t.push({ icon: '🔥', label: 'Alma Cup Champion — ' + c.conference.replace(' Chapter', '') });
      }
    });
  } catch (e) {}
  // Season-complete honors: division & conference champ, Rookie of the Year.
  var seasonOver = std.currentWeek > 18;
  if (seasonOver) {
    if (me.divisionRank === 1) t.push({ icon: '🥇', label: me.division + ' Division Champion' });
    if (me.conferenceRank === 1) t.push({ icon: '🏆', label: me.conference.replace(' Chapter', '') + ' Champion' });
    var roy = (std.rookieStandings || []).filter(function(p) { return p.conference === me.conference; })[0];
    if (me.isRookie && roy && roy.playerName === name) {
      t.push({ icon: '🌟', label: 'Rookie of the Year — ' + me.conference.replace(' Chapter', '') });
    }
  }
  return t;
}
