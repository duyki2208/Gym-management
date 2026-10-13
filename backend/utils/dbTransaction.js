const mongoose = require("mongoose");

/**
 * Kiểm tra xem kết nối MongoDB hiện tại có hỗ trợ Replica Set / Transactions hay không.
 * Giúp mã nguồn tương thích cả môi trường Standalone (local Docker) và Replica Set (MongoDB Atlas / Production).
 */
function isReplicaSetConnected(connection) {
  try {
    const conn = connection || mongoose.connection;
    if (!conn || !conn.client || !conn.client.topology) return false;
    const type = conn.client.topology.description?.type;
    return type === "ReplicaSetWithPrimary" || type === "Sharded" || type === "ReplicaSetNoPrimary";
  } catch (err) {
    return false;
  }
}

async function runWithOptionalTransaction(connection, work) {
  if (!isReplicaSetConnected(connection)) {
    return work(null);
  }

  const session = await connection.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = {
  isReplicaSetConnected,
  runWithOptionalTransaction,
};
