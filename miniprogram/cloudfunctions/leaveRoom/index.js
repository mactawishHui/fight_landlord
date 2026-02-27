/**
 * Cloud Function: leaveRoom
 *
 * Removes the calling player from the room's players array.
 * If the room becomes empty after removal, deletes the room document.
 *
 * Input: { roomId }
 * Returns: { success: true }
 */
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { roomId } = event;

  if (!roomId) throw new Error('roomId is required');

  // Fetch the room
  const snap = await db.collection('rooms').where({ roomId }).get();
  if (!snap.data || snap.data.length === 0) {
    // Already gone — treat as success
    return { success: true };
  }

  const room = snap.data[0];
  const docId = room._id;

  // Filter out the leaving player
  const remaining = (room.players || []).filter(p => p.openid !== OPENID);

  if (remaining.length === 0) {
    // Room is empty — delete it
    await db.collection('rooms').doc(docId).remove();
  } else {
    // Update the players array and status
    const newStatus = room.status === 'playing' ? 'finished' : room.status;
    await db.collection('rooms').doc(docId).update({
      data: {
        players: remaining,
        status: newStatus,
        updatedAt: db.serverDate(),
      },
    });
  }

  return { success: true };
};
