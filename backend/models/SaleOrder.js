const mongoose = require("mongoose");
const { saleOrderSchema } = require("./schemas/branchSchemas");
const { createModelProxy } = require("../utils/context");

const defaultModel = mongoose.models.SaleOrder || mongoose.model("SaleOrder", saleOrderSchema);

module.exports = createModelProxy("SaleOrder", defaultModel);
