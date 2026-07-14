const request = require("supertest");
const app = require("../server");
const User = require("../models/User");
const jwt = require("jsonwebtoken");

// ============================================================
// HELPER – username unique để tránh duplicate key trong cùng test suite
// ============================================================
let _seq = 0;
const createUser = async (role) => {
  _seq++;
  const username = `sched_${role}_${_seq}_${Date.now()}`;
  const user = new User({
    username,
    fullName: `Test ${role.toUpperCase()} ${_seq}`,
    password: "hashed_not_used",
    role,
    status: "active",
  });
  await user.save();
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
  return { token, user };
};

const makeScheduleRequest = (token, staffId, body = {}) =>
  request(app)
    .post(`/api/v1/staff/${staffId}/schedule`)
    .set("Authorization", `Bearer ${token}`)
    .send({ date: "2026-07-01", shiftType: "Sáng", ...body });

// ============================================================
// TESTS
// ============================================================
describe("Schedule Permission – POST /api/v1/staff/:id/schedule", () => {
  let admin, accountant;
  let sm, pm, om;
  let sale, pt, reception;

  beforeEach(async () => {
    admin     = await createUser("admin");
    accountant = await createUser("accountant");
    sm        = await createUser("sm");
    pm        = await createUser("pm");
    om        = await createUser("om");
    sale      = await createUser("sale");
    pt        = await createUser("pt");
    reception = await createUser("reception");
  });

  // ----------------------------------------------------------
  // 1. XÁC THỰC TOKEN
  // ----------------------------------------------------------
  describe("1. Xác thực", () => {
    it("Không có token → 401", async () => {
      const res = await request(app)
        .post(`/api/v1/staff/${sale.user._id}/schedule`)
        .send({ date: "2026-07-01", shiftType: "Sáng" });
      expect(res.status).toBe(401);
    });
  });

  // ----------------------------------------------------------
  // 2. VALIDATION BODY
  // ----------------------------------------------------------
  describe("2. Validation body", () => {
    it("Thiếu date → 400", async () => {
      const res = await request(app)
        .post(`/api/v1/staff/${sale.user._id}/schedule`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ shiftType: "Sáng" });
      expect(res.status).toBe(400);
    });

    it("Thiếu shiftType → 400", async () => {
      const res = await request(app)
        .post(`/api/v1/staff/${sale.user._id}/schedule`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ date: "2026-07-01" });
      expect(res.status).toBe(400);
    });

    it("Staff ID không tồn tại → 404", async () => {
      const fakeId = "64a000000000000000000000";
      const res = await makeScheduleRequest(admin.token, fakeId);
      expect(res.status).toBe(404);
    });
  });

  // ----------------------------------------------------------
  // 3. ADMIN & ACCOUNTANT → sửa được lịch bất kỳ ai
  // ----------------------------------------------------------
  describe("3. Admin / Accountant – quyền toàn hệ thống", () => {
    it("Admin sửa được lịch của sale",      async () => expect((await makeScheduleRequest(admin.token, sale.user._id)).status).toBe(200));
    it("Admin sửa được lịch của pt",        async () => expect((await makeScheduleRequest(admin.token, pt.user._id)).status).toBe(200));
    it("Admin sửa được lịch của reception", async () => expect((await makeScheduleRequest(admin.token, reception.user._id)).status).toBe(200));
    it("Admin sửa được lịch của sm",        async () => expect((await makeScheduleRequest(admin.token, sm.user._id)).status).toBe(200));
    it("Admin sửa được lịch của pm",        async () => expect((await makeScheduleRequest(admin.token, pm.user._id)).status).toBe(200));
    it("Admin sửa được lịch của om",        async () => expect((await makeScheduleRequest(admin.token, om.user._id)).status).toBe(200));
    it("Accountant sửa được lịch của sale", async () => expect((await makeScheduleRequest(accountant.token, sale.user._id)).status).toBe(200));
    it("Accountant sửa được lịch của om",   async () => expect((await makeScheduleRequest(accountant.token, om.user._id)).status).toBe(200));
  });

  // ----------------------------------------------------------
  // 4. SM
  // ----------------------------------------------------------
  describe("4. SM – quản lý sale & sm, bị chặn với role khác", () => {
    it("SM sửa được lịch của sale ✅", async () => {
      expect((await makeScheduleRequest(sm.token, sale.user._id)).status).toBe(200);
    });
    it("SM sửa được lịch của SM khác ✅", async () => {
      const sm2 = await createUser("sm");
      expect((await makeScheduleRequest(sm.token, sm2.user._id)).status).toBe(200);
    });
    it("SM tự sửa lịch chính mình ✅", async () => {
      expect((await makeScheduleRequest(sm.token, sm.user._id)).status).toBe(200);
    });
    it("SM KHÔNG sửa được lịch của pt ❌", async () => {
      expect((await makeScheduleRequest(sm.token, pt.user._id)).status).toBe(403);
    });
    it("SM KHÔNG sửa được lịch của reception ❌", async () => {
      expect((await makeScheduleRequest(sm.token, reception.user._id)).status).toBe(403);
    });
    it("SM KHÔNG sửa được lịch của pm ❌", async () => {
      expect((await makeScheduleRequest(sm.token, pm.user._id)).status).toBe(403);
    });
    it("SM KHÔNG sửa được lịch của om ❌", async () => {
      expect((await makeScheduleRequest(sm.token, om.user._id)).status).toBe(403);
    });
  });

  // ----------------------------------------------------------
  // 5. PM
  // ----------------------------------------------------------
  describe("5. PM – quản lý pt & pm, bị chặn với role khác", () => {
    it("PM sửa được lịch của pt ✅", async () => {
      expect((await makeScheduleRequest(pm.token, pt.user._id)).status).toBe(200);
    });
    it("PM sửa được lịch của PM khác ✅", async () => {
      const pm2 = await createUser("pm");
      expect((await makeScheduleRequest(pm.token, pm2.user._id)).status).toBe(200);
    });
    it("PM tự sửa lịch chính mình ✅", async () => {
      expect((await makeScheduleRequest(pm.token, pm.user._id)).status).toBe(200);
    });
    it("PM KHÔNG sửa được lịch của sale ❌", async () => {
      expect((await makeScheduleRequest(pm.token, sale.user._id)).status).toBe(403);
    });
    it("PM KHÔNG sửa được lịch của reception ❌", async () => {
      expect((await makeScheduleRequest(pm.token, reception.user._id)).status).toBe(403);
    });
    it("PM KHÔNG sửa được lịch của sm ❌", async () => {
      expect((await makeScheduleRequest(pm.token, sm.user._id)).status).toBe(403);
    });
    it("PM KHÔNG sửa được lịch của om ❌", async () => {
      expect((await makeScheduleRequest(pm.token, om.user._id)).status).toBe(403);
    });
  });

  // ----------------------------------------------------------
  // 6. OM
  // ----------------------------------------------------------
  describe("6. OM – quản lý reception & om, bị chặn với role khác", () => {
    it("OM sửa được lịch của reception ✅", async () => {
      expect((await makeScheduleRequest(om.token, reception.user._id)).status).toBe(200);
    });
    it("OM sửa được lịch của OM khác ✅", async () => {
      const om2 = await createUser("om");
      expect((await makeScheduleRequest(om.token, om2.user._id)).status).toBe(200);
    });
    it("OM tự sửa lịch chính mình ✅", async () => {
      expect((await makeScheduleRequest(om.token, om.user._id)).status).toBe(200);
    });
    it("OM KHÔNG sửa được lịch của sale ❌", async () => {
      expect((await makeScheduleRequest(om.token, sale.user._id)).status).toBe(403);
    });
    it("OM KHÔNG sửa được lịch của pt ❌", async () => {
      expect((await makeScheduleRequest(om.token, pt.user._id)).status).toBe(403);
    });
    it("OM KHÔNG sửa được lịch của sm ❌", async () => {
      expect((await makeScheduleRequest(om.token, sm.user._id)).status).toBe(403);
    });
    it("OM KHÔNG sửa được lịch của pm ❌", async () => {
      expect((await makeScheduleRequest(om.token, pm.user._id)).status).toBe(403);
    });
  });

  // ----------------------------------------------------------
  // 7. NHÂN VIÊN CẤP DƯỚI – chỉ tự sửa lịch của mình
  // ----------------------------------------------------------
  describe("7. Nhân viên cấp dưới (sale/pt/reception)", () => {
    it("sale tự sửa lịch chính mình ✅", async () => {
      expect((await makeScheduleRequest(sale.token, sale.user._id)).status).toBe(200);
    });
    it("pt tự sửa lịch chính mình ✅", async () => {
      expect((await makeScheduleRequest(pt.token, pt.user._id)).status).toBe(200);
    });
    it("reception tự sửa lịch chính mình ✅", async () => {
      expect((await makeScheduleRequest(reception.token, reception.user._id)).status).toBe(200);
    });
    it("sale KHÔNG sửa được lịch của sale khác ❌", async () => {
      const sale2 = await createUser("sale");
      expect((await makeScheduleRequest(sale.token, sale2.user._id)).status).toBe(403);
    });
    it("pt KHÔNG sửa được lịch của pt khác ❌", async () => {
      const pt2 = await createUser("pt");
      expect((await makeScheduleRequest(pt.token, pt2.user._id)).status).toBe(403);
    });
    it("reception KHÔNG sửa được lịch của reception khác ❌", async () => {
      const reception2 = await createUser("reception");
      expect((await makeScheduleRequest(reception.token, reception2.user._id)).status).toBe(403);
    });
  });

  // ----------------------------------------------------------
  // 8. RESPONSE DATA & UPSERT
  // ----------------------------------------------------------
  describe("8. Response data & upsert behavior", () => {
    it("Trả về object có shiftType và date đúng", async () => {
      const res = await makeScheduleRequest(admin.token, sale.user._id, {
        date: "2026-07-15",
        shiftType: "Chiều",
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("shiftType", "Chiều");
      expect(res.body).toHaveProperty("date", "2026-07-15");
    });

    it("Gọi 2 lần cùng date → upsert, shiftType được ghi đè", async () => {
      await makeScheduleRequest(admin.token, sale.user._id, { date: "2026-07-20", shiftType: "Sáng" });
      const res = await makeScheduleRequest(admin.token, sale.user._id, { date: "2026-07-20", shiftType: "Chiều" });
      expect(res.status).toBe(200);
      expect(res.body.shiftType).toBe("Chiều");
    });

    it("Schedule có staff field trỏ đúng staffId", async () => {
      const res = await makeScheduleRequest(admin.token, sale.user._id, { date: "2026-07-25", shiftType: "Hành chính" });
      expect(res.status).toBe(200);
      const staffId = res.body.staff?._id || res.body.staff;
      expect(staffId?.toString()).toBe(sale.user._id.toString());
    });
  });
});
