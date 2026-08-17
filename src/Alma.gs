/**
 * Alma.gs — Alma Cup (longest survival streak from Week 1)
 *
 * Rules:
 *   - Streak starts Week 1. A WIN or TIE survives; a LOSS or a MISSED pick ends it.
 *   - Winner per conference = last one standing (longest streak).
 *   - Clinches early: as soon as a conference has exactly one survivor, they win.
 *   - Tiebreakers (auto): TB1 most points earned up to elimination →
 *     TB3 most Bengals (CIN) picks across Weeks 1–15.
 *   - If still tied, status = 'needs_manual' — the commissioner resolves the
 *     reset-and-continue (TB2) and Indian Gut (TB4) manually via setAlmaWinner().
 *   - Regular season is Weeks 1–15; Alma Cup only evaluates scored weeks.
 */

/**
 * Computes Alma Cup state for every conference.
 * @param {number} season
 * @returns {{ conferences: Array, currentWeek, lastWeek, seasonComplete, season }}
 */
function getAlmaCup(season) {
  season = season || getActiveSeason();
  var currentWeek = getActiveWeek();
  var lastWeek    = Math.min(15, Math.max(0, currentWeek - 1)); // scored regular-season weeks

  var players = getPlayers();
  var picks   = getPicksFromSheet(season, null);

  // map[name][week] = { result, points, team }
  var pm = {};
  picks.forEach(function(p) {
    if (!pm[p.playerName]) pm[p.playerName] = {};
    pm[p.playerName][p.week] = { result: p.result, points: p.pointsEarned || 0, team: p.teamAbbr };
  });

  var rows = players.map(function(pl) {
    var alive = true, elimWeek = null, streak = 0, ptsRun = 0, bengals = 0;
    for (var w = 1; w <= lastWeek; w++) {
      var rec = pm[pl.name] ? pm[pl.name][w] : null;
      if (rec && rec.team === 'CIN') bengals++;          // Bengals picks (any week)
      if (!alive) continue;
      if (!rec || !rec.result)      { alive = false; elimWeek = w; }   // no pick = out
      else if (rec.result === 'L')  { alive = false; elimWeek = w; }   // loss = out
      else { streak++; ptsRun += Number(rec.points) || 0; }            // W or T survives
    }
    return {
      name: pl.name, conference: pl.conference, division: pl.division,
      alive: alive, eliminatedWeek: elimWeek, streak: streak,
      pointsRun: ptsRun, bengals: bengals
    };
  });

  var byConf = {};
  rows.forEach(function(r) { (byConf[r.conference] = byConf[r.conference] || []).push(r); });

  var seasonComplete = lastWeek >= 15;

  var conferences = getConferenceNames().map(function(conf) {
    var pool = byConf[conf] || [];
    pool.sort(function(a, b) {
      if (a.alive !== b.alive)           return a.alive ? -1 : 1;
      if (b.streak !== a.streak)         return b.streak - a.streak;
      if (b.pointsRun !== a.pointsRun)   return b.pointsRun - a.pointsRun;
      return a.name.localeCompare(b.name);
    });

    var res = resolveAlma(pool, seasonComplete);

    // Commissioner override always wins.
    var manual = getConfig('AlmaWinner_' + conf);
    if (manual) res = { winner: manual, status: 'declared', tied: [] };

    return { conference: conf, players: pool, winner: res.winner, status: res.status, tied: res.tied || [] };
  }).filter(function(c) { return c.players.length > 0; });

  return { conferences: conferences, currentWeek: currentWeek, lastWeek: lastWeek, seasonComplete: seasonComplete, season: season };
}

/**
 * Resolves the Alma Cup winner for one conference's pool.
 * @returns {{ winner: string|null, status: string, tied?: string[] }}
 */
function resolveAlma(pool, seasonComplete) {
  if (!pool.length) return { winner: null, status: 'none' };

  var alive = pool.filter(function(p) { return p.alive; });

  // Clinch: exactly one survivor left → they win immediately.
  if (alive.length === 1) return { winner: alive[0].name, status: 'clinched' };

  // Multiple still alive and season not over → race continues.
  if (alive.length > 1 && !seasonComplete) {
    return { winner: null, status: 'in_progress', tied: alive.map(function(p) { return p.name; }) };
  }

  // Finalists: survivors if any remain, else the longest-streak group.
  var finalists;
  if (alive.length >= 1) {
    finalists = alive;
  } else {
    var maxS = Math.max.apply(null, pool.map(function(p) { return p.streak; }));
    finalists = pool.filter(function(p) { return p.streak === maxS; });
  }
  if (finalists.length === 1) return { winner: finalists[0].name, status: 'by-streak' };

  // TB1 — most points up to elimination.
  var maxP = Math.max.apply(null, finalists.map(function(p) { return p.pointsRun; }));
  var t1 = finalists.filter(function(p) { return p.pointsRun === maxP; });
  if (t1.length === 1) return { winner: t1[0].name, status: 'by-points' };

  // TB3 — most Bengals (CIN) picks.
  var maxB = Math.max.apply(null, t1.map(function(p) { return p.bengals; }));
  var t3 = t1.filter(function(p) { return p.bengals === maxB; });
  if (t3.length === 1) return { winner: t3[0].name, status: 'by-bengals' };

  // Still tied → reset-and-continue / Indian Gut, resolved by commissioner.
  return { winner: null, status: 'needs_manual', tied: t3.map(function(p) { return p.name; }) };
}
