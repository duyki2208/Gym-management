const mongoose = require("mongoose");
const { commissionSchema } = require("./schemas/branchSchemas");
const { createModelProxy } = require("../utils/context");

const defaultModel = mongoose.models.Commission || mongoose.model("Commission", commissionSchema);

module.exports = createModelProxy("Commission", defaultModel);
