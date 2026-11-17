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
let centralConnection = null;
let centralModels = null;
const branchModelsCache = new Map();

/** Resolve only registered, active branches. Never invent a database name. */
const resolveBranchDbName = async (branchCode) => {
  const normalized = String(branchCode || "").trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(normalized)) {
    throw Object.assign(new Error("Mã chi nhánh không hợp lệ"), { statusCode: 400, code: "INVALID_BRANCH_CODE" });
  }
  const { Branch } = await getCentralModels();
  const branch = await Branch.findOne({ code: normalized }).lean();
  if (!branch || branch.isActive === false) {
    throw Object.assign(new Error(`Chi nhánh ${normalized} không tồn tại hoặc đã ngừng hoạt động`), {
      statusCode: 403, code: "BRANCH_ACCESS_DENIED",
    });
  }
  const dbName = branch.dbName;
  if (!dbName || dbName === "gym_management" || dbName === CENTRAL_DB_NAME ||
      !/^[a-zA-Z0-9_-]+$/.test(dbName)) {
    throw Object.assign(new Error(`Database chi nhánh ${normalized} chưa được cấu hình độc lập`), {
      statusCode: 503, code: "BRANCH_DATABASE_NOT_MIGRATED",
    });
  }
  const shared = await Branch.exists({ code: { $ne: normalized }, dbName });
  if (shared) {
    throw Object.assign(new Error("Các chi nhánh không được dùng chung database"), {
      statusCode: 503, code: "BRANCH_DATABASE_SHARED",
    });
  }
  return dbName;
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

  if (!centralConnection || centralConnection.readyState !== 1) {
    await initCentralConnection();
  }

  // Recheck metadata even for cached models: remapping/deactivation must take effect.
  const branchDbName = await resolveBranchDbName(normalizedCode);
  const cached = branchModelsCache.get(normalizedCode);
  if (!forceRefresh && cached?.dbName === branchDbName) return cached;

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
    ClosureEvent: branchConn.models.ClosureEvent || branchConn.model("ClosureEvent", branchSchemas.closureEventSchema),
    PackageExtensionHistory: branchConn.models.PackageExtensionHistory || branchConn.model("PackageExtensionHistory", branchSchemas.packageExtensionHistorySchema),
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
  }
};

const getCentralConnectionState = () => centralConnection?.readyState ?? 0;

module.exports = {
  initCentralConnection,
  getCentralModels,
  getBranchModels,
  ensureBranchIndexes,
  resolveBranchDbName,
  closeAllConnections,
  getCentralConnectionState,
};
