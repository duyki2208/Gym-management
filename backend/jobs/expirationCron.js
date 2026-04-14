const cron = require('node-cron');
const Customer = require('../models/Customer');
const { sendExpirationReminderEmail } = require('../utils/emailService');
const { startOfDay, endOfDay, addDays } = require('date-fns');

// This job runs every day at 08:00 AM
const startExpirationCron = () => {
  cron.schedule('0 8 * * *', async () => {
    console.log('Running daily expiration cron job...');
    try {
      // Find customers expiring exactly 14 days from today
      const targetDate = addDays(new Date(), 14);
      const startOfTarget = startOfDay(targetDate);
      const endOfTarget = endOfDay(targetDate);

      const expiringCustomers = await Customer.find({
        endDate: { $gte: startOfTarget, $lte: endOfTarget },
        email: { $ne: "" }, // Only those who have provided an email
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

    } catch (error) {
      console.error('Error running expiration cron job:', error);
    }
  });
  
  console.log('Daily expiration cron job scheduled.');
};

module.exports = startExpirationCron;
