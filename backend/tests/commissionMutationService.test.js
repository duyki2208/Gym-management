const {
  createSaleCommission,
  handleUpgradeCommission,
} = require("../services/commissionMutationService");

describe("commission mutation service", () => {
  test("creates sale commission and snapshot through injected tenant models", async () => {
    const commission = { _id: "commission-1" };
    const models = {
      Setting: { findOne: jest.fn().mockResolvedValue({ saleNewContractRate: 7 }) },
      Commission: { create: jest.fn().mockResolvedValue(commission) },
      CustomerPackage: {
        findByIdAndUpdate: jest.fn().mockReturnValue(Promise.resolve({})),
      },
      AuditLog: { create: jest.fn() },
    };

    const result = await createSaleCommission({
      models,
      staffId: "staff-1",
      customerPackageId: "package-1",
      customerId: "customer-1",
      packagePrice: 2000000,
      contractType: "new",
    });

    expect(result).toBe(commission);
    expect(models.Commission.create).toHaveBeenCalledWith(expect.objectContaining({
      amount: 140000,
      rate: 7,
      baseAmount: 2000000,
    }));
    expect(models.CustomerPackage.findByIdAndUpdate).toHaveBeenCalledWith(
      "package-1",
      { appliedCommissionRate: 7 }
    );
  });

  test("recalculates an open same-sale upgrade using injected models", async () => {
    const oldCommission = {
      _id: "old-commission",
      month: 8,
      year: 2026,
      amount: 50000,
      baseAmount: 1000000,
      rate: 5,
      status: "active",
      save: jest.fn().mockResolvedValue(true),
    };
    const models = {
      Setting: { findOne: jest.fn().mockResolvedValue({ saleUpsellRate: 6 }) },
      Commission: {
        findOne: jest.fn().mockResolvedValue(oldCommission),
        create: jest.fn().mockResolvedValue({ _id: "new-commission" }),
      },
      CommissionPeriod: { findOne: jest.fn().mockResolvedValue({ status: "pending" }) },
      AuditLog: { create: jest.fn() },
    };

    await handleUpgradeCommission({
      models,
      oldPackage: { _id: "old-package", assignedStaff: { toString: () => "staff-1" } },
      newPackageId: "package-template-2",
      newPackagePrice: 3000000,
      newCustomerPackageId: "new-package",
      customerId: "customer-1",
      upgradeSaleStaffId: { toString: () => "staff-1" },
      priceDiff: 2000000,
    });

    expect(oldCommission.status).toBe("revoked");
    expect(oldCommission.save).toHaveBeenCalledTimes(1);
    expect(models.Commission.create).toHaveBeenCalledWith(expect.objectContaining({
      amount: 180000,
      baseAmount: 3000000,
      contractType: "upgrade_full_recalc",
    }));
  });

  test("records commission failures in the injected tenant audit model", async () => {
    const models = {
      Setting: { findOne: jest.fn().mockResolvedValue({}) },
      Commission: { create: jest.fn().mockRejectedValue(new Error("write failed")) },
      CustomerPackage: { findByIdAndUpdate: jest.fn() },
      AuditLog: { create: jest.fn().mockResolvedValue({}) },
    };

    const result = await createSaleCommission({
      models,
      staffId: "staff-1",
      customerPackageId: "package-1",
      customerId: "customer-1",
      packagePrice: 1000000,
      contractType: "new",
    });

    expect(result).toBeNull();
    expect(models.AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      action: "COMMISSION_FAILED",
      severity: "critical",
    }));
  });
});
