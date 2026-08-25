const mongoose = require("mongoose");
const { importOrderSchema } = require("./schemas/branchSchemas");
const { createModelProxy } = require("../utils/context");

const defaultModel = mongoose.models.ImportOrder || mongoose.model("ImportOrder", importOrderSchema);

module.exports = createModelProxy("ImportOrder", defaultModel);
