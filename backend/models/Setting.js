const mongoose = require("mongoose");
const { settingSchema } = require("./schemas/branchSchemas");
const { createModelProxy } = require("../utils/context");

const defaultModel = mongoose.models.Setting || mongoose.model("Setting", settingSchema);

module.exports = createModelProxy("Setting", defaultModel);
