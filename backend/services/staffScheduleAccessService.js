const MANAGED_ROLES = Object.freeze({
  admin: ["*"],
  accountant: ["*"],
  manager: ["*"],
  sm: ["sale", "sm"],
  pm: ["pt", "pm"],
  om: ["reception", "om"],
});

const canUpdateSchedule = ({ actor, target }) => {
  if (!actor || !target) return false;
  if (String(actor._id) === String(target._id)) return true;
  const managed = MANAGED_ROLES[actor.role] || [];
  return managed.includes("*") || managed.includes(target.role);
};

const ACCOUNT_MANAGED_ROLES = Object.freeze({
  admin: ["*"],
  manager: ["manager", "sm", "pm", "om", "pt", "sale", "reception"],
  sm: ["sale", "sm"],
  pm: ["pt", "pm"],
  om: ["reception", "om"],
});

const canUpdateStaffAccount = ({ actor, target, nextRole }) => {
  if (!actor || !target) return false;
  const managed = ACCOUNT_MANAGED_ROLES[actor.role] || [];
  if (managed.includes("*")) return true;
  if (!managed.includes(target.role)) return false;
  return !nextRole || managed.includes(nextRole);
};

const canCreateStaffAccount = ({ actor, role }) => {
  const managed = ACCOUNT_MANAGED_ROLES[actor?.role] || [];
  return managed.includes("*") || managed.includes(role);
};

module.exports = {
  MANAGED_ROLES,
  ACCOUNT_MANAGED_ROLES,
  canUpdateSchedule,
  canUpdateStaffAccount,
  canCreateStaffAccount,
};
