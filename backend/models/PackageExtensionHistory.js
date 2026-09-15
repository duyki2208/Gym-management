const mongoose = require("mongoose");
const { packageExtensionHistorySchema } = require("./schemas/branchSchemas");
const { createModelProxy } = require("../utils/context");

const defaultModel = mongoose.models.PackageExtensionHistory || mongoose.model("PackageExtensionHistory", packageExtensionHistorySchema);

module.exports = createModelProxy("PackageExtensionHistory", defaultModel);
