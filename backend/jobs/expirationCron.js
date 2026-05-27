const cron = require('node-cron');
const Customer = require('../models/Customer');
const CustomerPackage = require('../models/CustomerPackage');
const { sendExpirationReminderEmail, sendUnfreezeNotificationEmail } = require('../utils/emailService');
const { startOfDay, endOfDay, addDays } = require('date-fns');

async function syncCustomerFields(customerId) {
  try {
    let activePackage = await CustomerPackage.findOne({ customer: customerId, status: "active" }).sort({ endDate: -1 });
    if (!activePackage) {
      activePackage = await CustomerPackage.findOne({ customer: customerId }).sort({ createdAt: -1 });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) return;

    if (activePackage) {
      customer.activePackage = activePackage._id;
      customer.packageType = activePackage.packageName;
      customer.startDate = activePackage.startDate;
      customer.endDate = activePackage.endDate;
      customer.remainingSessions = activePackage.remainingSessions;
      customer.price = activePackage.price;
      customer.paymentStatus = activePackage.paymentStatus;
      customer.paidAmount = activePackage.paidAmount;
      customer.contractType = activePackage.contractType;
      customer.trainer = activePackage.trainer;
      customer.assignedStaff = activePackage.assignedStaff;
      customer.hasLocker = activePackage.hasLocker;
      customer.hasWater = activePackage.hasWater;
      customer.packageNote = activePackage.packageNote;
    } else {
      customer.activePackage = null;
      customer.packageType = "Không có";
      customer.startDate = new Date();
      customer.endDate = new Date();
      customer.remainingSessions = 0;
      customer.price = 0;
      customer.paymentStatus = "unpaid";
      customer.paidAmount = 0;
      customer.packageNote = "";
    }
    await customer.save();
  } catch (err) {
    console.error("Lỗi đồng bộ hồ sơ khách hàng trong Cron Job:", err);
  }
}

const startExpirationCron = () => {
  cron.schedule('0 8 * * *', async () => {
    console.log('Running daily expiration and unfreeze cron job...');
    try {
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

      const now = new Date();
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
      console.error('Error running expiration & unfreeze cron job:', error);
    }
  });
  
  console.log('Daily expiration and unfreeze cron job scheduled.');
};

module.exports = startExpirationCron;
