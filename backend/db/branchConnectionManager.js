/**
 * backend/db/branchConnectionManager.js
 * Multi-Branch Database Connection & Model Manager
 *
 * Implements Database-Per-Branch Pattern with Connection Pooling via mongoose.useDb()
 */
const mongoose = require("mongoose");
const {
  branchSchema,
  centralUserSchema,
  loginIndexSchema,
  centralSessionSchema,
} = require("../models/schemas/centralSchemas");
const branchSchemas = require("../models/schemas/branchSchemas");

// Database Names
const CENTRAL_DB_NAME = process.env.CENTRAL_DB_NAME || "gympro_central";
const BRANCH_DB_PREFIX = process.env.BRANCH_DB_PREFIX || "gympro_branch_";

// Lấy DB name mặc định từ MONGO_URI (ví dụ: gym_management)
const getLegacyDbName = () => {
  const uri = process.env.MONGO_URI || "";
  const match = uri.match(/^(mongodb(?:\+srv)?:\/\/[^\/]+\/)([^?\/]+)?(\?.*)?$/);
  return (match && match[2]) ? match[2] : "gym_management";
};

let centralConnection = null;
let centralModels = null;
const branchModelsCache = new Map();
const branchDbNameCache = new Map();

/**
 * Format / resolve database name for a branch code
 * @param {string} branchCode - e.g. "HN01", "HCM01"
 * @returns {Promise<string>} - e.g. "gym_management" (HN01) or "gympro_branch_hcm01" (HCM01)
 */
const resolveBranchDbName = async (branchCode) => {
  if (!branchCode) {
    throw new Error("branchCode is required to resolve branch database name");
  }
  const normalized = branchCode.trim().toUpperCase();

  if (branchDbNameCache.has(normalized)) {
    return branchDbNameCache.get(normalized);
  }

  // Tra cứu dbName từ Central DB nếu đã có
  try {
    if (centralModels && centralModels.Branch) {
      const branchDoc = await centralModels.Branch.findOne({ code: normalized }).lean();
      if (branchDoc && branchDoc.dbName) {
        branchDbNameCache.set(normalized, branchDoc.dbName);
        return branchDoc.dbName;
      }
    }
  } catch (err) {
    console.warn(`[resolveBranchDbName] Could not query Central DB for ${normalized}: ${err.message}`);
  }

  // Fallback: Nếu là HN01 -> trỏ về DB gốc (gym_management); nếu chi nhánh khác -> prefix gympro_branch_<code>
  const fallbackDbName =
    normalized === "HN01"
      ? getLegacyDbName()
      : `${BRANCH_DB_PREFIX}${normalized.toLowerCase()}`;

  branchDbNameCache.set(normalized, fallbackDbName);
  return fallbackDbName;
};

/**
 * Initialize Central Database Connection and Central Models
 */
const initCentralConnection = async () => {
  if (centralConnection && centralConnection.readyState === 1 && centralModels) {
    return { centralConnection, centralModels };
  }

  const baseUri = process.env.MONGO_URI;
  if (!baseUri) {
    throw new Error("Chưa tìm thấy biến MONGO_URI trong file .env!");
  }

  // Parse and replace DB name with CENTRAL_DB_NAME
  let centralUri = baseUri;
  const uriMatch = baseUri.match(/^(mongodb(?:\+srv)?:\/\/[^\/]+\/)([^?\/]+)?(\?.*)?$/);
  if (uriMatch) {
    const prefix = uriMatch[1];
    const query = uriMatch[3] || "";
    centralUri = `${prefix}${CENTRAL_DB_NAME}${query}`;
  }

  // Create primary central connection
  if (!centralConnection || centralConnection.readyState === 0) {
    centralConnection = await mongoose.createConnection(centralUri, {
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 5000,
    }).asPromise();

    console.log(`[CentralDB] Connected to ${CENTRAL_DB_NAME} at ${centralConnection.host}`);
  }

  // Register Central Models on the Central Connection
  centralModels = {
    Branch: centralConnection.models.Branch || centralConnection.model("Branch", branchSchema),
    CentralUser: centralConnection.models.CentralUser || centralConnection.model("CentralUser", centralUserSchema),
    LoginIndex: centralConnection.models.LoginIndex || centralConnection.model("LoginIndex", loginIndexSchema),
    CentralSession: centralConnection.models.CentralSession || centralConnection.model("CentralSession", centralSessionSchema),
    connection: centralConnection,
  };

  return { centralConnection, centralModels };
};

/**
 * Ensure all compound indexes are built for models of a specific branch
 * @param {Object} models - Map of Mongoose models
 */
