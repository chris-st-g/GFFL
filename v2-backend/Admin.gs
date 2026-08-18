/**
 * Admin.gs — Commissioner-only functions
 *
 * Password is stored as a SHA-256 hex hash in PropertiesService.
 * Session tokens are random strings stored in PropertiesService, expire after 1 hour.
 *
 * To set the admin password (run once from the Apps Script editor):
 *   setAdminPassword('yourPasswordHere');
 */

var ADMIN_TOKEN_KEY  = 'ADMIN_TOKEN';
var ADMIN_EXPIRY_KEY = 'ADMIN_EXPIRY';
var ADMIN_HASH_KEY   = 'ADMIN_PASSWORD_HASH';
var TOKEN_TTL_MS     = 60 * 60 * 1000; // 1 hour

// ── Password Setup ────────────────────────────────────────────────────────────

/**
 * Run this once from the Apps Script editor to set the admin password.
 * Stores a SHA-256 hash — the plaintext is never saved anywhere.
 *
 * @param {string} password
 */
function setAdminPassword(password) {
  var hash = hashPassword(password);
  PropertiesService.getScriptProperties().setProperty(ADMIN_HASH_KEY, hash);
  Logger.log('Admin password set successfully.');
}

// ── Login ─────────────────────────────────────────────────────────────────────

/**
 * Validates the admin password and returns a session token.
 * Called by the frontend login form.
 *
 * @param {string} password
 * @returns {{ success: boolean, token: string|null }}
 */
function adminLogin(password) {
  var storedHash = PropertiesService.getScriptProperties().getProperty(ADMIN_HASH_KEY);
  if (!storedHash) {
    return { success: false, token: null, message: 'Admin password not set. Run setAdminPassword() first.' };
  }

  if (hashPassword(password) !== storedHash) {
    return { success: false, token: null };
  }

  var token  = generateToken();
  var expiry = Date.now() + TOKEN_TTL_MS;
  var props  = PropertiesService.getScriptProperties();
  props.setProperty(ADMIN_TOKEN_KEY, token);
  props.setProperty(ADMIN_EXPIRY_KEY, String(expiry));

  return { success: true, token: token };
}

// ── Token Validation ──────────────────────────────────────────────────────────

/**
 * Returns true if the token is valid and not expired.
 * @param {string} token
 * @returns {boolean}
 */
function validateToken(token) {
  var props  = PropertiesService.getScriptProperties();
  var stored = props.getProperty(ADMIN_TOKEN_KEY);
  var expiry = parseInt(props.getProperty(ADMIN_EXPIRY_KEY), 10);
  return token && token === stored && Date.now() < expiry;
}

// ── Admin Actions ─────────────────────────────────────────────────────────────

/**
 * Updates the CurrentWeek in Config.
 * @param {string} token
 * @param {number} week
 * @returns {{ success: boolean, message: string }}
 */
function setCurrentWeek(token, week) {
  if (!validateToken(token)) return { success: false, message: 'Unauthorized.' };
  week = parseInt(week, 10);
  if (isNaN(week) || week < 1 || week > 18) return { success: false, message: 'Invalid week number.' };
  setConfig('CurrentWeek', week);
  return { success: true, message: 'Week set to ' + week + '.' };
}

/**
 * Adds bonus points for a player.
 * @param {string} token
 * @param {number} season
 * @param {number} week
 * @param {string} playerName
 * @param {number} points
 * @param {string} reason
 * @returns {{ success: boolean, message: string }}
 */
function addBonusPoints(token, season, week, playerName, points, reason) {
  if (!validateToken(token)) return { success: false, message: 'Unauthorized.' };

  var players = getPlayerNames();
  if (players.indexOf(playerName) === -1) {
    return { success: false, message: 'Player not found.' };
  }
  if (isNaN(Number(points)) || Number(points) === 0) {
    return { success: false, message: 'Enter a non-zero point value.' };
  }

  saveBonusPoints(season, week, playerName, Number(points), reason);
  return { success: true, message: 'Bonus added for ' + playerName + '.' };
}

/**
 * Adds/updates/clears a bonus on a specific TEAM in the current week.
 * Only allowed while that team's game has not started. Pass bonus <= 0 to clear.
 * @param {string} token
 * @param {string} gameId
 * @param {string} teamAbbr
 * @param {number} bonus
 * @returns {{ success: boolean, message: string }}
 */
