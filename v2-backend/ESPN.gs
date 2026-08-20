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

// ─── Active week/season (auto-detected from ESPN, or manual) ──────────────────

var _espnCurrent;   // memoized per execution

/** Asks ESPN for the current NFL week/season. Cached ~10 min (rarely changes). */
function espnCurrent() {
  if (_espnCurrent !== undefined) return _espnCurrent;
  var cache = CacheService.getScriptCache();
  var hit = cache.get('espn_current');
  if (hit) { try { _espnCurrent = JSON.parse(hit); return _espnCurrent; } catch (e) {} }

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
      // Season type: 1 = preseason, 2 = regular, 3 = postseason. Needed so auto
      // mode fetches the correct slate (preseason games live under seasontype=1).
      var st = (sb.season && sb.season.type) ||
               (sb.leagues && sb.leagues[0] && sb.leagues[0].season && sb.leagues[0].season.type &&
                 (sb.leagues[0].season.type.type || sb.leagues[0].season.type));
      if (wk && sn) _espnCurrent = { week: Number(wk), season: Number(sn), seasonType: Number(st) || 2 };
    }
  } catch (e) { Logger.log('espnCurrent error: ' + e.message); }

  if (_espnCurrent) { try { cache.put('espn_current', JSON.stringify(_espnCurrent), 600); } catch (e) {} }
  return _espnCurrent;
}

/** True when the commissioner has enabled automatic week detection. */
function isAutoWeek() { return String(getConfig('AutoWeek') || '').toUpperCase() === 'TRUE'; }

var _activeCtx;   // per-execution memo of the resolved active week/season/type
var _liveWeek;    // per-execution memo for resolveAutoWeek_

/**
 * The resolved {week, season, seasonType} the app should use right now.
 * In auto mode this may require ESPN calls (espnCurrent + resolveAutoWeek_), so
 * the result is cached ~10 min — week resolution then runs at most once per
 * window instead of on every request. Manual mode reads Config fresh each time.
 */
function activeContext() {
  if (_activeCtx !== undefined) return _activeCtx;
  if (!isAutoWeek()) {
    _activeCtx = {
      week:       Number(getConfig('CurrentWeek')) || 1,
      season:     Number(getConfig('Season')) || 2025,
      seasonType: Number(getConfig('SeasonType')) || 2
    };
    return _activeCtx;
  }
  var cache = CacheService.getScriptCache();
  var hit = cache.get('active_ctx');
  if (hit) { try { _activeCtx = JSON.parse(hit); return _activeCtx; } catch (e) {} }

  var c = espnCurrent();
  if (!c) {
    _activeCtx = { week: Number(getConfig('CurrentWeek')) || 1, season: Number(getConfig('Season')) || 2025, seasonType: 2 };
    return _activeCtx;
  }
  _activeCtx = { week: resolveAutoWeek_(c), season: c.season, seasonType: c.seasonType };
  try { cache.put('active_ctx', JSON.stringify(_activeCtx), 600); } catch (e) {}
  return _activeCtx;
}

function getActiveSeason()     { return activeContext().season; }
function getActiveWeek()       { return activeContext().week; }
function getActiveSeasonType() { return activeContext().seasonType; }

/**
 * ESPN's "current week" pointer lags — it keeps pointing at a slate for a day or
 * two after those games finish. So in auto mode, if every game in ESPN's current
 * week is already final, roll forward to the next week that still has games to
 * play. Called once per cache window via activeContext().
 */
function resolveAutoWeek_(c) {
  if (_liveWeek !== undefined) return _liveWeek;
  var wk = c.week;
  try {
    for (var hops = 0; hops < 4; hops++) {
      var games = getWeeklyMatchups(wk, c.season, null, c.seasonType);
      if (!games.length) break;                                   // no data — stop
      if (!games.every(function(g) { return g.status === 'post'; })) break; // still games to play
      var next = getWeeklyMatchups(wk + 1, c.season, null, c.seasonType);
      if (!next.length) break;                                    // no next week in this season type
      wk += 1;
    }
  } catch (e) { Logger.log('resolveAutoWeek_ error: ' + e.message); }
  _liveWeek = wk;
  return _liveWeek;
}

/**
 * Human display label for a week. ESPN week 1 of the preseason is the Hall of Fame
 * game; weeks after that are shown as "Preseason Wk N" using ESPN's own index
 * (so ESPN week 3 → "Preseason Wk 3"). Regular season is shown as-is.
 * @param {number} week        ESPN week index
 * @param {number} seasonType  1=pre, 2=regular, 3=post
 */
function weekLabel(week, seasonType) {
  if (seasonType === 1) {
    if (week <= 1) return 'Hall of Fame';
    return 'Preseason Wk ' + week;
  }
  if (seasonType === 3) return 'Playoffs Wk ' + week;
  return 'Week ' + week;
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
  seasonType = seasonType || getActiveSeasonType();   // follow live pre/regular/post season
  var cacheKey = 'basegames_' + season + '_' + seasonType + '_' + week;
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

/** Recompute `locked` from real kickoff time. */
function refreshLocks(games) {
  var now = Date.now();
  games.forEach(function(g) { var k = Date.parse(g.kickoff); if (k) g.locked = now >= k; });
  return games;
}

/** Uncached core: fetches from ESPN and processes into BASE game objects (no bonuses). */
function fetchBaseGamesRaw(week, season, seasonType) {
  seasonType = seasonType || 2;
  var url = ESPN_BASE + '?xhr=1&seasontype=' + seasonType + '&week=' + week + '&year=' + season;

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

      // Real ESPN status.
      var statusState  = game.status.type.state;          // 'pre' | 'in' | 'post'
      var statusDetail = game.status.type.description;
      var statusShort  = game.status.type.shortDetail || '';   // e.g. "Q3 5:20", "Final"
      var isCompleted  = game.status.type.completed;

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
