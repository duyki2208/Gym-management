const mongoose = require("mongoose");
const { productSchema } = require("./schemas/branchSchemas");
const { createModelProxy } = require("../utils/context");

const defaultModel = mongoose.models.Product || mongoose.model("Product", productSchema);

module.exports = createModelProxy("Product", defaultModel);
