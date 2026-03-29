/**
 * Picks.gs — Pick submission and validation
 *
 * All pick logic is validated server-side. The frontend is for display only.
 */

/**
 * Returns everything the pick tab needs to render.
 * Called on page load and after a pick is submitted.
 *
 * @param {string|null} playerName - if provided, checks for existing pick
 * @returns {{ games: Array, existingPick: string|null, week: number, season: number, isGraceBowl: boolean }}
 */
function getPickPageData(playerName) {
  var week    = Number(getConfig('CurrentWeek')) || 1;
  var season  = Number(getConfig('Season')) || 2025;
  var games   = getWeeklyMatchups(week, season);

  var existingPick = null;
  if (playerName) {
    var picks = getPicksFromSheet(season, week);
    var found = picks.find(function(p) { return p.playerName === playerName; });
    if (found) existingPick = found.teamAbbr;
  }

  return {
    games:       games,
    existingPick: existingPick,
    week:        week,
    season:      season,
    isGraceBowl: isGraceBowlWeek(week)
  };
}

/**
 * Submits a pick. Full server-side validation before writing.
 *
 * @param {string} playerName
 * @param {string} teamAbbr
 * @param {number} week
 * @param {number} season
 * @returns {{ success: boolean, message: string, pointValue: number|null }}
 */
function submitPick(playerName, teamAbbr, week, season) {
  // 1. Validate player exists
  var players = getPlayerNames();
  if (players.indexOf(playerName) === -1) {
    return { success: false, message: 'Player not found: ' + playerName, pointValue: null };
  }

  // 2. Validate week matches CurrentWeek
  var currentWeek = Number(getConfig('CurrentWeek'));
  if (Number(week) !== currentWeek) {
    return { success: false, message: 'Picks are only open for Week ' + currentWeek + '.', pointValue: null };
  }

  // 3. Check for duplicate pick
  if (hasPickForWeek(season, week, playerName)) {
    return { success: false, message: 'You already submitted a pick for Week ' + week + '.', pointValue: null };
  }

  // 4. Validate team is playing this week
  var games = getWeeklyMatchups(week, season);
  var pickedGame = null;
  var pointValue = null;

  for (var i = 0; i < games.length; i++) {
    var game = games[i];
    if (game.homeAbbr === teamAbbr) {
      pickedGame = game;
      pointValue = game.homePoints;
      break;
    }
    if (game.awayAbbr === teamAbbr) {
      pickedGame = game;
      pointValue = game.awayPoints;
      break;
    }
  }

  if (!pickedGame) {
    return { success: false, message: teamAbbr + ' is not playing this week.', pointValue: null };
  }

  // 5. Don't allow picks on completed games
  if (pickedGame.completed) {
    return { success: false, message: 'That game has already ended.', pointValue: null };
  }

  // 6. Save the pick
  savePick(season, week, playerName, teamAbbr);

  return {
    success: true,
    message: 'Pick saved! You picked the ' + teamAbbr + ' for ' + pointValue + ' point(s).',
    pointValue: pointValue
  };
}
