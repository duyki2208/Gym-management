const mongoose = require("mongoose");
const { kpiTargetSchema } = require("./schemas/branchSchemas");
const { createModelProxy } = require("../utils/context");

const defaultModel = mongoose.models.KPITarget || mongoose.model("KPITarget", kpiTargetSchema);

module.exports = createModelProxy("KPITarget", defaultModel);
