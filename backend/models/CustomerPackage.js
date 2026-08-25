const mongoose = require("mongoose");
const { customerPackageSchema } = require("./schemas/branchSchemas");
const { createModelProxy } = require("../utils/context");

const defaultModel = mongoose.models.CustomerPackage || mongoose.model("CustomerPackage", customerPackageSchema);

module.exports = createModelProxy("CustomerPackage", defaultModel);
