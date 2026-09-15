const mongoose = require("mongoose");
const { closureEventSchema } = require("./schemas/branchSchemas");
const { createModelProxy } = require("../utils/context");

const defaultModel = mongoose.models.ClosureEvent || mongoose.model("ClosureEvent", closureEventSchema);

module.exports = createModelProxy("ClosureEvent", defaultModel);
