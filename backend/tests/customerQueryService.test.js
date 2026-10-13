const {
  escapeRegex,
  listCustomers,
} = require("../services/customerQueryService");

const createPackageQuery = (documents = []) => {
  const query = {
    populate: jest.fn(() => query),
    sort: jest.fn(() => query),
    skip: jest.fn(() => query),
    limit: jest.fn(() => query),
    lean: jest.fn().mockResolvedValue(documents),
  };
  return query;
};

describe("customer query service", () => {
  test("escapes regex metacharacters in user search", () => {
    expect(escapeRegex("a.*(b)+")).toBe("a\\.\\*\\(b\\)\\+");
  });

  test("caps pagination and keeps an empty result contract", async () => {
    const packageQuery = createPackageQuery();
    const Customer = { find: jest.fn() };
    const CustomerPackage = {
      countDocuments: jest.fn().mockResolvedValue(0),
      find: jest.fn(() => packageQuery),
    };

    const result = await listCustomers({
      Customer,
      CustomerPackage,
      filters: { page: "-2", limit: "500" },
    });

    expect(packageQuery.skip).toHaveBeenCalledWith(0);
    expect(packageQuery.limit).toHaveBeenCalledWith(100);
    expect(result).toMatchObject({ currentPage: 1, limit: 100, totalPages: 0 });
  });

  test("rejects invalid date filters before querying packages", async () => {
    await expect(listCustomers({
      Customer: {},
      CustomerPackage: {},
      filters: { startDateFrom: "not-a-date" },
    })).rejects.toMatchObject({ code: "INVALID_DATE_FILTER" });
  });
});
