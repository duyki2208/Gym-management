const mongoose = require("mongoose");
const { commissionPeriodSchema } = require("./schemas/branchSchemas");
const { createModelProxy } = require("../utils/context");

const defaultModel = mongoose.models.CommissionPeriod || mongoose.model("CommissionPeriod", commissionPeriodSchema);

module.exports = createModelProxy("CommissionPeriod", defaultModel);
