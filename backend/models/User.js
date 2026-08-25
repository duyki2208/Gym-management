const mongoose = require("mongoose");
const { userSchema } = require("./schemas/branchSchemas");
const { createModelProxy } = require("../utils/context");

const defaultModel = mongoose.models.User || mongoose.model("User", userSchema);

module.exports = createModelProxy("User", defaultModel);
