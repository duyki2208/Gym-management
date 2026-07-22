const dotenv = require('dotenv');
dotenv.config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const CustomerPackage = require('../models/CustomerPackage');
const syncCustomerFields = require('../utils/syncCustomer');

async function trigger() {
  await connectDB();
  const now = new Date();

  // 1. Tự động chuyển các gói hết hạn sang trạng thái "expired"
  const expiredPackages = await CustomerPackage.find({
    status: "active",
    endDate: { $lt: now }
  });

  console.log(`=== Expiration Cleanup ===`);
  console.log(`Found ${expiredPackages.length} active packages past their end date. Marking as expired...`);

  for (const pkg of expiredPackages) {
    pkg.status = "expired";
    await pkg.save();
    await syncCustomerFields(pkg.customer);
    console.log(`  ✅ Expired package: ${pkg._id} (${pkg.packageName})`);
  }

  // 2. Tự động hủy các gói đặt cọc (deposit) sau 1 tháng không thanh toán nốt
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const unpaidDepositPackages = await CustomerPackage.find({
    status: "active",
    paymentStatus: "deposit",
    startDate: { $lt: oneMonthAgo }
  });

  console.log(`\n=== Deposit Cleanup ===`);
  console.log(`Found ${unpaidDepositPackages.length} unpaid deposit packages older than 1 month. Marking as expired...`);

  for (const pkg of unpaidDepositPackages) {
    pkg.status = "expired";
    pkg.packageNote = pkg.packageNote 
      ? `${pkg.packageNote} [Hủy tự động: Quá hạn cọc 1 tháng]`
      : "[Hủy tự động: Quá hạn cọc 1 tháng]";
    await pkg.save();
    await syncCustomerFields(pkg.customer);
    console.log(`  ✅ Cancelled deposit package: ${pkg._id} (${pkg.packageName})`);
  }

  await mongoose.connection.close();
  console.log('\nCleanup trigger complete. Database closed.');
}

trigger().catch(console.error);
