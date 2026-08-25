const mongoose = require("mongoose");
const { counterSchema } = require("./schemas/branchSchemas");
const { createModelProxy } = require("../utils/context");

const defaultModel = mongoose.models.Counter || mongoose.model("Counter", counterSchema);

module.exports = createModelProxy("Counter", defaultModel);
