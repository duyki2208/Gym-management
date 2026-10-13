const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const request = require("supertest");

const app = require("../server");
const User = require("../models/User");
const Lead = require("../models/Lead");
const SaleOrder = require("../models/SaleOrder");
const Commission = require("../models/Commission");
const CommissionPeriod = require("../models/CommissionPeriod");
const WorkoutSession = require("../models/WorkoutSession");
const Setting = require("../models/Setting");

let userSequence = 0;

const createUser = async (role) => {
  userSequence += 1;
  const user = await User.create({
    username: `idor_${role}_${userSequence}`,
    fullName: `IDOR ${role} ${userSequence}`,
    password: "password123",
    role,
    status: "active",
  });
  const token = jwt.sign(
    {
      id: user._id,
      role,
      branchCode: "HN01",
      activeBranch: "HN01",
      allowedBranches: role === "admin" ? ["*"] : ["HN01"],
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );
  return { user, token };
};

const auth = (token) => ({ Authorization: `Bearer ${token}` });

describe("Object-level authorization regression", () => {
  test("session endpoint returns the effective branch permissions", async () => {
    const sale = await createUser("sale");

    const response = await request(app)
      .get("/api/v1/auth/me")
      .set(auth(sale.token))
      .expect(200);

    expect(response.body.user.permissions).toContain("lead.read");
    expect(response.body.user.permissions).not.toContain("lead.read_all");
  });

  test("settings page data requires an explicit read permission", async () => {
    const sale = await createUser("sale");
    const accountant = await createUser("accountant");
    const admin = await createUser("admin");
    await Setting.create({
      sepayApiKey: "sensitive-key",
      cameraRtspUrl: "rtsp://user:password@camera.local/live",
      vietqrAccountNo: "123456789",
      vietqrAccountName: "GYM OWNER",
    });

    await request(app)
      .get("/api/v1/settings")
      .set(auth(sale.token))
      .expect(403);

    const redacted = await request(app)
      .get("/api/v1/settings")
      .set(auth(accountant.token))
      .expect(200);
    expect(redacted.body.data.sepayApiKey).toBeUndefined();
    expect(redacted.body.data.cameraRtspUrl).toBeUndefined();
    expect(redacted.body.data.vietqrAccountNo).toBeUndefined();

    const privileged = await request(app)
      .get("/api/v1/settings")
      .set(auth(admin.token))
      .expect(200);
    expect(privileged.body.data.sepayApiKey).toBe("sensitive-key");
  });

  test("a sale can read their own KPI but not another employee's KPI", async () => {
    const firstSale = await createUser("sale");
    const secondSale = await createUser("sale");

    await request(app)
      .get(`/api/v1/kpi/${firstSale.user._id}`)
      .set(auth(firstSale.token))
      .expect(200);

    const denied = await request(app)
      .get(`/api/v1/kpi/${secondSale.user._id}`)
      .set(auth(firstSale.token))
      .expect(403);

    expect(denied.body.code).toBe("OBJECT_ACCESS_DENIED");
  });

  test("a manager can read another employee's KPI", async () => {
    const manager = await createUser("manager");
    const sale = await createUser("sale");

    await request(app)
      .get(`/api/v1/kpi/${sale.user._id}`)
      .set(auth(manager.token))
      .expect(200);
  });

  test("POS order status is visible only to its creator or a privileged role", async () => {
    const owner = await createUser("sale");
    const otherSale = await createUser("sale");
    const manager = await createUser("manager");
    const order = await SaleOrder.create({
      totalAmount: 100000,
      paymentMethod: "Tiền mặt",
      status: "Đã thanh toán",
      details: [],
      staff: owner.user._id,
    });

    await request(app)
      .get(`/api/v1/pos/order-status/${order._id}`)
      .set(auth(owner.token))
      .expect(200);

    const denied = await request(app)
      .get(`/api/v1/pos/order-status/${order._id}`)
      .set(auth(otherSale.token))
      .expect(403);
    expect(denied.body.code).toBe("OBJECT_ACCESS_DENIED");

    await request(app)
      .get(`/api/v1/pos/order-status/${order._id}`)
      .set(auth(manager.token))
      .expect(200);
  });

  test("POS sales listing is scoped to the current employee", async () => {
    const firstSale = await createUser("sale");
    const secondSale = await createUser("sale");
    await SaleOrder.create([
      {
        totalAmount: 100000,
        paymentMethod: "Tiền mặt",
        status: "Đã thanh toán",
        details: [],
        staff: firstSale.user._id,
      },
      {
        totalAmount: 200000,
        paymentMethod: "Tiền mặt",
        status: "Đã thanh toán",
        details: [],
        staff: secondSale.user._id,
      },
    ]);

    const response = await request(app)
      .get("/api/v1/pos/sales?preset=all")
      .set(auth(firstSale.token))
      .expect(200);

    expect(response.body.sales).toHaveLength(1);
    expect(response.body.sales[0].staff).toBe(String(firstSale.user._id));

    await SaleOrder.create([
      {
        totalAmount: 300000,
        paymentMethod: "Tiền mặt",
        status: "Đã thanh toán",
        details: [],
        staff: firstSale.user._id,
      },
      {
        totalAmount: 400000,
        paymentMethod: "Tiền mặt",
        status: "Đã thanh toán",
        details: [],
        staff: firstSale.user._id,
      },
    ]);

    const paginated = await request(app)
      .get("/api/v1/pos/sales?preset=all&page=2&limit=2")
      .set(auth(firstSale.token))
      .expect(200);

    expect(paginated.body.sales).toHaveLength(1);
    expect(paginated.body.sales[0].staff).toBe(String(firstSale.user._id));
    expect(paginated.body.pagination).toEqual({
      page: 2,
      limit: 2,
      totalItems: 3,
      totalPages: 2,
    });
    expect(paginated.body.summary.totalOrders).toBe(3);
  });

  test("lead listing and mutation are scoped to the assigned sale", async () => {
    const firstSale = await createUser("sale");
    const secondSale = await createUser("sale");
    const ownLead = await Lead.create({
      name: "Lead owned by first sale",
      phone: "0900000001",
      assignedSale: firstSale.user._id,
    });
    const otherLead = await Lead.create({
      name: "Lead owned by second sale",
      phone: "0900000002",
      assignedSale: secondSale.user._id,
    });

    const list = await request(app)
      .get("/api/v1/leads")
      .set(auth(firstSale.token))
      .expect(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0]._id).toBe(String(ownLead._id));

    const denied = await request(app)
      .put(`/api/v1/leads/${otherLead._id}`)
      .set(auth(firstSale.token))
      .send({ status: "contacted" })
      .expect(403);
    expect(denied.body.code).toBe("OBJECT_ACCESS_DENIED");

    await request(app)
      .put(`/api/v1/leads/${ownLead._id}`)
      .set(auth(firstSale.token))
      .send({ status: "contacted" })
      .expect(200);
  });

  test("a manager can update a lead assigned to another employee", async () => {
    const manager = await createUser("manager");
    const sale = await createUser("sale");
    const lead = await Lead.create({
      name: "Managed lead",
      phone: "0900000003",
      assignedSale: sale.user._id,
    });

    await request(app)
      .put(`/api/v1/leads/${lead._id}`)
      .set(auth(manager.token))
      .send({ status: "trial" })
      .expect(200);

    expect((await Lead.findById(lead._id)).status).toBe("trial");
  });

  test("commission queries are self-scoped unless the role can read all", async () => {
    const firstSale = await createUser("sale");
    const secondSale = await createUser("sale");
    const manager = await createUser("manager");
    const now = new Date();
    await Commission.create([
      {
        type: "sale",
        staff: firstSale.user._id,
        amount: 100000,
        rate: 5,
        baseAmount: 2000000,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      },
      {
        type: "sale",
        staff: secondSale.user._id,
        amount: 200000,
        rate: 5,
        baseAmount: 4000000,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      },
    ]);

    const selfResponse = await request(app)
      .get(`/api/v1/commissions/sale?staffId=${secondSale.user._id}`)
      .set(auth(firstSale.token))
      .expect(200);
    expect(selfResponse.body.data.staffSummary).toHaveLength(1);
    expect(selfResponse.body.data.staffSummary[0].staff._id).toBe(String(firstSale.user._id));

    const managerResponse = await request(app)
      .get("/api/v1/commissions/sale")
      .set(auth(manager.token))
      .expect(200);
    expect(managerResponse.body.data.staffSummary).toHaveLength(2);

    await request(app)
      .get("/api/v1/commissions/summary")
      .set(auth(firstSale.token))
      .expect(403);
    await request(app)
      .get("/api/v1/commissions/summary")
      .set(auth(manager.token))
      .expect(200);

    await CommissionPeriod.create([
      { month: now.getMonth() + 1, year: now.getFullYear(), type: "pt" },
      { month: now.getMonth() + 1, year: now.getFullYear(), type: "sale" },
    ]);
    const salePeriods = await request(app)
      .get("/api/v1/commissions/periods")
      .set(auth(firstSale.token))
      .expect(200);
    expect(salePeriods.body.data).toHaveLength(1);
    expect(salePeriods.body.data[0].type).toBe("sale");
  });

  test("global search does not reveal another sale's leads", async () => {
    const firstSale = await createUser("sale");
    const secondSale = await createUser("sale");
    await Lead.create([
      { name: "Scoped Lead One", phone: "0900000011", assignedSale: firstSale.user._id },
      { name: "Scoped Lead Two", phone: "0900000012", assignedSale: secondSale.user._id },
    ]);

    const response = await request(app)
      .get("/api/v1/search?q=Scoped&categories=leads")
      .set(auth(firstSale.token))
      .expect(200);

    expect(response.body.data.leads).toHaveLength(1);
    expect(response.body.data.leads[0].name).toBe("Scoped Lead One");
  });

  test("staff directory never serializes password hashes", async () => {
    const sale = await createUser("sale");

    const response = await request(app)
      .get("/api/v1/staff")
      .set(auth(sale.token))
      .expect(200);

    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body.every((staff) => staff.password === undefined)).toBe(true);
  });

  test("PT reports and disputes cannot target another PT's workout", async () => {
    const firstPt = await createUser("pt");
    const secondPt = await createUser("pt");
    const manager = await createUser("manager");
    const customerId = new mongoose.Types.ObjectId();
    const [firstWorkout, secondWorkout] = await WorkoutSession.create([
      {
        customer: customerId,
        pt: firstPt.user._id,
        ptName: firstPt.user.fullName,
        confirmedBy: manager.user._id,
      },
      {
        customer: customerId,
        pt: secondPt.user._id,
        ptName: secondPt.user.fullName,
        confirmedBy: manager.user._id,
      },
    ]);

    const selfReport = await request(app)
      .get(`/api/v1/reports/pt-sessions?ptId=${secondPt.user._id}`)
      .set(auth(firstPt.token))
      .expect(200);
    expect(selfReport.body.data.sessions).toHaveLength(1);
    expect(selfReport.body.data.sessions[0]._id).toBe(String(firstWorkout._id));

    await request(app)
      .post("/api/v1/reports/pt-sessions/dispute")
      .set(auth(firstPt.token))
      .send({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        workoutLogId: secondWorkout._id,
        reason: "Không thuộc buổi tập của tôi",
      })
      .expect(403);

    const managerReport = await request(app)
      .get("/api/v1/reports/pt-sessions")
      .set(auth(manager.token))
      .expect(200);
    expect(managerReport.body.data.sessions).toHaveLength(2);
  });

  test("aggregate business reports require branch-wide report permission", async () => {
    const sale = await createUser("sale");
    const manager = await createUser("manager");

    await request(app)
      .get("/api/v1/reports/summary")
      .set(auth(sale.token))
      .expect(403);

    await request(app)
      .get("/api/v1/reports/summary")
      .set(auth(manager.token))
      .expect(200);
  });
});
