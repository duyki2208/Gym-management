export const hasPermission = (user, permission) => {
  if (!permission) return true;
  // Phiên được lưu từ bản cũ chưa có field permissions. Chỉ fallback
  // UX trong trường hợp field vắng mặt; backend vẫn enforce mọi request.
  if (!Array.isArray(user?.permissions)) return true;
  const permissions = user.permissions;
  return permissions.includes("*") || permissions.includes(permission);
};

export const hasAnyPermission = (user, permissions = []) =>
  permissions.length === 0 || permissions.some((permission) => hasPermission(user, permission));
