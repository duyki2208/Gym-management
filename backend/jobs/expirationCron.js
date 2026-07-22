const cron = require('node-cron');
const Customer = require('../models/Customer');
const CustomerPackage = require('../models/CustomerPackage');
const syncCustomerFields = require('../utils/syncCustomer');
const { sendExpirationReminderEmail, sendUnfreezeNotificationEmail } = require('../utils/emailService');
const { startOfDay, endOfDay, addDays } = require('date-fns');


const runExpirationAndCleanup = async () => {
  console.log('Running daily expiration, unfreeze, and deposit cleanup...');
  try {
    const now = new Date();

    // 1. Tự động chuyển các gói hết hạn sang trạng thái "expired"
    const expiredPackages = await CustomerPackage.find({
      status: "active",
      endDate: { $lt: now }
    });

    console.log(`Found ${expiredPackages.length} active packages past their end date. Marking as expired...`);

    for (const pkg of expiredPackages) {
      pkg.status = "expired";
      await pkg.save();
      await syncCustomerFields(pkg.customer);
      console.log(`Auto-expired package for customer ID: ${pkg.customer} (Package: ${pkg.packageName})`);
    }

    // 2. Tự động hủy các gói đặt cọc (deposit) sau 1 tháng không thanh toán nốt
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const unpaidDepositPackages = await CustomerPackage.find({
      status: "active",
      paymentStatus: "deposit",
      startDate: { $lt: oneMonthAgo }
    });

    console.log(`Found ${unpaidDepositPackages.length} unpaid deposit packages older than 1 month. Marking as expired...`);

    for (const pkg of unpaidDepositPackages) {
      pkg.status = "expired";
      pkg.packageNote = pkg.packageNote 
        ? `${pkg.packageNote} [Hủy tự động: Quá hạn cọc 1 tháng]`
        : "[Hủy tự động: Quá hạn cọc 1 tháng]";
      await pkg.save();
      await syncCustomerFields(pkg.customer);
      console.log(`Auto-cancelled deposit package for customer ID: ${pkg.customer} (Package: ${pkg.packageName})`);
    }

    // 3. Kiểm tra các gói đang bảo lưu để tự động kích hoạt lại
    const frozenPackages = await CustomerPackage.find({ status: "frozen" }).populate("customer");
    
    console.log(`Found ${frozenPackages.length} packages currently frozen. Checking for auto-unfreeze...`);

    for (const pkg of frozenPackages) {
      if (pkg.frozenPeriods && pkg.frozenPeriods.length > 0) {
        const activePeriod = pkg.frozenPeriods[pkg.frozenPeriods.length - 1];
        if (activePeriod && now >= activePeriod.endDate) {
          pkg.status = "active";
          await pkg.save();

          await syncCustomerFields(pkg.customer._id);

          console.log(`Auto-unfrozen package for customer: ${pkg.customer?.name} (Package: ${pkg.packageName})`);

          if (pkg.customer && pkg.customer.email) {
            await sendUnfreezeNotificationEmail(
              pkg.customer.email,
              pkg.customer.name,
              pkg.packageName,
              pkg.endDate,
              activePeriod.endDate
            );
          }
        }
      }
    }
  } catch (error) {
    console.error('Error running expiration & cleanup job:', error);
  }
};

const startExpirationCron = () => {
  // Chạy ngay một lần khi server start để đồng bộ dữ liệu tức thì
  setTimeout(() => {
    runExpirationAndCleanup().catch(err => console.error('Error running initial cleanup:', err));
  }, 5000);

  // Đặt lịch chạy định kỳ hàng ngày lúc 8:00 sáng
  cron.schedule('0 8 * * *', async () => {
    console.log('Running scheduled daily expiration cron job...');
    try {
      // Gửi email nhắc nhở hết hạn trước 14 ngày
      const targetDate = addDays(new Date(), 14);
      const startOfTarget = startOfDay(targetDate);
      const endOfTarget = endOfDay(targetDate);

      const expiringCustomers = await Customer.find({
        endDate: { $gte: startOfTarget, $lte: endOfTarget },
        email: { $ne: "" },
        $or: [ { email: { $exists: true } } ]
      });

      console.log(`Found ${expiringCustomers.length} customers expiring in exactly 14 days.`);

      for (const customer of expiringCustomers) {
        if (customer.email) {
          await sendExpirationReminderEmail(
            customer.email, 
            customer.name, 
            customer.packageType, 
            customer.endDate
          );
        }
      }

      // Chạy dọn dẹp và cập nhật trạng thái
      await runExpirationAndCleanup();

    } catch (error) {
      console.error('Error running expiration & unfreeze cron job:', error);
    }
  });
  
  console.log('Daily expiration and unfreeze cron job scheduled.');
};

module.exports = startExpirationCron;