function adminSetTeamBonus(token, scope, gameId, teamAbbr, bonus) {
  if (!validateToken(token)) return { success: false, message: 'Unauthorized.' };
  var season = getActiveSeason();
  var week   = getActiveWeek();
  bonus = Number(bonus) || 0;
  scope = scope || 'LEAGUE';
  if (scope !== 'LEAGUE' && getConferenceNames().indexOf(scope) === -1) {
    return { success: false, message: 'Invalid scope.' };
  }

  // Verify the team's game is in the current week, includes that team, and hasn't started.
  var games = getWeeklyMatchups(week, season);
  var g = null;
  for (var i = 0; i < games.length; i++) {
    if (String(games[i].gameId) === String(gameId)) { g = games[i]; break; }
  }
  if (!g) return { success: false, message: 'Game not found in Week ' + week + '.' };
  if (g.homeAbbr !== teamAbbr && g.awayAbbr !== teamAbbr) {
    return { success: false, message: teamAbbr + ' is not in that game.' };
  }
  if (g.locked) return { success: false, message: 'That game has already started — bonus can only be set before kickoff.' };

  setTeamBonus(season, week, scope, gameId, teamAbbr, bonus);
  var where = (scope === 'LEAGUE') ? 'league-wide' : scope;
  return {
    success: true,
    message: bonus > 0 ? ('+' + bonus + ' set on ' + teamAbbr + ' (' + where + ').')
                       : ('Bonus cleared on ' + teamAbbr + ' (' + where + ').')
  };
}

/**
 * Returns the data for the bonus editor: upcoming games + current bonuses by scope.
 * @param {string} token
 * @returns {{ games, league, conf, scopes, week }}
 */
function adminGetBonusEditor(token) {
  if (!validateToken(token)) return { error: 'Unauthorized' };
  var season = getActiveSeason();
  var week   = getActiveWeek();
  var games  = getWeeklyMatchups(week, season)
    .filter(function(g) { return !g.locked; })
    .map(function(g) { return { gameId: g.gameId, awayAbbr: g.awayAbbr, homeAbbr: g.homeAbbr, gameType: g.gameType }; });
  var bd = getBonusData(season, week);
  return { games: games, league: bd.league, conf: bd.conf, scopes: ['LEAGUE'].concat(getConferenceNames()), week: week };
}

/**
 * Manually triggers scoring for a completed week.
 * @param {string} token
 * @param {number} week
 * @param {number} season
 * @returns {{ success: boolean }}
 */
function triggerWeekScoring(token, week, season) {
  if (!validateToken(token)) return { success: false, message: 'Unauthorized.' };
  scoreWeekPicks(season, week);
  return { success: true };
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function hashPassword(password) {
  var bytes  = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
  return bytes.map(function(b) {
    return ('0' + (b & 0xff).toString(16)).slice(-2);
  }).join('');
}

function generateToken() {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(Date.now() + Math.random()));
  return bytes.map(function(b) {
    return ('0' + (b & 0xff).toString(16)).slice(-2);
  }).join('').substring(0, 32);
}

/**
 * Adds a new grahamchise with full conference/division/rookie metadata.
 * @param {string} token
 * @param {string} name
 * @param {string} conference
 * @param {string} division
 * @param {boolean} isRookie
 * @returns {{ success: boolean, message: string }}
 */
function adminAddPlayerFull(token, name, conference, division, isRookie) {
  if (!validateToken(token)) return { success: false, message: 'Unauthorized.' };
  return addPlayer(name, conference, division, isRookie);
}

/**
 * Moves a grahamchise to a different conference/division.
 * @param {string} token
 * @param {string} name
 * @param {string} conference
 * @param {string} division
 * @returns {{ success: boolean, message: string }}
 */
function adminMovePlayer(token, name, conference, division) {
  if (!validateToken(token)) return { success: false, message: 'Unauthorized.' };
  return movePlayer(name, conference, division);
}

/**
 * Enables/disables automatic week detection (reads the live week from ESPN).
 * @param {string} token
 * @param {boolean} enabled
 * @returns {{ success: boolean, message: string }}
 */
function adminSetAutoWeek(token, enabled) {
  if (!validateToken(token)) return { success: false, message: 'Unauthorized.' };
  setConfig('AutoWeek', enabled ? 'TRUE' : 'FALSE');
  return {
    success: true,
    message: enabled ? 'Automatic week ON — week/season now read live from ESPN.'
                     : 'Automatic week OFF — using the manual week above.'
  };
}

/**
 * Declares (or clears) the Alma Cup winner for a conference — used for the
 * manual tiebreakers (reset-and-continue, Indian Gut). Pass empty name to clear.
 * @param {string} token
 * @param {string} conference
 * @param {string} name  - grahamchise name, or '' to clear the override
 * @returns {{ success: boolean, message: string }}
 */
function setAlmaWinner(token, conference, name) {
  if (!validateToken(token)) return { success: false, message: 'Unauthorized.' };
  if (name) {
    setConfig('AlmaWinner_' + conference, name);
    return { success: true, message: 'Alma Cup winner for ' + conference + ' set to ' + name + '.' };
  }
  setConfig('AlmaWinner_' + conference, '');
  return { success: true, message: 'Alma Cup winner for ' + conference + ' cleared.' };
}

/**
 * Toggles rookie status for an existing grahamchise.
 * @param {string} token
 * @param {string} playerName
 * @param {boolean} isRookie
 * @returns {{ success: boolean, message: string }}
 */
function adminToggleRookie(token, playerName, isRookie) {
  if (!validateToken(token)) return { success: false, message: 'Unauthorized.' };
  return updatePlayerRookieStatus(playerName, isRookie);
}
