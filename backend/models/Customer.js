const mongoose = require("mongoose");
const { customerSchema } = require("./schemas/branchSchemas");
const { createModelProxy } = require("../utils/context");

const defaultModel = mongoose.models.Customer || mongoose.model("Customer", customerSchema);

module.exports = createModelProxy("Customer", defaultModel);
