/**
 * ESPN.gs — ESPN public API functions
 *
 * No API key required. Uses ESPN's public scoreboard endpoint.
 * All fetches happen server-side — nothing sensitive is exposed to the browser.
 */

// NOTE: site.api.espn.com is IP-blocked (403) from Google's Apps Script servers.
// The cdn.espn.com "core" scoreboard returns the same data and is not blocked.
// Its events live under content.sbData.events.
var ESPN_BASE = 'https://cdn.espn.com/core/nfl/scoreboard';

// Fake kickoff labels used only in PreviewMode to simulate upcoming games.
var PREVIEW_TIMES = ['Sun 1:00 PM', 'Sun 4:05 PM', 'Sun 4:25 PM', 'Sun 8:20 PM', 'Mon 8:15 PM', 'Thu 8:15 PM'];

// ─── Active week/season (auto-detected from ESPN, or manual) ──────────────────

var _espnCurrent;   // memoized per execution

/** Asks ESPN for the current NFL week/season based on today's date. */
function espnCurrent() {
  if (_espnCurrent !== undefined) return _espnCurrent;
  _espnCurrent = null;
  try {
    var resp = UrlFetchApp.fetch(ESPN_BASE + '?xhr=1', {
      muteHttpExceptions: true,
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
    });
    if (resp.getResponseCode() === 200) {
      var j  = JSON.parse(resp.getContentText());
      var sb = (j.content && j.content.sbData) || j;
      var wk = sb.week && sb.week.number;
      var sn = (sb.season && sb.season.year) ||
               (sb.leagues && sb.leagues[0] && sb.leagues[0].season && sb.leagues[0].season.year);
      if (wk && sn) _espnCurrent = { week: Number(wk), season: Number(sn) };
    }
  } catch (e) { Logger.log('espnCurrent error: ' + e.message); }
  return _espnCurrent;
}

/** True when the commissioner has enabled automatic week detection. */
function isAutoWeek() { return String(getConfig('AutoWeek') || '').toUpperCase() === 'TRUE'; }

/** The season the app should use right now. */
function getActiveSeason() {
  if (isAutoWeek()) { var c = espnCurrent(); if (c) return c.season; }
  return Number(getConfig('Season')) || 2025;
}

/** The week the app should use right now. */
function getActiveWeek() {
  if (isAutoWeek()) { var c = espnCurrent(); if (c) return c.week; }
  return Number(getConfig('CurrentWeek')) || 1;
}

/**
 * Fetches all games for a given week and season.
 * Applies GFFL point values via classifyGame().
 *
 * @param {number} week       - Week number 1-18
 * @param {number} season     - 4-digit year, e.g. 2025
 * @param {number} seasonType - 2 = regular season (covers all 18 weeks incl. Grace Bowl)
 * @returns {Array<GameObject>}
 */
/**
 * Cached weekly matchups. Serves from CacheService (short TTL) so a burst of
 * users collapses to ~1 ESPN fetch; ESPN is only hit on a cache miss. `locked`
 * is always recomputed from real kickoff time, so a stale cache can never let
 * someone pick a game that already started. Pass noCache=true to force fresh
 * (used by scoring so winners are never stale).
 */
function getWeeklyMatchups(week, season, conference, seasonType, noCache) {
  var cacheKey = 'basegames_' + season + '_' + week;
  var cache    = CacheService.getScriptCache();
  var base = null;
  if (!noCache) {
    var hit = cache.get(cacheKey);
    if (hit) { try { base = JSON.parse(hit); } catch (e) {} }
  }
  if (!base) {
    base = fetchBaseGamesRaw(week, season, seasonType);
    if (!noCache && base.length) { try { cache.put(cacheKey, JSON.stringify(base), 120); } catch (e) {} }
  }
  // Layer league + conference bonuses onto the base (fresh each call, cheap) so
  // every conference shares one ESPN fetch and bonus changes show immediately.
  var bonusData = getBonusData(season, week);
  base.forEach(function(g) {
    g.homeBonus  = teamBonusFor(bonusData, g.homeAbbr, conference);
    g.awayBonus  = teamBonusFor(bonusData, g.awayAbbr, conference);
    g.homePoints = g.homeBasePoints + g.homeBonus;
    g.awayPoints = g.awayBasePoints + g.awayBonus;
  });
  return refreshLocks(base);
}

/** Recompute `locked` from real kickoff time (live mode); preview keeps its simulated status. */
function refreshLocks(games) {
  if (String(getConfig('PreviewMode') || '').toUpperCase() === 'TRUE') return games;
  var now = Date.now();
  games.forEach(function(g) { var k = Date.parse(g.kickoff); if (k) g.locked = now >= k; });
  return games;
}

