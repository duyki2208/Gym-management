const mongoose = require("mongoose");
const { centralUserSchema } = require("./schemas/centralSchemas");

const defaultModel = mongoose.models.CentralUser || mongoose.model("CentralUser", centralUserSchema);

module.exports = defaultModel;
