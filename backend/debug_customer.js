const mongoose = require('mongoose');
const Customer = require('./models/Customer');
const { startOfDay, endOfDay, addDays } = require('date-fns');
require('dotenv').config();

const debugExpiring = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    const today = startOfDay(new Date());
    const next14 = endOfDay(addDays(new Date(), 14));
    
    console.log("Querying MongoDB...");
    console.log(`GTE: ${today.toISOString()}`);
    console.log(`LTE: ${next14.toISOString()}`);
    
    const members = await Customer.find({
      endDate: { $gte: today, $lte: next14 }
    });
    
    console.log(`Found: ${members.length}`);
    members.forEach(m => console.log(`- ${m.name} (${m.endDate.toISOString()})`));
    
    process.exit();
  } catch (e) { console.error(e); process.exit(1); }
};
debugExpiring();
