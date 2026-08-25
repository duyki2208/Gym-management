const mongoose = require("mongoose");
const { auditLogSchema } = require("./schemas/branchSchemas");
const { createModelProxy } = require("../utils/context");

const defaultModel = mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);

module.exports = createModelProxy("AuditLog", defaultModel);
