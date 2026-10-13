const mongoose = require("mongoose");
const {
  getCentralConnectionState,
} = require("../db/branchConnectionManager");
const cacheService = require("../utils/cacheService");
const { getDatabaseTopologyStatus } = require("../config/db");
const { getReleaseSha } = require("../utils/releaseIdentity");

const buildReadiness = ({
  defaultState,
  centralState,
  cacheStatus = { redisRequired: false },
  topologyStatus = { transactionRequired: false },
}) => {
  const dependencies = {
    defaultDatabase: defaultState === 1,
    centralDatabase: centralState === 1,
    sharedCache: !cacheStatus.redisRequired || cacheStatus.redisConnected === true,
    transactions: !topologyStatus.transactionRequired || topologyStatus.transactionCapable === true,
  };
  return {
    ready: Object.values(dependencies).every(Boolean),
    dependencies,
  };
};

const live = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: {
        status: "live",
        timestamp: new Date().toISOString(),
        release: getReleaseSha(),
      },
      message: "Service is live",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Health check failed" });
  }
};

const ready = async (req, res) => {
  try {
    const readiness = buildReadiness({
      defaultState: mongoose.connection.readyState,
      centralState: getCentralConnectionState(),
      cacheStatus: cacheService.getStatus(),
      topologyStatus: getDatabaseTopologyStatus(),
    });
    return res.status(readiness.ready ? 200 : 503).json({
      success: readiness.ready,
      data: {
        status: readiness.ready ? "ready" : "not_ready",
        dependencies: readiness.dependencies,
        release: getReleaseSha(),
        timestamp: new Date().toISOString(),
      },
      message: readiness.ready
        ? "Service is ready"
        : "Service dependencies are not ready",
    });
  } catch (error) {
    return res.status(503).json({
      success: false,
      data: { status: "not_ready" },
      message: "Readiness check failed",
    });
  }
};

module.exports = { buildReadiness, live, ready };
