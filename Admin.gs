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
