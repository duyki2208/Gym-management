/**
 * backend/middleware/attachBranchContext.js
 * Middleware to attach Central and Branch DB Models to req context and AsyncLocalStorage
 *
 * Provides:
 *   req.centralModels - Central DB Models (Branch, CentralUser, LoginIndex, CentralSession)
 *   req.models - Active Branch DB Models (User, Customer, Invoice, etc.)
 *   req.branchCode - Active branch code (e.g. "HN01")
 */
const resolveTenant = require("./resolveTenant");
const loadTenantContext = require("./loadTenantContext");

const attachBranchContext = (req, res, next) =>
  resolveTenant(req, res, () => loadTenantContext(req, res, next));

module.exports = attachBranchContext;
