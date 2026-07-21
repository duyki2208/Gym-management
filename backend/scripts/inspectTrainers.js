const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const connectDB = require("../config/db");
const Customer = require("../models/Customer");
const CustomerPackage = require("../models/CustomerPackage");
const User = require("../models/User");

async function inspect() {
  await connectDB();

  try {
    const customers = await Customer.find({});
    const packages = await CustomerPackage.find({});
    const users = await User.find({});

    console.log("=== USERS IN SYSTEM ===");
    users.forEach(u => {
      console.log(`- ID: ${u._id}, Username: ${u.username}, FullName: ${u.fullName}, Role: ${u.role}`);
    });

    console.log("\n=== CUSTOMERS TRAINERS ===");
    const customerTrainers = new Set();
    customers.forEach(c => {
      if (c.trainer) {
        customerTrainers.add(c.trainer);
        console.log(`Customer: ${c.name} (${c.code}) -> Trainer: ${c.trainer}`);
      }
    });

    console.log("\n=== CUSTOMER PACKAGES TRAINERS ===");
    const packageTrainers = new Set();
    packages.forEach(p => {
      if (p.trainer) {
        packageTrainers.add(p.trainer);
        console.log(`Package: ${p.packageName} (${p._id}) -> Trainer: ${p.trainer}`);
      }
    });

    console.log("\n=== UNIQUE TRAINER VALUES ===");
    console.log("Customers trainer values:", Array.from(customerTrainers));
    console.log("Packages trainer values:", Array.from(packageTrainers));

  } catch (error) {
    console.error("Inspection failed:", error);
  } finally {
    await mongoose.connection.close();
    console.log("Connection closed.");
  }
}

inspect();
