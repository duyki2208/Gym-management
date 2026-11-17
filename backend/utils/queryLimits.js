const QUERY_TIMEOUT_MS = 2000;
const invalid = (message) => Object.assign(new Error(message), { statusCode: 400, code: "INVALID_QUERY" });
const searchText = (value = "") => {
  if (typeof value !== "string" || value.length > 100) throw invalid("Từ khóa phải là chuỗi tối đa 100 ký tự");
  return value.trim();
};
const literalSearch = (value) => searchText(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const positive = (value, fallback, maximum, cap = false) => {
  if (value === undefined) return fallback;
  if (!["string", "number"].includes(typeof value) || !/^\d+$/.test(String(value)) ||
      !Number.isSafeInteger(Number(value)) || Number(value) < 1 || (!cap && Number(value) > maximum)) {
    throw invalid("page/limit phải là số nguyên dương trong giới hạn");
  }
  return Math.min(Number(value), maximum);
};
const pagination = (query = {}, defaultLimit = 50, maxLimit = 100) => {
  const page = positive(query.page, 1, 10000);
  const limit = positive(query.limit, defaultLimit, maxLimit, true);
  return { page, limit, skip: (page - 1) * limit };
};
const queryError = (res, error, fallback = "Không thể tải dữ liệu") => res.status(error.statusCode || (error.code === 50 ? 503 : 500))
  .json({ success: false, code: error.statusCode === 400 ? "INVALID_QUERY" : error.code === 50 ? "QUERY_TIMEOUT" : undefined,
    message: error.statusCode === 400 ? error.message : fallback });
module.exports = { QUERY_TIMEOUT_MS, searchText, literalSearch, pagination, queryError };
