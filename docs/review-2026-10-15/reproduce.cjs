// Review probes: assert observed bugs, NOT regression expectations for correct behavior.
// Run: node docs/review-2026-10-15/reproduce.cjs
// Uses a disposable MongoDB only. Does not load .env or send notifications.
const { createRequire } = require('node:module');
const path = require('node:path');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const r = createRequire(path.resolve(__dirname, '../../backend/package.json'));
const mongoose = r('mongoose');
const { MongoMemoryServer } = r('mongodb-memory-server');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'review-disposable-access-secret';
process.env.JWT_REFRESH_SECRET = 'review-disposable-refresh-secret';
const results = [];
const response = () => ({
  statusCode: 200, body: null, cookies: {},
  status(n) { this.statusCode = n; return this; },
  json(body) { this.body = JSON.parse(JSON.stringify(body)); return this; },
  cookie(name, value) { this.cookies[name] = value; return this; },
});
async function main() {
  const mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
  process.env.MONGO_URI = mongo.getUri('gym_management');
  await mongoose.connect(process.env.MONGO_URI);
  const schemas = r('./models/schemas/branchSchemas');
  const models = { connection: mongoose.connection };
  for (const [key, schema] of Object.entries(schemas)) {
    const name = key.replace(/Schema$/, '');
    const modelName = name[0].toUpperCase() + name.slice(1);
    models[modelName] = mongoose.models[modelName] || mongoose.model(modelName, schema);
  }
  await Promise.all(Object.values(models).filter(m => m.init).map(m => m.init()));
  const manager = r('./db/branchConnectionManager');
  const queue = r('./utils/queueService');
  queue.enqueue = () => 'notifications-disabled-for-review';
  const pos = r('./controllers/posController');
  const workout = r('./controllers/workoutController');
  const closure = r('./controllers/closureController');
  const actor = await models.User.create({ username: 'review', password: 'test-only', role: 'admin' });
  const req = (body = {}, params = {}) => ({ body, params, user: actor, models, branchCode: 'HN01', headers: {} });
  const invoke = async (fn, request) => { const res = response(); await fn(request, res); return res; };
  const probe = async (name, fn) => {
    try { results.push({ name, reproduced: true, evidence: await fn() }); }
    catch (error) { results.push({ name, reproduced: false, error: error.message }); }
  };
  let sequence = 0;
  const fixture = async () => {
    sequence += 1;
    const c = await models.Customer.create({ name: `Review ${sequence}`, code: `R${sequence}`, phone: `09000000${sequence}`, packageType: 'PT', startDate: new Date('2026-01-01'), endDate: new Date('2027-01-01') });
    const p = await models.CustomerPackage.create({ customer: c._id, packageName: 'PT', startDate: c.startDate, endDate: c.endDate, price: 1000, paidAmount: 1000, remainingSessions: 5 });
    c.activePackage = p._id; c.remainingSessions = 5; await c.save();
    return { c, p };
  };
  try {
    await probe('Empty permission override restores defaults', async () => {
      const { resolvePermissionsForRole } = r('./middleware/permissions');
      const permissions = await resolvePermissionsForRole('reception', { findOne: () => ({ select: () => ({ lean: async () => ({ rolePermissionsVersion: 3, rolePermissions: { reception: [] } }) }) }) });
      assert(permissions.includes('payment.confirm'));
      return { configured: [], effectivePermissionCount: permissions.length, paymentConfirm: true };
    });
    await probe('Negative checkout quantity increases stock', async () => {
      const p = await models.Product.create({ name: 'Negative quantity', stockQuantity: 10, sellPrice: 100 });
      const res = await invoke(pos.createCheckout, req({ paymentMethod: 'Chuyển khoản QR', details: [{ product: p._id, quantity: -2 }] }));
      const after = await models.Product.findById(p._id);
      assert.equal(res.statusCode, 201); assert.equal(after.stockQuantity, 12);
      return { status: res.statusCode, stockBefore: 10, stockAfter: after.stockQuantity, totalAmount: res.body.saleOrder.totalAmount };
    });
    await probe('Failed standalone checkout leaves stock deducted', async () => {
      const p = await models.Product.create({ name: 'Partial checkout', stockQuantity: 10, sellPrice: 100 });
      const res = await invoke(pos.createCheckout, req({ paymentMethod: 'Chuyển khoản QR', details: [{ product: p._id, quantity: 2 }, { product: new mongoose.Types.ObjectId(), quantity: 1 }] }));
      const after = await models.Product.findById(p._id);
      assert.equal(res.statusCode, 404); assert.equal(after.stockQuantity, 8);
      return { status: res.statusCode, stockBefore: 10, stockAfter: after.stockQuantity };
    });
    await probe('POS uses contract ID and silently creates walk-in order', async () => {
      const { p } = await fixture();
      const product = await models.Product.create({ name: 'Member purchase', stockQuantity: 10, sellPrice: 100 });
      const res = await invoke(pos.createCheckout, req({ customerId: p._id, paymentMethod: 'Chuyển khoản QR', details: [{ product: product._id, quantity: 1 }] }));
      assert.equal(res.statusCode, 201); assert.equal(res.body.saleOrder.isWalkIn, true); assert.equal(res.body.saleOrder.customer, null);
      return { status: res.statusCode, isWalkIn: true, customer: null };
    });
    await probe('Deleting pay-per-session adds a prepaid session', async () => {
      const { c, p } = await fixture();
      const paid = await invoke(workout.deductSession, req({ ptName: 'Review PT', payPerSession: true }, { id: c._id }));
      assert.equal(paid.statusCode, 201);
      const deleted = await invoke(workout.deleteSession, req({}, { id: paid.body.session._id }));
      const after = await models.CustomerPackage.findById(p._id);
      assert.equal(deleted.statusCode, 200); assert.equal(after.remainingSessions, 6);
      return { sessionsBefore: 5, sessionsAfter: after.remainingSessions };
    });
    await probe('Frozen package still permits session deduction', async () => {
      const { c, p } = await fixture(); p.status = 'frozen'; await p.save();
      const res = await invoke(workout.deductSession, req({ ptName: 'Review PT' }, { id: c._id }));
      assert.equal(res.statusCode, 201);
      return { packageStatus: 'frozen', httpStatus: res.statusCode, remainingSessions: (await models.CustomerPackage.findById(p._id)).remainingSessions };
    });
    await probe('Closure projection stale and reversal overwrites later extension', async () => {
      const { c, p } = await fixture();
      const created = await invoke(closure.createClosure, req({ title: 'Review closure', reason: 'Review', startDate: '2026-05-01', endDate: '2026-05-02' }));
      assert.equal(created.statusCode, 201);
      const afterPackage = await models.CustomerPackage.findById(p._id);
      const afterCustomer = await models.Customer.findById(c._id);
      assert.notEqual(afterPackage.endDate.toISOString(), afterCustomer.endDate.toISOString());
      const compensatedEndDate = afterPackage.endDate.toISOString();
      afterPackage.endDate = new Date(afterPackage.endDate.getTime() + 10 * 86400000); await afterPackage.save();
      const reversed = await invoke(closure.reverseClosure, req({}, { id: created.body.data._id }));
      assert.equal(reversed.statusCode, 200);
      const final = await models.CustomerPackage.findById(p._id);
      assert.equal(final.endDate.toISOString(), p.endDate.toISOString());
      return { customerAfterCompensation: afterCustomer.endDate, contractAfterCompensation: compensatedEndDate, laterExtensionDaysLost: 10, contractAfterReversal: final.endDate };
    });
    await probe('Profile edit changes upgrade delta revenue to full price', async () => {
      const { c, p } = await fixture();
      p.contractType = 'upgrade'; p.upgradeDeltaPrice = 200; await p.save();
      const transaction = await models.Transaction.create({ type: 'package_purchase', amount: 200, customer: c._id, customerPackage: p._id, status: 'success', paymentMethod: 'Tiền mặt' });
      await r('./services/customerProfileMutationService').updateCustomerProfile({ models, packageId: p._id, data: { name: 'Changed name only' }, actorId: actor._id });
      const after = await models.Transaction.findById(transaction._id);
      assert.equal(after.amount, 1000);
      return { actualUpgradePayment: 200, transactionAfterNameEdit: after.amount };
    });
    await probe('Profile edit mutates commission in a paid period', async () => {
      const { c, p } = await fixture();
      const now = new Date();
      const commission = await models.Commission.create({ type: 'sale', staff: actor._id, amount: 100, rate: 10, baseAmount: 1000, customerPackage: p._id, customer: c._id, month: now.getMonth() + 1, year: now.getFullYear() });
      await models.CommissionPeriod.create({ type: 'sale', month: now.getMonth() + 1, year: now.getFullYear(), status: 'paid', totalAmount: 100, totalRecords: 1 });
      await r('./services/customerProfileMutationService').updateCustomerProfile({ models, packageId: p._id, data: { price: 2000 }, actorId: actor._id });
      const after = await models.Commission.findById(commission._id);
      assert.equal(after.amount, 200);
      return { periodStatus: 'paid', commissionBefore: 100, commissionAfter: after.amount };
    });
    await probe('Staff update returns password field', async () => {
      const staff = await models.User.create({ username: 'target', password: 'dummy-password-hash', role: 'sale' });
      const res = await invoke(r('./controllers/staffController').update, req({ phone: '0909999999' }, { id: staff._id }));
      assert.equal(res.statusCode, 200); assert.equal(res.body.password, 'dummy-password-hash');
      return { status: res.statusCode, passwordFieldExposed: true };
    });
    const central = await manager.getCentralModels();
    await central.Branch.create({ code: 'HCM01', name: 'Review target', dbName: 'review_target' });
    await probe('Switch branch is undone by refresh token', async () => {
      const auth = r('./controllers/authController');
      const jwt = r('jsonwebtoken');
      const tokens = r('./utils/generateTokens');
      const admin = await central.CentralUser.create({ username: 'central-review', password: 'test', fullName: 'Review', role: 'admin', allowedBranches: ['*'] });
      const refresh = tokens.generateRefreshToken(admin._id, { isCentral: true, activeBranch: 'HN01' });
      await central.CentralSession.create({ userId: admin._id, tokenHash: tokens.hashToken(refresh), expiresAt: new Date(Date.now() + 86400000) });
      const switched = await invoke(auth.switchBranch, { body: { branchCode: 'HCM01' }, user: { ...admin.toObject(), isCentral: true }, centralModels: central });
      assert.equal(switched.statusCode, 200);
      const renewed = await invoke(auth.refreshToken, { cookies: { refreshToken: refresh }, centralModels: central, headers: {} });
      assert.equal(renewed.statusCode, 200);
      const before = jwt.decode(switched.body.token).activeBranch;
      const after = jwt.decode(renewed.body.token).activeBranch;
      assert.equal(before, 'HCM01'); assert.equal(after, 'HN01');
      return { switchedBranch: before, refreshedBranch: after, switchRotatedRefreshCookie: Boolean(switched.cookies.refreshToken) };
    });
    await probe('Branch transfer accepts another customers package', async () => {
      const ownerA = await fixture(); const ownerB = await fixture();
      const res = await invoke(r('./controllers/branchTransferController').transferCustomerBranch, { ...req({ customerId: ownerA.c._id, packageId: ownerB.p._id, targetBranchCode: 'HCM01' }), centralModels: central });
      assert.equal(res.statusCode, 200);
      assert.equal((await models.CustomerPackage.findById(ownerB.p._id)).status, 'transferred');
      const target = await manager.getBranchModels('HCM01');
      const cloned = await target.Customer.findById(res.body.data.targetCustomerId);
      assert.equal(cloned.name, ownerA.c.name);
      return { status: res.statusCode, transferredPackageBelongsTo: 'B', targetCustomerCopiedFrom: 'A' };
    });
  } finally {
    await manager.closeAllConnections(); await mongoose.disconnect(); await mongo.stop();
    fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(results, null, 2) + '\n');
    console.log(JSON.stringify(results, null, 2));
    if (results.some(result => !result.reproduced)) process.exitCode = 1;
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
