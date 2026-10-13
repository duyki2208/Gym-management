const { getCentralModels, getBranchModels } = require("../db/branchConnectionManager");
const { runWithContext } = require("../utils/context");

/** Load the model set selected by `resolveTenant` and bind it to this request. */
const loadTenantContext = async (req, res, next) => {
  try {
    req.centralModels = await getCentralModels();
    req.models = await getBranchModels(req.branchCode);

    return runWithContext(
      {
        models: req.models,
        centralModels: req.centralModels,
        branchCode: req.branchCode,
        req,
      },
      next
    );
  } catch (error) {
    return next(error);
  }
};

module.exports = loadTenantContext;
