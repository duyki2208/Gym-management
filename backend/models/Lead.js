const mongoose = require("mongoose");
const { leadSchema } = require("./schemas/branchSchemas");
const { createModelProxy } = require("../utils/context");

const defaultModel = mongoose.models.Lead || mongoose.model("Lead", leadSchema);

module.exports = createModelProxy("Lead", defaultModel);
