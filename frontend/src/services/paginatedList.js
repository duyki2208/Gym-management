// Existing screens need the complete list for POS/import/local filtering.
// Read bounded API pages, and fail explicitly rather than silently dropping rows.
export const readAllPages = async (loadPage) => {
  const items = [];
  for (let page = 1; page <= 100; page++) {
    const result = await loadPage(page, 100);
    if (!Array.isArray(result.items) || !Number.isSafeInteger(result.totalPages) || result.totalPages < 1) {
      throw new Error("Phản hồi phân trang không hợp lệ");
    }
    if (result.totalPages > 100) throw new Error("Danh sách vượt 10.000 bản ghi, vui lòng thu hẹp bộ lọc");
    items.push(...result.items);
    if (page >= result.totalPages) return items;
  }
  throw new Error("Không thể tải đủ danh sách");
};
