export const hasPermission = (user, permission) => {
  if (!permission) return true;
  if (!Array.isArray(user?.permissions)) return false;
  const permissions = user.permissions;
  return permissions.includes("*") || permissions.includes(permission);
};

export const hasAnyPermission = (user, permissions = []) =>
  permissions.length === 0 || permissions.some((permission) => hasPermission(user, permission));
