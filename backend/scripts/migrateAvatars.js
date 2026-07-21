const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const connectDB = require("../config/db");
const Customer = require("../models/Customer");
const { cloudinary } = require("../config/cloudinary");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runMigration() {
  await connectDB();

  try {
    console.log("Fetching customers from database...");
    const customers = await Customer.find({});
    console.log(`Found ${customers.length} total customers.`);

    let successCount = 0;
    let failCount = 0;
    let skipCount = 0;

    for (const customer of customers) {
      const avatar = customer.avatar;
      
      // Kiểm tra xem avatar có phải là emoji hoặc rỗng không
      if (!avatar || avatar === "👤" || avatar.length < 200) {
        if (!customer.avatarUrl) {
          customer.avatarUrl = "";
          await customer.save();
        }
        skipCount++;
        continue;
      }

      console.log(`Migrating avatar for customer: ${customer.name} (${customer.code})`);
      try {
        // Upload Base64 to Cloudinary
        const uploadResult = await cloudinary.uploader.upload(avatar, {
          folder: "gym-avatars",
          transformation: [
            { width: 300, height: 300, crop: "fill", gravity: "face" },
            { quality: "auto", fetch_format: "auto" }
          ]
        });

        customer.avatarUrl = uploadResult.secure_url;
        customer.avatar = ""; // Reset base64
        await customer.save();

        console.log(`Successfully migrated ${customer.name}. URL: ${uploadResult.secure_url}`);
        successCount++;
        
        // Tránh rate limit của Cloudinary
        await delay(200);
      } catch (err) {
        console.error(`Failed to migrate avatar for customer ${customer.name}:`, err.message);
        failCount++;
      }
    }

    console.log("\n=== MIGRATION SUMMARY ===");
    console.log(`Total checked: ${customers.length}`);
    console.log(`Successfully migrated: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    console.log(`Skipped (no base64): ${skipCount}`);
  } catch (error) {
    console.error("Migration script failed:", error);
  } finally {
    await mongoose.connection.close();
    console.log("Database connection closed.");
  }
}

runMigration();
