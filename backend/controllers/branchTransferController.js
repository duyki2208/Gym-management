/**
 * backend/controllers/branchTransferController.js
 * Saga 5 bước Chuyển cơ sở Hội viên (Branch Transfer)
 *
 * Áp dụng Pattern Clone/Snapshot (Phương án B)
 */
const { getBranchModels, getCentralModels } = require("../db/branchConnectionManager");

/**
 * Khởi tạo & thực hiện chuyển cơ sở hội viên xuyên chi nhánh
 * POST /api/v1/branch-transfers/transfer
 */
const transferCustomerBranch = async (req, res) => {
  const sourceBranchCode = req.branchCode;
  const sourceModels = req.models;

  try {
    const {
      customerId,
      packageId,
      targetBranchCode,
      transferFee = 0,
      paymentMethod = "Tiền mặt",
      note = "",
    } = req.body;

    if (!customerId || !targetBranchCode) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp customerId và targetBranchCode",
      });
    }

    const normalizedTargetCode = targetBranchCode.trim().toUpperCase();

    if (normalizedTargetCode === sourceBranchCode) {
      return res.status(400).json({
        success: false,
        message: "Chi nhánh đích không được trùng với chi nhánh hiện tại",
      });
    }

    // Xác thực chi nhánh đích có tồn tại trong Central DB
    const centralModels = req.centralModels || (await getCentralModels());
    const targetBranchInfo = await centralModels.Branch.findOne({
      code: normalizedTargetCode,
      isActive: true,
    });

    if (!targetBranchInfo) {
      return res.status(404).json({
        success: false,
        message: `Chi nhánh đích ${normalizedTargetCode} không tồn tại hoặc đã ngừng hoạt động`,
      });
    }

    // 1. Kiểm tra Customer & CustomerPackage tại chi nhánh nguồn
    const sourceCustomer = await sourceModels.Customer.findById(customerId);
    if (!sourceCustomer) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy khách hàng tại chi nhánh nguồn",
      });
    }

    let sourcePackage = null;
    if (packageId) {
      sourcePackage = await sourceModels.CustomerPackage.findById(packageId);
    } else if (sourceCustomer.activePackage) {
      sourcePackage = await sourceModels.CustomerPackage.findById(sourceCustomer.activePackage);
    }

    if (!sourcePackage) {
      return res.status(404).json({
        success: false,
        message: "Khách hàng không có gói tập hợp lệ để chuyển chi nhánh",
      });
    }

    if (sourcePackage.transferStatus === "transferred_out") {
      return res.status(400).json({
        success: false,
        message: "Gói tập này đã được chuyển sang cơ sở khác trước đó",
      });
    }

    // === BƯỚC 1: Thu phí chuyển cơ sở tại Chi nhánh Cũ (ghi nhận doanh thu service_fee) ===
    let invoice = null;
    const feeNumber = Number(transferFee) || 0;

    if (feeNumber > 0) {
      invoice = await sourceModels.Invoice.create({
        customer: sourceCustomer._id,
        customerName: sourceCustomer.name,
        customerPhone: sourceCustomer.phone,
        type: "transfer",
        referenceId: sourcePackage._id,
        items: [
          {
            name: `Phí chuyển cơ sở từ ${sourceBranchCode} sang ${normalizedTargetCode}`,
            quantity: 1,
            price: feeNumber,
            total: feeNumber,
          },
        ],
        subtotal: feeNumber,
        discount: 0,
        total: feeNumber,
        paymentMethod,
        paymentStatus: "paid",
        staff: req.user ? req.user._id : null,
      });

      await sourceModels.Transaction.create({
        type: "service_fee",
        amount: feeNumber,
        paymentMethod,
        customer: sourceCustomer._id,
        customerName: sourceCustomer.name,
        customerPackage: sourcePackage._id,
        status: "success",
        staff: req.user ? req.user._id : null,
      });
    }

    // === BƯỚC 2: Cập nhật gói cũ sang trạng thái transfer_pending ===
    sourcePackage.transferStatus = "transfer_pending";
    sourcePackage.branchTransferredTo = normalizedTargetCode;
    sourcePackage.branchTransferDate = new Date();
    await sourcePackage.save();

    // === BƯỚC 3: Khởi tạo/Tìm Customer tại Chi nhánh Mới ===
    const targetModels = await getBranchModels(normalizedTargetCode);

    let targetCustomer = await targetModels.Customer.findOne({
      phone: sourceCustomer.phone,
      isDeleted: { $ne: true },
    });

    if (!targetCustomer) {
      targetCustomer = await targetModels.Customer.create({
        name: sourceCustomer.name,
        phone: sourceCustomer.phone,
        dob: sourceCustomer.dob,
        gender: sourceCustomer.gender,
        address: sourceCustomer.address,
        avatar: sourceCustomer.avatar,
        avatarUrl: sourceCustomer.avatarUrl,
        packageType: sourcePackage.packageName,
        startDate: new Date(),
        endDate: sourcePackage.endDate,
        hasLocker: sourcePackage.hasLocker,
        hasWater: sourcePackage.hasWater,
        healthNote: sourceCustomer.healthNote,
        packageNote: `Chuyển từ cơ sở ${sourceBranchCode}`,
        email: sourceCustomer.email,
        price: sourcePackage.price,
        remainingSessions: sourcePackage.remainingSessions,
        identityCard: sourceCustomer.identityCard,
        emergencyContactName: sourceCustomer.emergencyContactName,
        emergencyContactPhone: sourceCustomer.emergencyContactPhone,
        paymentStatus: "paid",
        contractType: "transfer",
        source: "branch_transfer",
        faceEmbedding: sourceCustomer.faceEmbedding || [],
      });
    } else {
      // Cập nhật faceEmbedding nếu chi nhánh đích chưa có
      if (
        (!targetCustomer.faceEmbedding || targetCustomer.faceEmbedding.length === 0) &&
        sourceCustomer.faceEmbedding &&
        sourceCustomer.faceEmbedding.length > 0
      ) {
        targetCustomer.faceEmbedding = sourceCustomer.faceEmbedding;
        await targetCustomer.save();
      }
    }

    // === BƯỚC 4: Tạo CustomerPackage mới tại Chi nhánh Mới (Clone/Snapshot) ===
    const targetPackage = await targetModels.CustomerPackage.create({
      customer: targetCustomer._id,
      package: sourcePackage.package,
      packageName: sourcePackage.packageName,
      startDate: new Date(),
      endDate: sourcePackage.endDate,
      price: sourcePackage.price,
      contractCode: `TR-${sourcePackage.contractCode || "HD"}`,
      packageNote: `Chuyển nhượng từ chi nhánh ${sourceBranchCode}. ${note}`.trim(),
      remainingSessions: sourcePackage.remainingSessions,
      status: "active",
      transferStatus: "none",
      branchTransferredFrom: sourceBranchCode,
      hasLocker: sourcePackage.hasLocker,
      hasWater: sourcePackage.hasWater,
      contractType: "transfer",
      paymentStatus: "paid",
      paidAmount: sourcePackage.paidAmount,
      transferFee: feeNumber,
    });

    targetCustomer.activePackage = targetPackage._id;
    targetCustomer.endDate = sourcePackage.endDate;
    targetCustomer.remainingSessions = sourcePackage.remainingSessions;
    await targetCustomer.save();

    // === BƯỚC 5: Đóng gói cũ tại Chi nhánh Cũ (transferred_out) ===
    sourcePackage.transferStatus = "transferred_out";
    sourcePackage.status = "transferred";
    sourcePackage.transferredTo = targetPackage._id;
    await sourcePackage.save();

    // Nếu activePackage của khách cũ là gói này, cập nhật trạng thái
    if (String(sourceCustomer.activePackage) === String(sourcePackage._id)) {
      sourceCustomer.packageNote = `Đã chuyển sang chi nhánh ${normalizedTargetCode}`;
      await sourceCustomer.save();
    }

    return res.status(200).json({
      success: true,
      message: `Chuyển cơ sở thành công từ ${sourceBranchCode} sang ${normalizedTargetCode}`,
      data: {
        sourceBranchCode,
        targetBranchCode: normalizedTargetCode,
        invoiceCode: invoice ? invoice.code : null,
        targetCustomerId: targetCustomer._id,
        targetPackageId: targetPackage._id,
        transferFee: feeNumber,
      },
    });

  } catch (error) {
    console.error(`[BranchTransfer Error] ${error.message}`);
    return res.status(500).json({
      success: false,
      message: `Lỗi trong quá trình chuyển cơ sở: ${error.message}`,
    });
  }
};

/**
 * Lấy danh sách các giao dịch đang pending (chờ xử lý / bị nghẽn)
 * GET /api/v1/branch-transfers/pending
 */
const getPendingTransfers = async (req, res) => {
  try {
    const sourceModels = req.models;
    const pendingPackages = await sourceModels.CustomerPackage.find({
      transferStatus: "transfer_pending",
    })
      .populate("customer", "name phone code")
      .sort({ updatedAt: -1 });

    res.json({
      success: true,
      count: pendingPackages.length,
      data: pendingPackages,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  transferCustomerBranch,
  getPendingTransfers,
};
