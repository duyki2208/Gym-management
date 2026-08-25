const mongoose = require("mongoose");
const { sessionSchema } = require("./schemas/branchSchemas");
const { createModelProxy } = require("../utils/context");

const defaultModel = mongoose.models.Session || mongoose.model("Session", sessionSchema);

module.exports = createModelProxy("Session", defaultModel);
