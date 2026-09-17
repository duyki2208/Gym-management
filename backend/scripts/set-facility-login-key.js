/**
 * Gán hoặc xoay mã đăng nhập cho một cơ sở mà không lưu mã rõ trong database.
 *
 * PowerShell:
 *   $env:TARGET_BRANCH_CODE="HN01"
 *   $env:FACILITY_LOGIN_KEY="Dvertofit"
 *   npm run facility-key:set
 *
 * Cần cấu hình FACILITY_LOOKUP_PEPPER (tối thiểu 32 ký tự) trong môi trường.
 */
const dotenv = require("dotenv");
dotenv.config();

const { initCentralConnection, getCentralModels } = require("../db/branchConnectionManager");
const { hashFacilityKey, encryptFacilityKey } = require("../utils/facilityKey");

const run = async () => {
  const branchCode = String(process.env.TARGET_BRANCH_CODE || "").trim().toUpperCase();
  const facilityKey = process.env.FACILITY_LOGIN_KEY;

  if (!branchCode || !facilityKey) {
    throw new Error("TARGET_BRANCH_CODE và FACILITY_LOGIN_KEY là bắt buộc");
  }

  await initCentralConnection();
  const centralModels = await getCentralModels();
  const encryptedFields = encryptFacilityKey(facilityKey);
  const branch = await centralModels.Branch.findOneAndUpdate(
    { code: branchCode },
    {
      $set: {
        loginKeyHash: hashFacilityKey(facilityKey),
        ...encryptedFields,
      },
    },
    { new: true }
  );

  if (!branch) {
    throw new Error(`Không tìm thấy cơ sở ${branchCode}`);
  }

  console.log(`Đã cập nhật mã đăng nhập an toàn cho cơ sở ${branchCode}.`);
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(`[LỖI] ${error.message}`);
    process.exit(1);
  });
