const mongoose = require("mongoose");
const { transactionSchema } = require("./schemas/branchSchemas");
const { createModelProxy } = require("../utils/context");

const defaultModel = mongoose.models.Transaction || mongoose.model("Transaction", transactionSchema);

module.exports = createModelProxy("Transaction", defaultModel);
