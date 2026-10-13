const { canUpdateSchedule } = require("../services/staffScheduleAccessService");

describe("staff schedule object scope", () => {
  const user = (id, role) => ({ _id: id, role });

  test("employees can update only their own schedule", () => {
    expect(canUpdateSchedule({ actor: user("1", "sale"), target: user("1", "sale") })).toBe(true);
    expect(canUpdateSchedule({ actor: user("1", "sale"), target: user("2", "sale") })).toBe(false);
  });

  test("department managers are limited to their department", () => {
    expect(canUpdateSchedule({ actor: user("1", "sm"), target: user("2", "sale") })).toBe(true);
    expect(canUpdateSchedule({ actor: user("1", "sm"), target: user("3", "pt") })).toBe(false);
    expect(canUpdateSchedule({ actor: user("1", "pm"), target: user("3", "pt") })).toBe(true);
  });

  test("branch-wide scheduling roles can update every department", () => {
    expect(canUpdateSchedule({ actor: user("1", "admin"), target: user("2", "pt") })).toBe(true);
    expect(canUpdateSchedule({ actor: user("1", "manager"), target: user("3", "reception") })).toBe(true);
  });
});
