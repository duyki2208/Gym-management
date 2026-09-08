const jwt = require("jsonwebtoken");
const cacheService = require("../utils/cacheService");
const cacheMiddleware = require("../middleware/cacheMiddleware");

const bcrypt = require("bcryptjs");
const { getCentralModels } = require("../db/branchConnectionManager");

// Mock branchConnectionManager to avoid real DB connections during unit test
jest.mock("../db/branchConnectionManager", () => ({
  getCentralModels: jest.fn().mockResolvedValue({}),
  getBranchModels: jest.fn().mockResolvedValue({}),
}));

const attachBranchContext = require("../middleware/attachBranchContext");
const authController = require("../controllers/authController");

const getJwtSecret = () => process.env.JWT_SECRET || "testsecret123";
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "testrefreshsecret123";

const createMockRes = () => {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
  };
  return res;
};

describe("Branch Security and Cache Isolation Tests", () => {
  beforeEach(async () => {
    await cacheService.clear();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await cacheService.clear();
  });

  describe("1. attachBranchContext - Access Control via X-Branch-Code", () => {
    test("Central accountant with allowedBranches: ['HN01'] sending X-Branch-Code: HN02 -> 403 BRANCH_ACCESS_DENIED", async () => {
      const token = jwt.sign(
        {
          id: "acc_1",
          role: "accountant",
          isCentral: true,
          allowedBranches: ["HN01"],
          activeBranch: "HN01",
        },
        getJwtSecret()
      );

      const req = {
        headers: {
          authorization: `Bearer ${token}`,
          "x-branch-code": "HN02",
        },
        query: {},
      };
      const res = createMockRes();
      const next = jest.fn();

      await attachBranchContext(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({
        code: "BRANCH_ACCESS_DENIED",
        message: "Bạn không có quyền truy cập dữ liệu chi nhánh HN02",
      });
      expect(req.branchCode).toBeUndefined();
      expect(next).not.toHaveBeenCalled();
    });

    test("Central accountant with allowedBranches: ['HN01'] sending X-Branch-Code: HN01 -> Success (next called, req.branchCode = HN01)", async () => {
      const token = jwt.sign(
        {
          id: "acc_1",
          role: "accountant",
          isCentral: true,
          allowedBranches: ["HN01"],
          activeBranch: "HN01",
        },
        getJwtSecret()
      );

      const req = {
        headers: {
          authorization: `Bearer ${token}`,
          "x-branch-code": "HN01",
        },
        query: {},
      };
      const res = createMockRes();
      const next = jest.fn();

      await attachBranchContext(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(req.branchCode).toBe("HN01");
      expect(next).toHaveBeenCalledTimes(1);
    });

    test("Branch user with branchCode: 'HN01' sending X-Branch-Code: HN02 -> 403 BRANCH_ACCESS_DENIED", async () => {
      const token = jwt.sign(
        {
          id: "staff_1",
          role: "staff",
          branchCode: "HN01",
        },
        getJwtSecret()
      );

      const req = {
        headers: {
          authorization: `Bearer ${token}`,
          "x-branch-code": "HN02",
        },
        query: {},
      };
      const res = createMockRes();
      const next = jest.fn();

      await attachBranchContext(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({
        code: "BRANCH_ACCESS_DENIED",
        message: "Tài khoản chi nhánh HN01 không được phép truy cập chi nhánh HN02",
      });
      expect(req.branchCode).toBeUndefined();
      expect(next).not.toHaveBeenCalled();
    });

    test("Central Admin with allowedBranches: ['*'] sending X-Branch-Code: SG01 -> Allowed (req.branchCode = SG01)", async () => {
      const token = jwt.sign(
        {
          id: "admin_1",
          role: "admin",
          isCentral: true,
          allowedBranches: ["*"],
          activeBranch: "HN01",
        },
        getJwtSecret()
      );

      const req = {
        headers: {
          authorization: `Bearer ${token}`,
          "x-branch-code": "SG01",
        },
        query: {},
      };
      const res = createMockRes();
      const next = jest.fn();

      await attachBranchContext(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(req.branchCode).toBe("SG01");
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe("2. cacheMiddleware - Cross-Branch Cache Isolation", () => {
    const middleware = cacheMiddleware(60, "packages");

    test("GET /api/packages for HN01 caches data for HN01 only, and HN02 gets a cache MISS", async () => {
      // 1. Request từ chi nhánh HN01
      const reqHN01 = {
        method: "GET",
        originalUrl: "/api/packages",
        url: "/api/packages",
        branchCode: "HN01",
      };
      const resHN01 = createMockRes();
      let nextCalledHN01 = false;

      await middleware(reqHN01, resHN01, () => {
        nextCalledHN01 = true;
      });

      expect(nextCalledHN01).toBe(true);
      expect(resHN01.headers["X-Cache"]).toBe("MISS");

      // Controller trả dữ liệu cho HN01
      const hn01Data = [{ id: 1, name: "Gói tập Hà Nội 01" }];
      resHN01.json(hn01Data);

      // Đợi cache ghi xong (do cacheService.set là async non-blocking trong res.json)
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 2. Request từ chi nhánh HN02 cùng URL /api/packages
      const reqHN02 = {
        method: "GET",
        originalUrl: "/api/packages",
        url: "/api/packages",
        branchCode: "HN02",
      };
      const resHN02 = createMockRes();
      let nextCalledHN02 = false;

      await middleware(reqHN02, resHN02, () => {
        nextCalledHN02 = true;
      });

      // Phải là MISS! Không được trả nhầm dữ liệu của HN01
      expect(resHN02.headers["X-Cache"]).toBe("MISS");
      expect(nextCalledHN02).toBe(true);
      expect(resHN02.body).toBeNull();

      // Controller trả dữ liệu cho HN02
      const hn02Data = [{ id: 2, name: "Gói tập Hà Nội 02" }];
      resHN02.json(hn02Data);
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 3. Request lại từ chi nhánh HN01 -> Phải là CACHE HIT và nhận đúng hn01Data
      const reqHN01Again = {
        method: "GET",
        originalUrl: "/api/packages",
        url: "/api/packages",
        branchCode: "HN01",
      };
      const resHN01Again = createMockRes();
      let nextCalledHN01Again = false;

      await middleware(reqHN01Again, resHN01Again, () => {
        nextCalledHN01Again = true;
      });

      expect(resHN01Again.headers["X-Cache"]).toBe("HIT");
      expect(resHN01Again.body).toEqual(hn01Data);
      expect(nextCalledHN01Again).toBe(false);
    });

    test("Scoping delPattern by branch clears only specified branch cache", async () => {
      // Thiết lập cache cho HN01 và HN02
      await cacheService.set("api:packages:HN01:/api/packages", [{ branch: "HN01" }], 60);
      await cacheService.set("api:packages:HN02:/api/packages", [{ branch: "HN02" }], 60);

      // Xóa cache scoped theo chi nhánh HN01
      await cacheService.delPattern("api:packages:HN01");

      // Cache của HN01 phải bị xóa (null), cache của HN02 vẫn còn nguyên
      const hn01Cached = await cacheService.get("api:packages:HN01:/api/packages");
      const hn02Cached = await cacheService.get("api:packages:HN02:/api/packages");

      expect(hn01Cached).toBeNull();
      expect(hn02Cached).toEqual([{ branch: "HN02" }]);
    });
  });

  describe("3. authController.loginUser - Pre-token reqBranchCode Validation", () => {
    test("Central accountant with allowedBranches: ['HN01'] requesting branchCode: 'HN02' -> 403 BRANCH_ACCESS_DENIED without token", async () => {
      const mockCentralUser = {
        _id: "central_acc_1",
        username: "accountant_user",
        password: "hashed_password",
        role: "accountant",
        isActive: true,
        allowedBranches: ["HN01"],
      };

      getCentralModels.mockResolvedValue({
        LoginIndex: { findOne: jest.fn().mockResolvedValue(null) },
        CentralUser: { findOne: jest.fn().mockResolvedValue(mockCentralUser) },
        CentralSession: { create: jest.fn().mockResolvedValue({}) },
      });

      jest.spyOn(bcrypt, "compare").mockResolvedValue(true);

      const req = {
        body: {
          username: "accountant_user",
          password: "correct_password",
          branchCode: "HN02",
        },
        headers: {},
      };
      const res = createMockRes();

      await authController.loginUser(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({
        code: "BRANCH_ACCESS_DENIED",
        message: "Bạn không có quyền đăng nhập vào chi nhánh HN02",
      });
      // Đảm bảo không cấp token khi bị chặn
      expect(res.body.token).toBeUndefined();
    });

    test("Central accountant with allowedBranches: ['HN01'] requesting branchCode: 'HN01' -> 200 and issues token", async () => {
      const mockCentralUser = {
        _id: "central_acc_1",
        username: "accountant_user",
        password: "hashed_password",
        role: "accountant",
        isActive: true,
        allowedBranches: ["HN01"],
      };

      getCentralModels.mockResolvedValue({
        LoginIndex: { findOne: jest.fn().mockResolvedValue(null) },
        CentralUser: { findOne: jest.fn().mockResolvedValue(mockCentralUser) },
        CentralSession: { create: jest.fn().mockResolvedValue({}) },
      });

      jest.spyOn(bcrypt, "compare").mockResolvedValue(true);

      const req = {
        body: {
          username: "accountant_user",
          password: "correct_password",
          branchCode: "HN01",
        },
        headers: {},
        cookie: jest.fn(),
      };
      res = createMockRes();
      res.cookie = jest.fn();

      await authController.loginUser(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.token).toBeDefined();
      const decoded = jwt.verify(res.body.token, getJwtSecret());
      expect(decoded.activeBranch).toBe("HN01");
      expect(decoded.allowedBranches).toEqual(["HN01"]);
    });
  });
});
