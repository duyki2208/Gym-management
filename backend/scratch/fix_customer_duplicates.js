require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Customer = require("../models/Customer");
const CustomerPackage = require("../models/CustomerPackage");

async function fixDuplicates() {
  console.log("=== BẮT ĐẦU RÀ SOÁT VÀ SỬA LỖI ĐỊNH DANH KHÁCH HÀNG ===");
  await connectDB();

  try {
    // Lấy tất cả CustomerPackages, populate Customer
    const packages = await CustomerPackage.find({}).populate("customer");
    console.log(`Đã tải ${packages.length} gói tập từ hệ thống.`);

    let separatedCount = 0;

    // Chúng ta sẽ nhóm các gói tập theo đúng bộ 3 (Tên + Phone + DOB)
    // Map: "Tên_Phone_DOB" -> array of packages
    const packageGroups = {};

    for (let pkg of packages) {
      if (!pkg.customer) continue; // Bỏ qua nếu bị lỗi tham chiếu

      const name = (pkg.customer.name || "").trim().toLowerCase();
      const phone = (pkg.customer.phone || "").trim();
      const dob = pkg.customer.dob ? new Date(pkg.customer.dob).toISOString().split("T")[0] : "NULL";

      const key = `${name}_${phone}_${dob}`;
      if (!packageGroups[key]) {
        packageGroups[key] = [];
      }
      packageGroups[key].push(pkg);
    }

    console.log(`Đã phân nhóm thành ${Object.keys(packageGroups).length} tập định danh (dựa trên Tên, SĐT, DOB).`);

    // Kiểm tra từng khách hàng xem họ có chứa các gói tập thuộc nhiều nhóm khác nhau không
    const customers = await Customer.find({});
    
    for (let customer of customers) {
      // Tìm tất cả gói tập thuộc về khách hàng này
      const customerPkgs = packages.filter(p => p.customer && p.customer._id.toString() === customer._id.toString());
      if (customerPkgs.length <= 1) continue; // Nếu có <= 1 gói thì không thể bị gộp sai

      // Xem khách hàng này đang chứa bao nhiêu nhóm định danh thực tế
      const uniqueIdentityKeys = new Set();
      for (let pkg of customerPkgs) {
        // Trong trường hợp này, vì pkg đang trỏ vào cùng 1 Customer, thì pkg.customer của chúng sẽ GIỐNG NHAU HOÀN TOÀN
        // Do đó, cách kiểm tra này không hiệu quả nếu dữ liệu đã bị đè.
        // NHƯNG nếu trước đó chúng ta tạo bằng cách đè, thì các thông tin cũ ĐÃ MẤT,
        // Dữ liệu gói tập không lưu lại Tên, SĐT, DOB riêng biệt.
        // DO ĐÓ, nếu trong hệ thống hiện tại, các CustomerPackage đã trỏ vào chung 1 Customer,
        // thì tên, sđt, dob của chúng đã là 1. Chúng ta không thể tách ra nếu không có dữ liệu gốc.
      }
    }
    
    // Đợi đã, nếu gói tập không lưu Tên, SĐT, DOB, thì việc gộp sai trước đó ĐÃ làm mất thông tin gốc của các gói cũ.
    // VD: Nguyễn Văn A (1990) đăng ký gói 1. Sau đó Nguyễn Văn B đăng ký gói 2 trùng SĐT. 
    // Hệ thống cập nhật Customer thành Nguyễn Văn B. Lúc này gói 1 cũng sẽ hiển thị là của Nguyễn Văn B.
    // Rất tiếc, nếu không có bảng Audit hoặc dữ liệu cũ, không thể khôi phục lại tên "Nguyễn Văn A" cho gói 1.
    // Tuy nhiên, để tuân thủ tương lai, dữ liệu hiện tại (đã bị gộp) sẽ được coi là 1 người (Nguyễn Văn B).
    console.log(`\nLưu ý: Do các gói tập trước đây không lưu bản sao của (Tên, SĐT, DOB) mà tham chiếu trực tiếp đến Customer.`);
    console.log(`Nên các gói đã bị gộp sai trước đây và đè thông tin sẽ không thể tách tự động (vì thiếu dữ liệu gốc).`);
    console.log(`Quy tắc định danh mới (Tên + SĐT + DOB) sẽ áp dụng chặt chẽ cho tất cả các lượt đăng ký/gộp từ bây giờ trở đi.`);

    console.log(`\n=== KẾT THÚC RÀ SOÁT ===`);

  } catch (error) {
    console.error("Lỗi khi rà soát:", error);
  } finally {
    await mongoose.connection.close();
    console.log("Đã đóng kết nối MongoDB.");
  }
}

fixDuplicates();
