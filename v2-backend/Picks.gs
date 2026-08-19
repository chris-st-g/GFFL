/**
 * Picks.gs — Pick submission and validation
 *
 * All pick logic is validated server-side. The frontend is for display only.
 *
 * Locking rules:
 *   - A game can only be picked while it is in the 'pre' state (before kickoff).
 *   - A pick can be changed freely until the picked team's game starts.
 *   - Once the picked team's game starts, that pick is locked and cannot change.
 *   - Anyone may submit/change anyone's pick (league honesty policy — no auth).
 */

/**
 * Returns everything the pick flow needs to render for a grahamchise.
 *
 * @param {string|null} playerName - if provided, includes their existing pick
 * @returns {{ games: Array, existingPick: string|null, existingLocked: boolean,
 *             week: number, season: number, isGraceBowl: boolean }}
 */
function getPickPageData(playerName) {
  var week   = getActiveWeek();
  var season = getActiveSeason();
  var conf   = playerName ? getPlayerConference(playerName) : null;
  var games  = getWeeklyMatchups(week, season, conf);

  var existingPick   = null;
  var existingLocked = false;
  if (playerName) {
    var found = getPickForWeek(season, week, playerName);
    if (found) {
      existingPick = found.teamAbbr;
      var g = findGameForTeam(games, found.teamAbbr);
      existingLocked = g ? g.locked : false;
    }
  }

  var po = getPicksOpenInfo(week, season);

  return {
    games:          games,
    existingPick:   existingPick,
    existingLocked: existingLocked,
    week:           week,
    season:         season,
    isGraceBowl:    isGraceBowlWeek(week),
    picksOpen:      po.open,
    picksOpenAt:    po.openAt
  };
}

/**
 * Determines whether picking is open for a week yet.
 * Rule: next week's games are visible as soon as the PRIOR week's last game ends;
 * picking opens 24 hours after that final game. Only enforced in auto-week (live)
 * mode — in demo/manual mode picks are always open.
 *
 * @param {number} week
 * @param {number} season
 * @returns {{ open: boolean, openAt: string|null }}  openAt = ISO timestamp
 */
function getPicksOpenInfo(week, season) {
  if (!isAutoWeek()) return { open: true, openAt: null };   // demo/manual: always open
  if (week <= 1)     return { open: true, openAt: null };   // no prior NFL week to gate on
  try {
    var prev = getWeeklyMatchups(week - 1, season);
    var lastKick = 0;
    for (var i = 0; i < prev.length; i++) {
      var t = Date.parse(prev[i].kickoff);
      if (t && t > lastKick) lastKick = t;
    }
    if (!lastKick) return { open: true, openAt: null };
    var openAt = lastKick + (4 * 3600 * 1000) + (24 * 3600 * 1000); // last kickoff + ~4h game + 24h
    return { open: Date.now() >= openAt, openAt: new Date(openAt).toISOString() };
  } catch (e) {
    Logger.log('getPicksOpenInfo error: ' + e.message);
    return { open: true, openAt: null };
  }
}

/**
 * Finds the game a given team is playing in this week, or null.
 * @param {Array} games
 * @param {string} teamAbbr
 * @returns {object|null}
 */
function findGameForTeam(games, teamAbbr) {
  for (var i = 0; i < games.length; i++) {
    if (games[i].homeAbbr === teamAbbr || games[i].awayAbbr === teamAbbr) return games[i];
  }
  return null;
}

/**
 * Returns everything the pick flow needs for a whole conference in ONE call:
 * this week's games (with that conference's bonuses) + every grahamchise's pick.
 * The client caches this so switching between people is instant (no round-trip).
 *
 * @param {string} conference
 * @returns {{ games, picks, week, season, isGraceBowl, picksOpen, picksOpenAt }}
 */
function getConferencePickData(conference) {
  var week   = getActiveWeek();
  var season = getActiveSeason();
  var games  = getWeeklyMatchups(week, season, conference);
  var picks  = {};
  getPicksFromSheet(season, week).forEach(function(p) { picks[p.playerName] = p.teamAbbr; });
  var po = getPicksOpenInfo(week, season);
  return {
    games:       games,
    picks:       picks,
    week:        week,
    season:      season,
    isGraceBowl: isGraceBowlWeek(week),
    picksOpen:   po.open,
    picksOpenAt: po.openAt
  };
}

