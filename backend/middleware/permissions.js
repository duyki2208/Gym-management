const PERMISSIONS = Object.freeze({
  AUDIT_READ: "audit.read",
  BRANCH_TRANSFER_CREATE: "branch_transfer.create",
  BRANCH_TRANSFER_READ: "branch_transfer.read",
  CHECKIN_USE: "checkin.use",
  CLOSURE_MANAGE: "closure.manage",
  COMMISSION_READ: "commission.read",
  COMMISSION_READ_ALL: "commission.read_all",
  COMMISSION_MANAGE: "commission.manage",
  COMMISSION_REVOKE: "commission.revoke",
  CUSTOMER_READ: "customer.read",
  CUSTOMER_CHECK_EXISTING: "customer.check_existing",
  CUSTOMER_EXPORT: "customer.export",
  CUSTOMER_CREATE: "customer.create",
  CUSTOMER_UPDATE: "customer.update",
  CUSTOMER_DELETE: "customer.delete",
  CONTRACT_MANAGE: "contract.manage",
  CONTRACT_TRANSFER: "contract.transfer",
  CUSTOMER_FACE_ENROLL: "customer.face_enroll",
  CONTRACT_EXPIRY_ADJUST: "contract.expiry_adjust",
  CONTRACT_HISTORY_READ: "contract.history.read",
  INVENTORY_READ: "inventory.read",
  INVENTORY_IMPORT: "inventory.import",
  KPI_MANAGE: "kpi.manage",
  KPI_READ_ALL: "kpi.read_all",
  LEAD_CREATE: "lead.create",
  LEAD_READ: "lead.read",
  LEAD_READ_ALL: "lead.read_all",
  LEAD_UPDATE: "lead.update",
  LEAD_CONVERT: "lead.convert",
  LEAD_DELETE: "lead.delete",
  NOTIFICATION_BROADCAST: "notification.broadcast",
  PACKAGE_MANAGE: "package.manage",
  PAYMENT_CONFIRM: "payment.confirm",
  PAYMENT_CANCEL: "payment.cancel",
  POS_READ_ALL: "pos.read_all",
  PRODUCT_MANAGE: "product.manage",
  PT_DISPUTE: "pt.dispute",
  REPORT_READ_ALL: "report.read_all",
  SETTINGS_SENSITIVE_READ: "settings.sensitive.read",
  SETTINGS_READ: "settings.read",
  SETTINGS_UPDATE: "settings.update",
  STAFF_SCHEDULE: "staff.schedule",
  STAFF_CREATE: "staff.create",
  STAFF_UPDATE: "staff.update",
  STAFF_DELETE: "staff.delete",
  TEAM_TASK_READ: "team_task.read",
  TEAM_TASK_MANAGE: "team_task.manage",
  TEAM_TASK_COMPLETE: "team_task.complete",
  NOTIFICATION_READ: "notification.read",
  WORKOUT_DEDUCT: "workout.deduct",
  WORKOUT_DELETE: "workout.delete",
  WORKOUT_READ_ALL: "workout.read_all",
});

const AUTHORIZATION_POLICY_VERSION = 3;

const managerPermissions = [
  PERMISSIONS.AUDIT_READ,
  PERMISSIONS.BRANCH_TRANSFER_CREATE,
  PERMISSIONS.BRANCH_TRANSFER_READ,
  PERMISSIONS.CHECKIN_USE,
  PERMISSIONS.CLOSURE_MANAGE,
  PERMISSIONS.COMMISSION_READ,
  PERMISSIONS.COMMISSION_READ_ALL,
  PERMISSIONS.CUSTOMER_READ,
  PERMISSIONS.CUSTOMER_CHECK_EXISTING,
  PERMISSIONS.CUSTOMER_EXPORT,
  PERMISSIONS.CONTRACT_MANAGE,
  PERMISSIONS.CONTRACT_TRANSFER,
  PERMISSIONS.CUSTOMER_FACE_ENROLL,
  PERMISSIONS.CONTRACT_HISTORY_READ,
  PERMISSIONS.INVENTORY_READ,
  PERMISSIONS.INVENTORY_IMPORT,
  PERMISSIONS.KPI_MANAGE,
  PERMISSIONS.KPI_READ_ALL,
  PERMISSIONS.LEAD_CREATE,
  PERMISSIONS.LEAD_READ,
  PERMISSIONS.LEAD_READ_ALL,
  PERMISSIONS.LEAD_UPDATE,
  PERMISSIONS.LEAD_CONVERT,
  PERMISSIONS.LEAD_DELETE,
  PERMISSIONS.NOTIFICATION_BROADCAST,
  PERMISSIONS.PACKAGE_MANAGE,
  PERMISSIONS.PAYMENT_CONFIRM,
  PERMISSIONS.PAYMENT_CANCEL,
  PERMISSIONS.POS_READ_ALL,
  PERMISSIONS.PRODUCT_MANAGE,
  PERMISSIONS.REPORT_READ_ALL,
  PERMISSIONS.STAFF_SCHEDULE,
  PERMISSIONS.STAFF_UPDATE,
  PERMISSIONS.TEAM_TASK_READ,
  PERMISSIONS.TEAM_TASK_MANAGE,
  PERMISSIONS.TEAM_TASK_COMPLETE,
  PERMISSIONS.NOTIFICATION_READ,
  PERMISSIONS.WORKOUT_DEDUCT,
  PERMISSIONS.WORKOUT_READ_ALL,
];

