const mongoose = require("mongoose");
const { packageSchema } = require("./schemas/branchSchemas");
const { createModelProxy } = require("../utils/context");

const defaultModel = mongoose.models.Package || mongoose.model("Package", packageSchema);

module.exports = createModelProxy("Package", defaultModel);
