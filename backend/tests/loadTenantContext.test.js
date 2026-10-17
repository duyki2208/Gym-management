const mockGetCentralModels = jest.fn();
const mockGetBranchModels = jest.fn();

jest.mock("../db/branchConnectionManager", () => ({
  getCentralModels: mockGetCentralModels,
  getBranchModels: mockGetBranchModels,
}));

const loadTenantContext = require("../middleware/loadTenantContext");

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

describe("tenant context branch validation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCentralModels.mockResolvedValue({
      Branch: {
        findOne: jest.fn(() => ({
          select: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(null) })),
        })),
      },
    });
  });

  test("login does not instantiate a branch model from an anonymous header", async () => {
    const req = {
      path: "/auth/login",
      branchCode: "UNTRUSTED01",
      headers: { "x-branch-code": "UNTRUSTED01" },
      query: {},
    };
    const res = response();
    const next = jest.fn();

    await loadTenantContext(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(mockGetBranchModels).not.toHaveBeenCalled();
    expect(req.models).toBeUndefined();
  });

  test("an unknown explicit branch is rejected before branch models are loaded", async () => {
    const req = {
      path: "/customers",
      branchCode: "UNTRUSTED01",
      headers: { "x-branch-code": "UNTRUSTED01" },
      query: {},
    };
    const res = response();
    const next = jest.fn();

    await loadTenantContext(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe("BRANCH_ACCESS_DENIED");
    expect(next).not.toHaveBeenCalled();
    expect(mockGetBranchModels).not.toHaveBeenCalled();
  });
});