const ROLE_PERMISSIONS = Object.freeze({
  admin: ["*"],
  manager: managerPermissions,
  sm: managerPermissions,
  pm: managerPermissions,
  om: managerPermissions,
  accountant: [
    PERMISSIONS.COMMISSION_READ,
    PERMISSIONS.COMMISSION_READ_ALL,
    PERMISSIONS.COMMISSION_MANAGE,
    PERMISSIONS.CUSTOMER_EXPORT,
    PERMISSIONS.CONTRACT_HISTORY_READ,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INVENTORY_IMPORT,
    PERMISSIONS.KPI_READ_ALL,
    PERMISSIONS.LEAD_CREATE,
    PERMISSIONS.LEAD_READ,
    PERMISSIONS.LEAD_READ_ALL,
    PERMISSIONS.LEAD_UPDATE,
    PERMISSIONS.LEAD_CONVERT,
    PERMISSIONS.LEAD_DELETE,
    PERMISSIONS.NOTIFICATION_BROADCAST,
    PERMISSIONS.PAYMENT_CONFIRM,
    PERMISSIONS.PAYMENT_CANCEL,
    PERMISSIONS.POS_READ_ALL,
    PERMISSIONS.REPORT_READ_ALL,
    PERMISSIONS.SETTINGS_READ,
    PERMISSIONS.STAFF_SCHEDULE,
    PERMISSIONS.TEAM_TASK_READ,
    PERMISSIONS.TEAM_TASK_MANAGE,
    PERMISSIONS.TEAM_TASK_COMPLETE,
    PERMISSIONS.NOTIFICATION_READ,
    PERMISSIONS.WORKOUT_READ_ALL,
  ],
  staff: [
    PERMISSIONS.CHECKIN_USE,
    PERMISSIONS.CUSTOMER_READ,
    PERMISSIONS.CUSTOMER_EXPORT,
    PERMISSIONS.LEAD_CREATE,
    PERMISSIONS.LEAD_READ,
    PERMISSIONS.LEAD_UPDATE,
    PERMISSIONS.LEAD_CONVERT,
    PERMISSIONS.CONTRACT_MANAGE,
    PERMISSIONS.NOTIFICATION_READ,
  ],
  sale: [
    PERMISSIONS.CHECKIN_USE,
    PERMISSIONS.COMMISSION_READ,
    PERMISSIONS.CUSTOMER_READ,
    PERMISSIONS.CUSTOMER_CHECK_EXISTING,
    PERMISSIONS.CUSTOMER_EXPORT,
    PERMISSIONS.LEAD_CREATE,
    PERMISSIONS.LEAD_READ,
    PERMISSIONS.LEAD_UPDATE,
    PERMISSIONS.LEAD_CONVERT,
    PERMISSIONS.CONTRACT_MANAGE,
    PERMISSIONS.STAFF_SCHEDULE,
    PERMISSIONS.TEAM_TASK_READ,
    PERMISSIONS.TEAM_TASK_COMPLETE,
    PERMISSIONS.NOTIFICATION_READ,
  ],
  pt: [
    PERMISSIONS.CHECKIN_USE,
    PERMISSIONS.COMMISSION_READ,
    PERMISSIONS.CUSTOMER_READ,
    PERMISSIONS.CUSTOMER_EXPORT,
    PERMISSIONS.PT_DISPUTE,
    PERMISSIONS.STAFF_SCHEDULE,
    PERMISSIONS.TEAM_TASK_READ,
    PERMISSIONS.TEAM_TASK_COMPLETE,
    PERMISSIONS.NOTIFICATION_READ,
  ],
  reception: [
    PERMISSIONS.BRANCH_TRANSFER_CREATE,
    PERMISSIONS.CHECKIN_USE,
    PERMISSIONS.CUSTOMER_READ,
    PERMISSIONS.CUSTOMER_CHECK_EXISTING,
    PERMISSIONS.CUSTOMER_EXPORT,
    PERMISSIONS.CONTRACT_MANAGE,
    PERMISSIONS.CUSTOMER_FACE_ENROLL,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INVENTORY_IMPORT,
    PERMISSIONS.PAYMENT_CONFIRM,
    PERMISSIONS.PAYMENT_CANCEL,
    PERMISSIONS.POS_READ_ALL,
    PERMISSIONS.STAFF_SCHEDULE,
    PERMISSIONS.WORKOUT_DEDUCT,
    PERMISSIONS.TEAM_TASK_READ,
    PERMISSIONS.TEAM_TASK_COMPLETE,
    PERMISSIONS.NOTIFICATION_READ,
  ],
});

