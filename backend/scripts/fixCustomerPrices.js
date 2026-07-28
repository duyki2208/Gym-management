const mongoose = require("mongoose");
require("dotenv").config();
const syncCustomerFields = require("../utils/syncCustomer");
const Customer = require("../models/Customer");

async function fixAllCustomers() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB...");

    const customers = await Customer.find({ isDeleted: { $ne: true } });
    console.log(`Found ${customers.length} non-deleted customers to sync...`);

    let count = 0;
    for (const cust of customers) {
      await syncCustomerFields(cust._id);
      count++;
    }

    console.log(`Successfully re-synced ${count} customers!`);

    // Inspect recent customers after fix
    const fixedCusts = await Customer.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .select("name code packageType price activePackage createdAt")
      .lean();
    console.log("=== Fixed Customers (Last 10) ===");
    console.log(JSON.stringify(fixedCusts, null, 2));

    await mongoose.disconnect();
  } catch (err) {
    console.error("Error fixing customers:", err);
    process.exit(1);
  }
}

fixAllCustomers();
