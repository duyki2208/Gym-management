const mongoose = require("mongoose");
const { scheduleSchema } = require("./schemas/branchSchemas");
const { createModelProxy } = require("../utils/context");

const defaultModel = mongoose.models.Schedule || mongoose.model("Schedule", scheduleSchema);

module.exports = createModelProxy("Schedule", defaultModel);
