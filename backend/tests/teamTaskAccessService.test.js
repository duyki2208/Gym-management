const {
  getVisibleTeams,
  resolveRequestedTeam,
  canAccessTeam,
} = require("../services/teamTaskAccessService");

describe("team task object scope", () => {
  test("staff roles only see their own operational team", () => {
    expect(getVisibleTeams("sale")).toEqual(["sale"]);
    expect(getVisibleTeams("pt")).toEqual(["pt"]);
    expect(canAccessTeam("reception", "sale")).toBe(false);
  });

  test("managers cannot create tasks outside their mapped team", () => {
    expect(resolveRequestedTeam("sm", "pt")).toBe("sale");
    expect(resolveRequestedTeam("pm", "sale")).toBe("pt");
  });

  test("cross-team roles must select a valid team", () => {
    expect(resolveRequestedTeam("admin", "pt")).toBe("pt");
    expect(resolveRequestedTeam("accountant", "unknown")).toBeNull();
  });
});