const hasPermission = (role, permission) => {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes("*") || permissions.includes(permission);
};

const resolvePermissionsForRole = async (role, Setting) => {
  const defaults = ROLE_PERMISSIONS[role] || [];
  if (defaults.includes("*") || !Setting) return defaults;

  const setting = await Setting.findOne()
    .select("rolePermissions rolePermissionsVersion")
    .lean();
  const configured = setting?.rolePermissions?.[role];

  // Existing installations store legacy UI permissions such as
  // `view_dashboard`. Only opt into backend enforcement after a role has been
  // saved with the new namespaced permission format.
  if (
    Array.isArray(configured) &&
    configured.some((permission) => typeof permission === "string" && permission.includes("."))
  ) {
    if ((setting.rolePermissionsVersion || 1) >= AUTHORIZATION_POLICY_VERSION) {
      return configured;
    }
    // Ma trận namespaced đã lưu trước khi policy hiện tại ra đời
    // không biết các permission mới. Giữ override cũ và bổ sung
    // default hiện hành cho đến khi admin lưu lại ma trận version hiện tại.
    return [...new Set([...defaults, ...configured])];
  }

  return defaults;
};

const resolvePermissions = async (req) => {
  const role = req.user?.role;
  return resolvePermissionsForRole(role, req.models?.Setting);
};

const requirePermission = (...requiredPermissions) => async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      code: "AUTHENTICATION_REQUIRED",
      message: "Chưa xác thực danh tính",
    });
  }

  let permissions;
  try {
    permissions = await resolvePermissions(req);
  } catch (error) {
    return next(error);
  }

  const missingPermissions = requiredPermissions.filter((permission) =>
    !permissions.includes("*") && !permissions.includes(permission)
  );

  if (missingPermissions.length > 0) {
    return res.status(403).json({
      code: "PERMISSION_DENIED",
      message: "Tài khoản không có quyền thực hiện thao tác này",
      requiredPermissions: missingPermissions,
    });
  }

  return next();
};

const requireAnyPermission = (...acceptedPermissions) => async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      code: "AUTHENTICATION_REQUIRED",
      message: "Chưa xác thực danh tính",
    });
  }
  try {
    const permissions = await resolvePermissions(req);
    if (
      permissions.includes("*") ||
      acceptedPermissions.some((permission) => permissions.includes(permission))
    ) {
      return next();
    }
    return res.status(403).json({
      code: "PERMISSION_DENIED",
      message: "Tài khoản không có quyền thực hiện thao tác này",
      acceptedPermissions,
    });
  } catch (error) {
    return next(error);
  }
};

const userHasPermission = async (req, permission) => {
  const permissions = await resolvePermissions(req);
  return permissions.includes("*") || permissions.includes(permission);
};

const requireSelfOrPermission = (paramName, permission) => async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      code: "AUTHENTICATION_REQUIRED",
      message: "Chưa xác thực danh tính",
    });
  }
  if (String(req.user._id) === String(req.params[paramName])) return next();
  try {
    if (await userHasPermission(req, permission)) return next();
    return res.status(403).json({
      code: "OBJECT_ACCESS_DENIED",
      message: "Bạn không có quyền truy cập đối tượng này",
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  PERMISSIONS,
  AUTHORIZATION_POLICY_VERSION,
  ROLE_PERMISSIONS,
  hasPermission,
  resolvePermissionsForRole,
  resolvePermissions,
  requirePermission,
  requireAnyPermission,
  userHasPermission,
  requireSelfOrPermission,
};
