jest.mock("../models/AuditLog", () => ({ create: jest.fn() }));

const AuditLog = require("../models/AuditLog");
const { sendZaloNotification } = require("../utils/zaloService");

describe("Zalo OA mock logging", () => {
  test("does not expose the full recipient phone number", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    AuditLog.create.mockResolvedValue({});

    await sendZaloNotification({
      phone: "0921982922",
      message: "Thông báo kiểm thử",
      type: "package_purchase",
    });

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("092****922"));
    expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining("0921982922"));
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      action: expect.stringContaining("092****922"),
      details: expect.objectContaining({ phone: "092****922" }),
    }));

    consoleSpy.mockRestore();
  });
});
