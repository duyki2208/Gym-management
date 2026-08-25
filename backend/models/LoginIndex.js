const mongoose = require("mongoose");
const { loginIndexSchema } = require("./schemas/centralSchemas");

const defaultModel = mongoose.models.LoginIndex || mongoose.model("LoginIndex", loginIndexSchema);

module.exports = defaultModel;
