const mongoose = require("mongoose");
const Customer = require("../models/Customer");
const CustomerPackage = require("../models/CustomerPackage");
const ContractTransfer = require("../models/ContractTransfer");
const Transaction = require("../models/Transaction");
const Invoice = require("../models/Invoice");
const AuditLog = require("../models/AuditLog");
const Package = require("../models/Package");
const Setting = require("../models/Setting");
const Commission = require("../models/Commission");
const CommissionPeriod = require("../models/CommissionPeriod");
const User = require("../models/User");
const { handleUpgradeCommission } = require("../services/commissionMutationService");

const getCustomerDomainModels = (req) => {
  const models = {
    ...(req.models || {}),
    connection: req.models?.connection || mongoose.connection,
    Customer: req.models?.Customer || Customer,
    CustomerPackage: req.models?.CustomerPackage || CustomerPackage,
    ContractTransfer: req.models?.ContractTransfer || ContractTransfer,
    Transaction: req.models?.Transaction || Transaction,
    Invoice: req.models?.Invoice || Invoice,
    AuditLog: req.models?.AuditLog || AuditLog,
    Package: req.models?.Package || Package,
    Setting: req.models?.Setting || Setting,
    Commission: req.models?.Commission || Commission,
    CommissionPeriod: req.models?.CommissionPeriod || CommissionPeriod,
    User: req.models?.User || User,
  };
  models.handleUpgradeCommission = (input) => handleUpgradeCommission({
    ...input,
    models,
  });
  return models;
};

module.exports = { getCustomerDomainModels };
