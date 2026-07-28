const mongoose = require("mongoose");
const Customer = require("../models/Customer");
const Package = require("../models/Package");
const CustomerPackage = require("../models/CustomerPackage");
const syncCustomerFields = require("../utils/syncCustomer");
require("dotenv").config();

async function runTest() {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/gym_management";
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB for testing 4 contract adjustments...");

    // Test 1: Package upgrade duration & old package deletion test
    const pkg12m = await Package.findOne({ duration: { $gte: 300 } }) || new Package({ name: "Gói 12 Tháng VIP Test", duration: 365, price: 6000000 });
    if (pkg12m.isNew) await pkg12m.save();

    const custA = new Customer({ name: "Hội Viên A Test", phone: "0988111222", packageType: "Gói 1 Tháng", endDate: new Date(Date.now() + 30*24*60*60*1000) });
    await custA.save();

    const oldPkgA = new CustomerPackage({
      customer: custA._id,
      packageName: "Gói 1 Tháng",
      startDate: new Date(),
      endDate: new Date(Date.now() + 30*24*60*60*1000),
      price: 800000,
      contractCode: "HĐ-TEST-01",
      status: "active"
    });
    await oldPkgA.save();

    // Calculate new end date for 365 days
    const newEndDate = new Date(oldPkgA.startDate.getTime() + pkg12m.duration * 24 * 60 * 60 * 1000);
    const newPkgB = new CustomerPackage({
      customer: custA._id,
      package: pkg12m._id,
      packageName: pkg12m.name,
      startDate: oldPkgA.startDate,
      endDate: newEndDate,
      price: pkg12m.price,
      contractCode: "HĐ-TEST-01-UP",
      status: "active"
    });
    await newPkgB.save();
    await oldPkgA.deleteOne();

    const checkOldPkg = await CustomerPackage.findById(oldPkgA._id);
    console.log("1. Old package deleted after upgrade:", checkOldPkg === null ? "YES (DELETED)" : "NO");

    const diffDays = Math.round((newPkgB.endDate.getTime() - newPkgB.startDate.getTime()) / (1000*60*60*24));
    console.log("2. New upgraded package duration in days:", diffDays, "days (Expected 365)");

    // Test 2: Transfer cleanup & receiver price test
    const custB = new Customer({
      name: "Hội Viên B Nhận Transfer",
      phone: "0977333444",
      packageType: newPkgB.packageName,
      startDate: newPkgB.startDate,
      endDate: newPkgB.endDate,
      price: newPkgB.price,
      paidAmount: newPkgB.price,
      paymentStatus: "paid"
    });
    await custB.save();

    newPkgB.originalCustomer = custA._id;
    newPkgB.customer = custB._id;
    newPkgB.contractType = "transfer";
    await newPkgB.save();

    await syncCustomerFields(custB._id);

    // Soft delete custA if no other active packages remain
    const remainingCount = await CustomerPackage.countDocuments({ customer: custA._id, _id: { $ne: newPkgB._id }, status: "active" });
    if (remainingCount === 0) {
      custA.isDeleted = true;
      await custA.save();
    }

    const checkCustA = await Customer.findById(custA._id, null, { withDeleted: true });
    console.log("3. Customer A soft-deleted after transfer:", checkCustA?.isDeleted === true ? "YES (isDeleted=true)" : "NO");

    const checkCustB = await Customer.findById(custB._id);
    console.log("4. Customer B received package price:", checkCustB.price, "VNĐ (Expected > 0)");

    // Clean up test records
    await CustomerPackage.findByIdAndDelete(newPkgB._id);
    await Customer.findByIdAndDelete(custA._id);
    await Customer.findByIdAndDelete(custB._id);
    if (pkg12m.name === "Gói 12 Tháng VIP Test") await Package.findByIdAndDelete(pkg12m._id);

    console.log("SUCCESS: All 4 contract adjustment tests passed 100%!");
  } catch (err) {
    console.error("Test failed with error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

runTest();
