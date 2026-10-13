const {
  buildExistingCustomerQuery,
  findExistingCustomer,
} = require("../services/customerLookupService");
const {
  CustomerExportError,
  buildExportQuery,
  createCustomerWorkbook,
} = require("../services/customerExportService");
const {
  FaceEnrollmentError,
  enrollCustomerFace,
} = require("../services/faceEnrollmentService");

describe("customer read/export services", () => {
  test("existing-customer lookup escapes regex input and uses the injected tenant model", async () => {
    const query = buildExistingCustomerQuery({ name: "An (VIP)+", phone: " 0901 ", dob: "Invalid Date" });
    expect(query.name.$regex.source).toBe("^An \\(VIP\\)\\+$");
    expect(query.phone).toBe("0901");

    const lean = jest.fn().mockResolvedValue({ _id: "branch-customer", name: "An", code: "KH1", phone: "0901" });
    const select = jest.fn(() => ({ lean }));
    const Customer = { findOne: jest.fn(() => ({ select })) };
    const result = await findExistingCustomer({ Customer, filters: { name: "An", phone: "0901" } });

    expect(Customer.findOne).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      exists: true,
      customer: { _id: "branch-customer", name: "An", code: "KH1", phone: "0901" },
    });
  });

  test("export query escapes search and rejects invalid date ranges", async () => {
    const lean = jest.fn().mockResolvedValue([{ _id: "customer-1" }]);
    const select = jest.fn(() => ({ lean }));
    const Customer = { find: jest.fn(() => ({ select })) };
    const query = await buildExportQuery({
      Customer,
      filters: { search: "a.*", paymentStatus: "deposit" },
      now: new Date("2026-09-24T00:00:00Z"),
    });

    expect(Customer.find.mock.calls[0][0].$or[0].name.$regex).toBe("a\\.\\*");
    expect(query.$and).toContainEqual({ customer: { $in: ["customer-1"] } });
    expect(query.$and).toContainEqual({ paymentStatus: "deposit" });

    await expect(buildExportQuery({
      Customer,
      filters: { startDateFrom: "2026-10-01", startDateTo: "2026-09-01" },
    })).rejects.toBeInstanceOf(CustomerExportError);
  });

  test("export workbook contains the bounded customer columns", () => {
    const workbook = createCustomerWorkbook({
      now: new Date("2026-09-24T00:00:00Z"),
      packages: [{
        customer: { code: "KH1", name: "Khách A", phone: "0901" },
        packageName: "Gói A",
        endDate: "2026-09-30T00:00:00Z",
        paymentStatus: "paid",
        status: "active",
      }],
    });
    const worksheet = workbook.getWorksheet("Danh Sách Khách Hàng");
    expect(worksheet).toBeTruthy();
    expect(worksheet.getCell("B5").value).toBe("KH1");
    expect(worksheet.columnCount).toBe(11);
  });
});

describe("face enrollment service", () => {
  test("stores an embedding through the injected tenant model", async () => {
    const customer = {
      avatarUrl: "https://cdn.example/old.jpg",
      save: jest.fn().mockResolvedValue(undefined),
    };
    const Customer = { findById: jest.fn().mockResolvedValue(customer) };
    const CustomerPackage = { findById: jest.fn() };
    const faceClient = { getEmbedding: jest.fn().mockResolvedValue({ found: true, embedding: [0.1, 0.2] }) };
    const cloudinary = {
      extractPublicId: jest.fn().mockReturnValue("old"),
      uploadBuffer: jest.fn().mockResolvedValue({ secure_url: "https://cdn.example/new.jpg" }),
      client: { uploader: { destroy: jest.fn().mockRejectedValue(new Error("stale")) } },
    };

    const result = await enrollCustomerFace({
      Customer,
      CustomerPackage,
      customerId: "customer-1",
      file: { buffer: Buffer.from("image") },
      faceClient,
      cloudinary,
    });

    expect(Customer.findById).toHaveBeenCalledWith("customer-1");
    expect(CustomerPackage.findById).not.toHaveBeenCalled();
    expect(customer.faceEmbedding).toEqual([0.1, 0.2]);
    expect(customer.avatarUrl).toBe("https://cdn.example/new.jpg");
    expect(customer.save).toHaveBeenCalledTimes(1);
    expect(result.embeddingSize).toBe(2);
  });

  test("rejects a missing image before querying customer data", async () => {
    const Customer = { findById: jest.fn() };
    await expect(enrollCustomerFace({ Customer, customerId: "customer-1" }))
      .rejects.toEqual(expect.objectContaining({
        statusCode: 400,
        code: "FACE_IMAGE_REQUIRED",
      }));
    expect(Customer.findById).not.toHaveBeenCalled();
    expect(FaceEnrollmentError).toBeDefined();
  });
});
