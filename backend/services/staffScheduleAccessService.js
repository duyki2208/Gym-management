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

module.exports = { MANAGED_ROLES, canUpdateSchedule };
