const mongoose = require("mongoose");
const { branchSchema } = require("./schemas/centralSchemas");

const defaultModel = mongoose.models.Branch || mongoose.model("Branch", branchSchema);

module.exports = defaultModel;
