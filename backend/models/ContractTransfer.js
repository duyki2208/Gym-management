const mongoose = require("mongoose");
const { contractTransferSchema } = require("./schemas/branchSchemas");
const { createModelProxy } = require("../utils/context");

const defaultModel = mongoose.models.ContractTransfer || mongoose.model("ContractTransfer", contractTransferSchema);

module.exports = createModelProxy("ContractTransfer", defaultModel);
