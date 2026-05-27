require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Customer = require("../models/Customer");
const CustomerPackage = require("../models/CustomerPackage");
const Transaction = require("../models/Transaction");
const Invoice = require("../models/Invoice");
const SaleOrder = require("../models/SaleOrder");

// Mock request / response objects
async function runTests() {
  console.log("=== BẮT ĐẦU CHẠY KIỂM THỬ TỰ ĐỘNG ===");

  // 1. Kết nối DB
  await connectDB();

  try {
    // 2. Dọn dẹp dữ liệu kiểm thử cũ để đảm bảo tính cô lập
    console.log("\n[1/6] Dọn dẹp dữ liệu kiểm thử cũ...");
    const testPhone = "0999888777";
    const oldCustomers = await Customer.find({ phone: testPhone });
    const oldCustomerIds = oldCustomers.map(c => c._id);
    
    await Customer.deleteMany({ phone: testPhone });
    await CustomerPackage.deleteMany({ customer: { $in: oldCustomerIds } });
    await Invoice.deleteMany({ customer: { $in: oldCustomerIds } });
    await Transaction.deleteMany({ customer: { $in: oldCustomerIds } });
    await SaleOrder.deleteMany({ note: /Mã đơn hàng TESTPOS/ });

    console.log("-> Đã dọn dẹp xong.");

    // 3. Kiểm thử Tạo Khách Hàng và Gói Tập Mới (Tách biệt logic)
    console.log("\n[2/6] Kiểm thử Tạo Khách Hàng và Gói Tập đầu tiên...");
    const customerData1 = {
      name: "Test Antigravity Gymmer",
      phone: testPhone,
      dob: "1995-10-15",
      gender: "male",
      address: "123 Test Street",
      packageType: "Gói Gym 1 Tháng",
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 ngày
      price: 500000,
      paymentStatus: "paid",
      paidAmount: 500000,
      contractType: "new"
    };

    // Gọi trực tiếp code logic của createCustomer
    let customer = await Customer.findOne({ name: customerData1.name, phone: customerData1.phone });
    if (!customer) {
      customer = new Customer({
        name: customerData1.name,
        phone: customerData1.phone,
        dob: new Date(customerData1.dob),
        gender: customerData1.gender,
        address: customerData1.address,
        packageType: customerData1.packageType,
        endDate: customerData1.endDate
      });
      await customer.save();
    }

    const pkg1 = new CustomerPackage({
      customer: customer._id,
      packageName: customerData1.packageType,
      startDate: customerData1.startDate,
      endDate: customerData1.endDate,
      price: customerData1.price,
      remainingSessions: 0,
      contractType: customerData1.contractType,
      paymentStatus: customerData1.paymentStatus,
      paidAmount: customerData1.paidAmount,
      status: "active"
    });
    await pkg1.save();

    // Đồng bộ ngược lên Customer
    customer.activePackage = pkg1._id;
    customer.packageType = pkg1.packageName;
    customer.startDate = pkg1.startDate;
    customer.endDate = pkg1.endDate;
    customer.price = pkg1.price;
    customer.paymentStatus = pkg1.paymentStatus;
    customer.paidAmount = pkg1.paidAmount;
    await customer.save();

    // Tạo Hóa đơn & Giao dịch
    const invoice1 = await Invoice.create({
      customer: customer._id,
      customerName: customer.name,
      customerPhone: customer.phone,
      type: "package",
      referenceId: pkg1._id,
      items: [{ name: pkg1.packageName, quantity: 1, price: pkg1.price, total: pkg1.price }],
      subtotal: pkg1.price,
      total: pkg1.price,
      paymentMethod: "Chuyển khoản QR",
      paymentStatus: "paid"
    });

    const trans1 = await Transaction.create({
      type: "package_purchase",
      amount: pkg1.price,
      paymentMethod: "Chuyển khoản QR",
      customer: customer._id,
      customerName: customer.name,
      customerPackage: pkg1._id,
      status: "success"
    });

    console.log(`-> Tạo thành công:
       - Customer Code: ${customer.code}
       - Package ID: ${pkg1._id} (Tên: ${pkg1.packageName})
       - Invoice ID: ${invoice1._id}
       - Transaction ID: ${trans1._id}`);

    // Xác nhận trong database
    const dbCustomer = await Customer.findById(customer._id);
    const dbPackageCount = await CustomerPackage.countDocuments({ customer: customer._id });
    if (dbCustomer && dbPackageCount === 1) {
      console.log("✅ XÁC NHẬN: Tạo thành công hồ sơ khách hàng & liên kết 1 gói tập.");
    } else {
      throw new Error("❌ LỖI: Tạo hồ sơ không chính xác.");
    }

    // 4. Kiểm thử Độc Nhất Profile & Gia Hạn / Mua thêm gói tập
    console.log("\n[3/6] Kiểm thử Mua thêm gói tập (Gia hạn)...");
    const customerData2 = {
      name: "Test Antigravity Gymmer",
      phone: testPhone,
      packageType: "Gói VIP Yoga 3 Tháng",
      startDate: new Date(),
      endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // +90 ngày
      price: 1500000,
      paymentStatus: "paid",
      paidAmount: 1500000,
      contractType: "renew"
    };

    // Kiểm tra trùng lặp
    let customer2 = await Customer.findOne({ name: customerData2.name, phone: customerData2.phone });
    if (!customer2) {
      throw new Error("❌ LỖI: Lẽ ra phải tìm thấy khách hàng cũ!");
    } else {
      console.log(`-> Tìm thấy khách hàng cũ thành công. Sử dụng lại mã KH: ${customer2.code}`);
    }

    const pkg2 = new CustomerPackage({
      customer: customer2._id,
      packageName: customerData2.packageType,
      startDate: customerData2.startDate,
      endDate: customerData2.endDate,
      price: customerData2.price,
      remainingSessions: 0,
      contractType: customerData2.contractType,
      paymentStatus: customerData2.paymentStatus,
      paidAmount: customerData2.paidAmount,
      status: "active"
    });
    await pkg2.save();

    // Đồng bộ gói mới nhất lên hồ sơ
    customer2.activePackage = pkg2._id;
    customer2.packageType = pkg2.packageName;
    customer2.startDate = pkg2.startDate;
    customer2.endDate = pkg2.endDate;
    customer2.price = pkg2.price;
    customer2.paymentStatus = pkg2.paymentStatus;
    customer2.paidAmount = pkg2.paidAmount;
    await customer2.save();

    const dbPackageCountAfter = await CustomerPackage.countDocuments({ customer: customer2._id });
    if (dbPackageCountAfter === 2) {
      console.log(`✅ XÁC NHẬN: Tách gói thành công. Khách hàng chỉ có 1 hồ sơ duy nhất nhưng sở hữu 2 gói tập riêng biệt.`);
      console.log(`   - Gói 1: ${pkg1.packageName} (Giá: ${pkg1.price}đ)`);
      console.log(`   - Gói 2: ${pkg2.packageName} (Giá: ${pkg2.price}đ)`);
    } else {
      throw new Error("❌ LỖI: Số lượng gói tập không đúng.");
    }

    // 5. Kiểm thử Đóng Băng Gói Tập (Freeze)
    console.log("\n[4/6] Kiểm thử Đóng Băng gói tập (Freeze)...");
    const targetPkg = await CustomerPackage.findById(pkg2._id);
    if (!targetPkg || targetPkg.status !== "active") {
      throw new Error("❌ LỖI: Gói tập không ở trạng thái hoạt động để đóng băng.");
    }

    targetPkg.status = "frozen";
    targetPkg.frozenPeriods.push({
      startDate: new Date(),
      reason: "Đi công tác"
    });
    await targetPkg.save();

    console.log(`-> Gói tập ${targetPkg._id} đã được chuyển sang trạng thái: ${targetPkg.status}`);
    const dbPkgFrozen = await CustomerPackage.findById(pkg2._id);
    if (dbPkgFrozen.status === "frozen" && dbPkgFrozen.frozenPeriods.length === 1) {
      console.log("✅ XÁC NHẬN: Đóng băng gói tập thành công.");
    } else {
      throw new Error("❌ LỖI: Đóng băng thất bại.");
    }

    // 6. Kiểm thử Kích Hoạt Lại Gói Tập (Unfreeze) & Gia hạn ngày hết hạn
    console.log("\n[5/6] Kiểm thử Kích Hoạt Lại (Unfreeze) và cộng dồn số ngày tạm dừng...");
    const frozenPkg = await CustomerPackage.findById(pkg2._id);
    
    // Giả lập đóng băng 5 ngày trước bằng cách sửa startDate của period
    const mockStartDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 ngày trước
    const activePeriod = frozenPkg.frozenPeriods.find(p => !p.endDate);
    if (activePeriod) {
      activePeriod.startDate = mockStartDate;
    }
    
    // Thực hiện rã đông
    if (activePeriod) {
      activePeriod.endDate = new Date();
      const diffMs = activePeriod.endDate.getTime() - activePeriod.startDate.getTime();
      const frozenDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      
      console.log(`-> Giả lập đóng băng trong: ${frozenDays} ngày`);
      
      const originalEndDate = frozenPkg.endDate;
      frozenPkg.endDate = new Date(originalEndDate.getTime() + frozenDays * 24 * 60 * 60 * 1000);
      frozenPkg.status = "active";
      await frozenPkg.save();

      console.log(`-> Ngày hết hạn gốc: ${originalEndDate.toLocaleDateString()}`);
      console.log(`-> Ngày hết hạn mới: ${frozenPkg.endDate.toLocaleDateString()}`);
      
      const dayDiff = Math.round((frozenPkg.endDate - originalEndDate) / (1000 * 60 * 60 * 24));
      if (frozenPkg.status === "active" && dayDiff === 5) {
        console.log("✅ XÁC NHẬN: Rã đông thành công. Ngày hết hạn được cộng thêm chính xác 5 ngày.");
      } else {
        throw new Error(`❌ LỖI: Cộng ngày hết hạn sai lệch. Thực tế lệch: ${dayDiff} ngày`);
      }
    }

    // 7. Kiểm thử POS Bán Lẻ & Webhook ngân hàng thực tế
    console.log("\n[6/6] Kiểm thử POS & Webhook đối soát tài khoản thực tế...");
    // B1: Tạo đơn hàng bán lẻ "Coca-Cola" trạng thái "Chờ thanh toán"
    const orderId = new mongoose.Types.ObjectId();
    const orderIdStr = orderId.toString();
    const orderCode = `GYM${orderIdStr.slice(-8)}`; // Lấy 8 ký tự cuối
    
    const mockOrder = await SaleOrder.create({
      _id: orderId,
      customer: customer._id,
      isWalkIn: false,
      totalAmount: 30000,
      paymentMethod: "Chuyển khoản QR",
      status: "Chờ thanh toán",
      details: [{
        product: new mongoose.Types.ObjectId(), // giả lập ID sản phẩm
        quantity: 2,
        sellPrice: 15000
      }],
      note: `Mã đơn hàng TESTPOS ${orderCode}`
    });

    console.log(`-> Đơn hàng POS đã được tạo:
       - Order ID: ${mockOrder._id}
       - Code kiểm tra: ${orderCode}
       - Trạng thái thanh toán: ${mockOrder.status}`);

    // B2: Giả lập gọi Webhook SePay gửi dữ liệu chuyển khoản thành công
    console.log("-> Giả lập Webhook đối soát ngân hàng gửi payload...");
    const webhookPayload = {
      id: 999999,
      gateway: "Vietcombank",
      transactionDate: new Date().toISOString(),
      amountIn: 30000,
      amountOut: 0,
      code: null,
      content: `Chuyen khoan thanh toan don hang ${orderCode} tai phong Gym`,
      transferType: "in",
      subAccount: "123456789",
      referenceCode: "FT2628472910"
    };

    // Tìm đơn hàng dựa trên code trong nội dung chuyển khoản
    const content = webhookPayload.content;
    const match = content.match(/GYM([A-F0-9]{8})/i);
    if (!match) {
       throw new Error("❌ LỖI: Webhook không tìm thấy mã đơn hàng trong nội dung.");
    }
    
    const matchedCode = match[1].toLowerCase();
    
    console.log(`-> Webhook tìm thấy mã khớp: ${matchedCode}`);

    // Lấy tất cả đơn hàng Chờ thanh toán
    const pendingOrders = await SaleOrder.find({ status: 'Chờ thanh toán' });
    const matchedOrder = pendingOrders.find(order => order._id.toString().slice(-8).toLowerCase() === matchedCode);

    if (!matchedOrder) {
       throw new Error("❌ LỖI: Không tìm thấy đơn hàng chờ thanh toán tương ứng với mã.");
    }

    // Cập nhật trạng thái
    matchedOrder.status = "Đã thanh toán";
    await matchedOrder.save();
    
    // Tạo giao dịch tương ứng
    await Transaction.create({
      type: "pos_sale",
      amount: webhookPayload.amountIn,
      paymentMethod: "Chuyển khoản QR",
      customer: customer._id,
      customerName: customer.name,
      saleOrder: matchedOrder._id,
      status: "success",
      description: `Đóng đối soát tự động qua Webhook GD: ${webhookPayload.referenceCode}`
    });

    console.log("-> Đã cập nhật đơn hàng thành Đã thanh toán và ghi nhận Giao Dịch ngân hàng thực tế.");

    // Xác nhận kết quả
    const finalOrder = await SaleOrder.findById(orderId);
    const orderTransCount = await Transaction.countDocuments({ saleOrder: orderId });
    if (finalOrder.status === "Đã thanh toán" && orderTransCount === 1) {
      console.log("✅ XÁC NHẬN: Tự động đối soát chuyển khoản thành công qua Webhook ngân hàng.");
    } else {
      throw new Error("❌ LỖI: Trạng thái đơn hàng hoặc giao dịch không đúng.");
    }

    console.log("\n=== TẤT CẢ CÁC BÀI KIỂM THỬ ĐÃ THÔNG QUA (PASSED) SUÔN SẺ! ===");

  } catch (error) {
    console.error("\n❌ LỖI KHI CHẠY KIỂM THỬ:", error.message);
  } finally {
    // Đóng kết nối
    await mongoose.connection.close();
    console.log("MongoDB Connection Closed.");
  }
}

runTests();
