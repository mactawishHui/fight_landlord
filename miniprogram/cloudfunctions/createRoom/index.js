/**
 * Cloud Function: createRoom
 *
 * Creates a new multiplayer game room in the `rooms` collection.
 * Input: { nickname, avatarUrl }
 * Returns: { room: RoomDoc }
 */
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function generateRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const roomId = generateRoomId();

  const room = {
    roomId,
    status: 'waiting',       // waiting | playing | finished
    players: [
      {
        openid: OPENID,
        nickname: event.nickname || '玩家',
        avatarUrl: event.avatarUrl || '',
        slot: 0,
      },
    ],
    maxPlayers: 3,
    gameState: null,
    createdAt: db.serverDate(),
    updatedAt: db.serverDate(),
  };

  const result = await db.collection('rooms').add({ data: room });

  return { room: { ...room, _id: result._id } };
};
