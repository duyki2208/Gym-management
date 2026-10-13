const {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  hasPermission,
  requirePermission,
  requireAnyPermission,
  resolvePermissions,
} = require("../middleware/permissions");

const createResponse = () => ({
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

describe("Permission policy", () => {
  test("all role mappings reference declared permissions", () => {
    const declared = new Set(Object.values(PERMISSIONS));
    for (const permissions of Object.values(ROLE_PERMISSIONS)) {
      for (const permission of permissions) {
        expect(permission === "*" || declared.has(permission)).toBe(true);
      }
    }
  });

  test("admin wildcard grants every declared permission", () => {
    for (const permission of Object.values(PERMISSIONS)) {
      expect(hasPermission("admin", permission)).toBe(true);
    }
  });

  test("reception can import inventory but cannot broadcast notifications", () => {
    expect(hasPermission("reception", PERMISSIONS.INVENTORY_IMPORT)).toBe(true);
    expect(hasPermission("reception", PERMISSIONS.NOTIFICATION_BROADCAST)).toBe(false);
  });

  test("legacy rolePermissions fall back to the safe server policy", async () => {
    const req = {
      user: { role: "reception" },
      models: {
        Setting: {
          findOne: () => ({
            select: () => ({
              lean: async () => ({ rolePermissions: { reception: ["pos_sell"] } }),
            }),
          }),
        },
      },
    };

    await expect(resolvePermissions(req)).resolves.toContain(PERMISSIONS.INVENTORY_IMPORT);
  });

  test("namespaced branch configuration is enforced as an override", async () => {
    const req = {
      user: { role: "reception" },
      models: {
        Setting: {
          findOne: () => ({
            select: () => ({
              lean: async () => ({
                rolePermissionsVersion: 3,
                rolePermissions: { reception: [PERMISSIONS.CHECKIN_USE] },
              }),
            }),
          }),
        },
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await requirePermission(PERMISSIONS.INVENTORY_IMPORT)(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({
      code: "PERMISSION_DENIED",
      requiredPermissions: [PERMISSIONS.INVENTORY_IMPORT],
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("pre-versioned namespaced configuration inherits newly introduced defaults", async () => {
    const req = {
      user: { role: "sale" },
      models: {
        Setting: {
          findOne: () => ({
            select: () => ({
              lean: async () => ({
                rolePermissions: { sale: [PERMISSIONS.CUSTOMER_READ] },
              }),
            }),
          }),
        },
      },
    };

    await expect(resolvePermissions(req)).resolves.toEqual(
      expect.arrayContaining([
        PERMISSIONS.CUSTOMER_READ,
        PERMISSIONS.LEAD_READ,
        PERMISSIONS.COMMISSION_READ,
      ])
    );
  });

  test("any-permission middleware accepts completion without management", async () => {
    const req = {
      user: { role: "sale" },
      models: {
        Setting: {
          findOne: () => ({
            select: () => ({ lean: async () => null }),
          }),
        },
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await requireAnyPermission(
      PERMISSIONS.TEAM_TASK_MANAGE,
      PERMISSIONS.TEAM_TASK_COMPLETE
    )(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
