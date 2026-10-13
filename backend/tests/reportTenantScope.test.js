const {
  getPackageDistribution,
} = require("../controllers/reportController");
const {
  buildDashboardTaskQuery,
  resolveDashboardView,
} = require("../controllers/dashboardController");

const createResponse = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe("Dashboard and report tenant scope", () => {
  test("department managers with branch-wide permission use the branch overview", () => {
    expect(resolveDashboardView({ role: "sm", canReadAllReports: true })).toBe("branch");
    expect(resolveDashboardView({ role: "pm", canReadAllReports: true })).toBe("branch");
  });

  test("individual specialist roles keep their role dashboard when granted wider reports", () => {
    expect(resolveDashboardView({ role: "pt", canReadAllReports: true })).toBe("pt");
    expect(resolveDashboardView({ role: "sale", canReadAllReports: true })).toBe("sale");
  });

  test("self-scoped roles keep their own dashboard without branch-wide permission", () => {
    expect(resolveDashboardView({ role: "pt", canReadAllReports: false })).toBe("pt");
    expect(resolveDashboardView({ role: "sale", canReadAllReports: false })).toBe("sale");
    expect(resolveDashboardView({ role: "reception", canReadAllReports: false })).toBe("operations");
  });

  test("dashboard task query follows the role's operational team scope", () => {
    expect(buildDashboardTaskQuery({ date: "2026-09-27", role: "sale" })).toEqual({
      date: "2026-09-27",
      isCompleted: false,
      team: { $in: ["sale"] },
    });
    expect(buildDashboardTaskQuery({ date: "2026-09-27", role: "admin" }).team.$in)
      .toEqual(["sale", "pt", "reception"]);
    expect(buildDashboardTaskQuery({ date: "2026-09-27", role: "staff" })).toBeNull();
  });

  test("report queries use the Customer model selected for the request tenant", async () => {
    const aggregate = jest.fn().mockResolvedValue([
      { _id: "Premium", count: 3 },
    ]);
    const req = { models: { Customer: { aggregate } } };
    const res = createResponse();

    await getPackageDistribution(req, res);

    expect(aggregate).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith([
      { name: "Premium", value: 3 },
    ]);
  });
});
