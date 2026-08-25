const mongoose = require("mongoose");
const { workoutSessionSchema } = require("./schemas/branchSchemas");
const { createModelProxy } = require("../utils/context");

const defaultModel = mongoose.models.WorkoutSession || mongoose.model("WorkoutSession", workoutSessionSchema);

module.exports = createModelProxy("WorkoutSession", defaultModel);
