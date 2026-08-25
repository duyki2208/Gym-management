const mongoose = require("mongoose");
const { teamTaskSchema } = require("./schemas/branchSchemas");
const { createModelProxy } = require("../utils/context");

const defaultModel = mongoose.models.TeamTask || mongoose.model("TeamTask", teamTaskSchema);

module.exports = createModelProxy("TeamTask", defaultModel);