/** Grace window (ms) after kickoff during which a pick is still accepted.
 *  Covers "I tapped right at game time" + any cache lag. Config: PickGraceMinutes. */
function pickGraceMs_() {
  var m = Number(getConfig('PickGraceMinutes'));
  if (isNaN(m)) m = 5;                 // default 5 minutes
  return Math.max(0, m) * 60 * 1000;
}

/** Whether a game is locked FOR PICKING — kickoff + grace has passed. Falls back
 *  to the game's own locked flag if kickoff is unparseable. */
function isLockedForPicking_(game) {
  var k = Date.parse(game.kickoff);
  return k ? (Date.now() >= k + pickGraceMs_()) : !!game.locked;
}

/**
 * Submits or changes a pick. Full server-side validation before writing.
 *
 * @param {string} playerName
 * @param {string} teamAbbr
 * @param {number} week
 * @param {number} season
 * @returns {{ success: boolean, message: string, pointValue: number|null }}
 */
function submitPick(playerName, teamAbbr, week, season) {
  // 1. Validate grahamchise exists
  if (getPlayerNames().indexOf(playerName) === -1) {
    return { success: false, message: 'Grahamchise not found: ' + playerName, pointValue: null };
  }

  // 2. Validate week matches the open week
  var currentWeek = getActiveWeek();
  if (Number(week) !== currentWeek) {
    return { success: false, message: 'Picks are only open for Week ' + currentWeek + '.', pointValue: null };
  }

  // Enforce the "picks open 24h after last week's final game" window (live mode).
  var po = getPicksOpenInfo(currentWeek, getActiveSeason());
  if (!po.open) {
    return { success: false, message: 'Picks for Week ' + currentWeek + ' are not open yet.', pointValue: null };
  }

  // 3. Validate the picked team is playing, and capture its point value
  var games      = getWeeklyMatchups(week, season, getPlayerConference(playerName));
  var pickedGame = findGameForTeam(games, teamAbbr);
  if (!pickedGame) {
    return { success: false, message: teamAbbr + ' is not playing this week.', pointValue: null };
  }
  var pointValue = (pickedGame.homeAbbr === teamAbbr) ? pickedGame.homePoints : pickedGame.awayPoints;

  // 4. The picked game must not have started yet (with a grace buffer past kickoff)
  if (isLockedForPicking_(pickedGame)) {
    return { success: false, message: 'That game has already started — pick locked.', pointValue: null };
  }

  // 5-6. Serialize the read-modify-write so simultaneous submissions can't
  // collide (duplicate/overwritten rows). Lock only wraps the sheet write.
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); }
  catch (e) { return { success: false, message: 'Server busy — please try again.', pointValue: null }; }
  try {
    var existing = getPickForWeek(season, week, playerName);
    if (existing) {
      var existingGame = findGameForTeam(games, existing.teamAbbr);
      if (existingGame && isLockedForPicking_(existingGame)) {
        return { success: false, message: 'Current pick (' + existing.teamAbbr + ') is locked — its game already started.', pointValue: null };
      }
      updatePick(season, week, playerName, teamAbbr);
      return { success: true, message: 'Pick updated to ' + teamAbbr + ' (' + pointValue + ' pt).', pointValue: pointValue };
    }
    savePick(season, week, playerName, teamAbbr);
    return { success: true, message: 'Pick saved: ' + teamAbbr + ' (' + pointValue + ' pt).', pointValue: pointValue };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Returns all picks for a week grouped for the "see everyone's picks" view,
 * scoped to a conference. Each entry: { playerName, division, teamAbbr, locked }.
 *
 * @param {string} conference
 * @param {number} [week] - defaults to CurrentWeek
 * @returns {Array}
 */
function getConferencePicks(conference, week) {
  var season = getActiveSeason();
  week = week || getActiveWeek();

  var games   = getWeeklyMatchups(week, season, conference);
  var players  = getPlayersByConference(conference);
  var picks    = getPicksFromSheet(season, week);
  var pickMap  = {};
  picks.forEach(function(p) { pickMap[p.playerName] = p; });

  return players.map(function(p) {
    var pick = pickMap[p.name];
    var g    = pick ? findGameForTeam(games, pick.teamAbbr) : null;
    return {
      playerName: p.name,
      division:   p.division,
      teamAbbr:   pick ? pick.teamAbbr : null,
      locked:     g ? g.locked : false
    };
  });
}