const ensureBranchIndexes = async (models) => {
  try {
    const modelKeys = Object.keys(models).filter((k) => k !== "connection");
    await Promise.all(
      modelKeys.map(async (key) => {
        const model = models[key];
        if (model && typeof model.syncIndexes === "function") {
          await model.syncIndexes().catch((err) => {
            console.warn(`[IndexWarning] ${key}: ${err.message}`);
          });
        }
      })
    );
  } catch (error) {
    console.error(`[IndexError] Error ensuring branch indexes: ${error.message}`);
  }
};

/**
 * Get Central Models (Initializes if not already connected)
 */
const getCentralModels = async () => {
  if (!centralModels) {
    await initCentralConnection();
  }
  return centralModels;
};

/**
 * Get or create Models for a specific Branch DB
 * @param {string} branchCode - e.g. "HN01", "HCM01"
 * @param {boolean} forceRefresh - If true, ignores cache
 */
const getBranchModels = async (branchCode, forceRefresh = false) => {
  if (!branchCode) {
    throw new Error("branchCode is required to get branch models");
  }

  const normalizedCode = branchCode.trim().toUpperCase();

  if (!forceRefresh && branchModelsCache.has(normalizedCode)) {
    return branchModelsCache.get(normalizedCode);
  }

  if (!centralConnection || centralConnection.readyState !== 1) {
    await initCentralConnection();
  }

  // Tra cứu tên DB thật từ Central Branch metadata (hoặc fallback)
  const branchDbName = await resolveBranchDbName(normalizedCode);

  // useDb shares the same underlying connection pool
  const branchConn = centralConnection.useDb(branchDbName, { useCache: true });

  // Map pure schemas to model instances on this branch connection
  const models = {
    User: branchConn.models.User || branchConn.model("User", branchSchemas.userSchema),
    Counter: branchConn.models.Counter || branchConn.model("Counter", branchSchemas.counterSchema),
    Customer: branchConn.models.Customer || branchConn.model("Customer", branchSchemas.customerSchema),
    CustomerPackage: branchConn.models.CustomerPackage || branchConn.model("CustomerPackage", branchSchemas.customerPackageSchema),
    CheckIn: branchConn.models.CheckIn || branchConn.model("CheckIn", branchSchemas.checkInSchema),
    Invoice: branchConn.models.Invoice || branchConn.model("Invoice", branchSchemas.invoiceSchema),
    Transaction: branchConn.models.Transaction || branchConn.model("Transaction", branchSchemas.transactionSchema),
    SaleOrder: branchConn.models.SaleOrder || branchConn.model("SaleOrder", branchSchemas.saleOrderSchema),
    Product: branchConn.models.Product || branchConn.model("Product", branchSchemas.productSchema),
    ImportOrder: branchConn.models.ImportOrder || branchConn.model("ImportOrder", branchSchemas.importOrderSchema),
    Package: branchConn.models.Package || branchConn.model("Package", branchSchemas.packageSchema),
    Commission: branchConn.models.Commission || branchConn.model("Commission", branchSchemas.commissionSchema),
    CommissionPeriod: branchConn.models.CommissionPeriod || branchConn.model("CommissionPeriod", branchSchemas.commissionPeriodSchema),
    KPITarget: branchConn.models.KPITarget || branchConn.model("KPITarget", branchSchemas.kpiTargetSchema),
    Lead: branchConn.models.Lead || branchConn.model("Lead", branchSchemas.leadSchema),
    Schedule: branchConn.models.Schedule || branchConn.model("Schedule", branchSchemas.scheduleSchema),
    Session: branchConn.models.Session || branchConn.model("Session", branchSchemas.sessionSchema),
    Setting: branchConn.models.Setting || branchConn.model("Setting", branchSchemas.settingSchema),
    TeamTask: branchConn.models.TeamTask || branchConn.model("TeamTask", branchSchemas.teamTaskSchema),
    WorkoutSession: branchConn.models.WorkoutSession || branchConn.model("WorkoutSession", branchSchemas.workoutSessionSchema),
    ContractTransfer: branchConn.models.ContractTransfer || branchConn.model("ContractTransfer", branchSchemas.contractTransferSchema),
    AuditLog: branchConn.models.AuditLog || branchConn.model("AuditLog", branchSchemas.auditLogSchema),
    connection: branchConn,
    branchCode: normalizedCode,
    dbName: branchDbName,
  };

  // Ensure compound indexes on first creation
  ensureBranchIndexes(models);

  branchModelsCache.set(normalizedCode, models);
  return models;
};

/**
 * Close all database connections (for tests and graceful server shutdown)
 */
const closeAllConnections = async () => {
  if (centralConnection) {
    await centralConnection.close();
    centralConnection = null;
    centralModels = null;
    branchModelsCache.clear();
    branchDbNameCache.clear();
  }
};

module.exports = {
  initCentralConnection,
  getCentralModels,
  getBranchModels,
  ensureBranchIndexes,
  resolveBranchDbName,
  getLegacyDbName,
  closeAllConnections,
};
