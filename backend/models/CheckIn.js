const mongoose = require("mongoose");
const { checkInSchema } = require("./schemas/branchSchemas");
const { createModelProxy } = require("../utils/context");

const defaultModel = mongoose.models.CheckIn || mongoose.model("CheckIn", checkInSchema);

module.exports = createModelProxy("CheckIn", defaultModel);