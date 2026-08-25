const mongoose = require("mongoose");
const { invoiceSchema } = require("./schemas/branchSchemas");
const { createModelProxy } = require("../utils/context");

const defaultModel = mongoose.models.Invoice || mongoose.model("Invoice", invoiceSchema);

module.exports = createModelProxy("Invoice", defaultModel);
