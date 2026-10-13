const {
  buildNotificationFeed,
  getShiftStartTime,
  resolveCommissionTypes,
} = require("../services/notificationFeedService");
const {
  NotificationBroadcastError,
  buildAudienceQuery,
  normalizeChannels,
  prepareManualBroadcast,
  dispatchManualBroadcast,
} = require("../services/notificationBroadcastService");

const queryResult = (value) => ({
  select() { return this; },
  sort() { return this; },
  limit() { return this; },
  lean: jest.fn().mockResolvedValue(value),
});

describe("notification services", () => {
  test("active broadcast audience uses customer lifecycle dates instead of a missing status field", () => {
    const now = new Date("2026-09-24T00:00:00.000Z");
    expect(buildAudienceQuery({ targetAudience: "active", now })).toEqual({
      isDeleted: { $ne: true },
      startDate: { $lte: now },
      endDate: { $gte: now },
    });
  });

  test("rejects unsupported audiences and channels before querying recipients", () => {
    expect(() => buildAudienceQuery({
      targetAudience: "admins",
      now: new Date(),
    })).toThrow(NotificationBroadcastError);
    expect(() => normalizeChannels("email,sms")).toThrow(
      expect.objectContaining({ code: "INVALID_NOTIFICATION_CHANNEL" })
    );
  });

  test("prepares a validated custom recipient without reading global customer data", async () => {
    const Customer = { find: jest.fn() };
    const Setting = {
      findOne: jest.fn(() => ({
        lean: jest.fn().mockResolvedValue({ gymName: "Chi nhánh A" }),
      })),
    };
    const broadcast = await prepareManualBroadcast({
      Customer,
      Setting,
      data: {
        customRecipient: "member@example.com",
        subject: "Xin chào {{ten_khach_hang}}",
        body: "Thông báo từ {{ten_chi_nhanh}}",
        channels: "email",
      },
      now: new Date("2026-09-24T00:00:00.000Z"),
    });
    expect(Customer.find).not.toHaveBeenCalled();
    expect(broadcast.branchName).toBe("Chi nhánh A");
    expect(broadcast.recipients[0].email).toBe("member@example.com");
  });

  test("dispatch personalizes messages and escapes email HTML", async () => {
    const sendEmail = jest.fn().mockResolvedValue(true);
    const sendZalo = jest.fn().mockResolvedValue(true);
    const result = await dispatchManualBroadcast({
      broadcast: {
        subject: "Xin chào {{ten_khach_hang}}",
        body: "Ưu đãi <script>alert(1)</script> tại {{ten_chi_nhanh}}",
        branchName: "Gym <A>",
        channels: ["email", "zalo"],
        attachment: null,
        recipients: [{
          name: "Lan",
          email: "lan@example.com",
          phone: "0900000000",
          packageName: "Member",
          endDate: new Date("2026-10-01T00:00:00.000Z"),
        }],
      },
      sendEmail,
      sendZalo,
      delayMs: 0,
    });
    expect(result).toEqual({ sentEmail: 1, sentZalo: 1 });
    expect(sendEmail.mock.calls[0][0].subject).toBe("Xin chào Lan");
    expect(sendEmail.mock.calls[0][0].htmlContent).toContain("&lt;script&gt;");
    expect(sendEmail.mock.calls[0][0].htmlContent).not.toContain("<script>");
    expect(sendZalo.mock.calls[0][0].message).toContain("Gym <A>");
  });

  test("feed uses permission capabilities and injected customer model", async () => {
    const Customer = {
      find: jest.fn(() => queryResult([{
        _id: "customer-1",
        name: "Lan",
        phone: "0900000000",
        packageType: "Member",
        code: "KH0001",
        endDate: new Date("2026-09-26T00:00:00.000Z"),
      }])),
    };
    const result = await buildNotificationFeed({
      models: { Customer },
      user: { _id: "admin-1", role: "admin" },
      capabilities: {
        canReadCustomers: true,
        canReadTeamTasks: false,
        canReadInventory: false,
        canReadReports: false,
        canReadCommissions: false,
        canReadAllCommissions: false,
      },
      now: new Date("2026-09-24T00:00:00.000Z"),
    });
    expect(Customer.find).toHaveBeenCalledTimes(1);
    expect(result.total).toBe(1);
    expect(result.notifications[0]).toMatchObject({
      type: "expiring_customer",
      severity: "high",
    });
  });

  test("commission visibility is permission-driven and shift times preserve overnight ordering", () => {
    expect(resolveCommissionTypes({
      role: "accountant",
      canReadCommissions: true,
      canReadAllCommissions: true,
    })).toEqual(["pt", "sale"]);
    expect(resolveCommissionTypes({
      role: "pt",
      canReadCommissions: true,
      canReadAllCommissions: false,
    })).toEqual(["pt"]);
    expect(resolveCommissionTypes({
      role: "pt",
      canReadCommissions: false,
      canReadAllCommissions: false,
    })).toEqual([]);
    expect(getShiftStartTime("02:30")).toEqual({ hour: 26, minute: 30 });
  });
});
