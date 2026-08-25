const mongoose = require("mongoose");

/**
 * Kiểm tra xem kết nối MongoDB hiện tại có hỗ trợ Replica Set / Transactions hay không.
 * Giúp mã nguồn tương thích cả môi trường Standalone (local Docker) và Replica Set (MongoDB Atlas / Production).
 */
function isReplicaSetConnected() {
  try {
    const conn = mongoose.connection;
    if (!conn || !conn.client || !conn.client.topology) return false;
    const type = conn.client.topology.description?.type;
    return type === "ReplicaSetWithPrimary" || type === "Sharded" || type === "ReplicaSetNoPrimary";
  } catch (err) {
    return false;
  }
}

module.exports = {
  isReplicaSetConnected,
};
