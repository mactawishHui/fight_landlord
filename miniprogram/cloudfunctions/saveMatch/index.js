/**
 * Cloud Function: saveMatch
 *
 * Saves a completed match record and updates the calling player's stats.
 *
 * Input: {
 *   winner, winnerTeam, baseScore, multiplier, finalScore,
 *   isWin, scoreDelta, playerIds, isMultiplayer
 * }
 */
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();

  // Save match record
  await db.collection('matches').add({
    data: {
      winner:        event.winner,
      winnerTeam:    event.winnerTeam,
      baseScore:     event.baseScore,
      multiplier:    event.multiplier,
      finalScore:    event.finalScore,
      playerIds:     event.playerIds ?? [],
      isMultiplayer: event.isMultiplayer ?? false,
      playedAt:      db.serverDate(),
      callerOpenid:  OPENID,
    },
  });

  // Update caller's stats
  const userRef = db.collection('users').doc(OPENID);
  await userRef.update({
    data: {
      totalScore:  _.inc(event.scoreDelta ?? 0),
      totalWins:   _.inc(event.isWin ? 1 : 0),
      totalLosses: _.inc(event.isWin ? 0 : 1),
      lastPlayed:  db.serverDate(),
    },
  });

  return { success: true };
};