/** Uncached core: fetches from ESPN and processes into BASE game objects (no bonuses). */
function fetchBaseGamesRaw(week, season, seasonType) {
  seasonType = seasonType || 2;
  var url = ESPN_BASE + '?xhr=1&seasontype=' + seasonType + '&week=' + week + '&year=' + season;

  // Preview mode (Config PreviewMode = TRUE) unlocks past games so the pick UI
  // is fully visible when demoing with historical weeks.
  var preview = String(getConfig('PreviewMode') || '').toUpperCase() === 'TRUE';

  try {
    // ESPN blocks requests from Google's servers without a browser User-Agent
    // (returns 403 Access Denied). Send one so the fetch succeeds.
    var response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });
    if (response.getResponseCode() !== 200) {
      Logger.log('ESPN non-200 (week ' + week + ', ' + season + '): ' + response.getResponseCode());
      return [];
    }
    var data = JSON.parse(response.getContentText());
    var events = data.events
      || (data.content && data.content.sbData && data.content.sbData.events)
      || [];

    return events.map(function(game, idx) {
      try {
      var competition = game.competitions[0];
      var home = competition.competitors.find(function(c) { return c.homeAway === 'home'; });
      var away = competition.competitors.find(function(c) { return c.homeAway === 'away'; });

      var homeWins = extractWins(home ? home.records : []);
      var awayWins = extractWins(away ? away.records : []);
      var scoring  = classifyGame(week, homeWins, awayWins);

      // Real status, with an optional PreviewMode override that simulates a
      // realistic mid-week (mix of upcoming / live / final) for demoing.
      var statusState  = game.status.type.state;          // 'pre' | 'in' | 'post'
      var statusDetail = game.status.type.description;
      var statusShort  = game.status.type.shortDetail || '';   // e.g. "Q3 5:20", "Final"
      var isCompleted  = game.status.type.completed;
      if (preview) {
        var m = idx % 5;
        if (m < 3)       { statusState = 'pre';  statusDetail = PREVIEW_TIMES[idx % PREVIEW_TIMES.length]; statusShort = statusDetail; isCompleted = false; }
        else if (m === 3){ statusState = 'in';   statusDetail = 'LIVE';  statusShort = '2nd Qtr'; isCompleted = false; }
        else             { statusState = 'post'; statusDetail = 'Final'; statusShort = 'Final';   isCompleted = true; }
      }

      var winner = null;
      if (statusState === 'post' && game.status.type.completed) {
        var winnerComp = competition.competitors.find(function(c) { return c.winner === true; });
        winner = winnerComp ? winnerComp.team.abbreviation : null;
      }

      // Betting odds (spread + over/under) if ESPN provides them for this game
      var odds = null;
      if (competition.odds && competition.odds.length) {
        var o = competition.odds[0];
        odds = {
          details:   o.details || '',                              // e.g. "KC -3.5"
          overUnder: (o.overUnder !== undefined && o.overUnder !== null) ? o.overUnder : null,
          provider:  o.provider ? o.provider.name : ''
        };
      }

      // A game is locked for picking once it is no longer in the 'pre' state.
      var kickoff = game.date;                     // ISO 8601 kickoff time
      var locked  = statusState !== 'pre';
      var homeAbbr  = home ? home.team.abbreviation : '';
      var awayAbbr  = away ? away.team.abbreviation : '';
      var homeBonus = 0;   // bonuses are layered on later by getWeeklyMatchups (per conference)
      var awayBonus = 0;

      // Demo only: completed games have no ESPN odds, so synthesize plausible ones.
      if (preview && !odds) odds = makeFakeOdds(game.id, homeAbbr, awayAbbr, homeWins, awayWins);

      return {
        gameId:      game.id,
        kickoff:     kickoff,
        locked:      locked,
        homeTeam:    home ? home.team.displayName : '',
        homeAbbr:    homeAbbr,
        homeLogo:    (home && home.team) ? (home.team.logo || '') : '',
        homeScore:   home ? (home.score || 0) : 0,
        homeWins:    homeWins,
        homeLosses:  extractLosses(home ? home.records : []),
        homeBasePoints: scoring.homePoints,
        homePoints:  scoring.homePoints + homeBonus,
        homeBonus:   homeBonus,
        awayTeam:    away ? away.team.displayName : '',
        awayAbbr:    awayAbbr,
        awayLogo:    (away && away.team) ? (away.team.logo || '') : '',
        awayScore:   away ? (away.score || 0) : 0,
        awayWins:    awayWins,
        awayLosses:  extractLosses(away ? away.records : []),
        awayBasePoints: scoring.awayPoints,
        awayPoints:  scoring.awayPoints + awayBonus,
        awayBonus:   awayBonus,
        gameType:    scoring.gameType,
        odds:        odds,
        status:      statusState,                 // 'pre' | 'in' | 'post'
        statusDetail: statusDetail,
        statusShort: statusShort,
        completed:   isCompleted,
        winner:      winner,
        isGraceBowl: isGraceBowlWeek(week)
      };
      } catch (ge) {
        Logger.log('ESPN game parse skipped: ' + ge.message);
        return null;
      }
    }).filter(function(x) { return x !== null; });

  } catch (e) {
    Logger.log('ESPN fetch error (week ' + week + ', ' + season + '): ' + e.message);
    return [];
  }
}

/**
 * Demo helper — deterministically fabricates a plausible betting line for a game
 * that has no real ESPN odds (used only in PreviewMode). Favors the better record.
 * @returns {{ details, overUnder, provider }}
 */
function makeFakeOdds(gameId, homeAbbr, awayAbbr, homeWins, awayWins) {
  var h = 0, s = String(gameId);
  for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0x7fffffff;
  var winDiff = homeWins - awayWins;
  var fav = winDiff >= 0 ? homeAbbr : awayAbbr;
  var mag = 1.5 + Math.abs(winDiff) * 2 + (h % 3);   // .5-ending spread, ~1.5–13.5
  if (mag > 13.5) mag = 13.5;
  var ou = 39.5 + (h % 14);                          // ~39.5–52.5
  return { details: fav + ' -' + mag, overUnder: ou, provider: 'Demo Line' };
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
