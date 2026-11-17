const manager = require('../db/branchConnectionManager');
const { dropEmptyUnused } = require('../scripts/migrate-hn01-database');
let central;
beforeAll(async () => { central = await manager.getCentralModels(); });
afterEach(async () => {
  await central.Branch.deleteMany({ code: { $in: ['TEST01', 'TEST02'] } });
});
test('unknown branch cannot create an arbitrary database', async () => {
  await expect(manager.getBranchModels('TAOO')).rejects.toMatchObject({ code: 'BRANCH_ACCESS_DENIED' });
  const dbs = await central.connection.db.admin().listDatabases();
  expect(dbs.databases.some(db => db.name === 'gympro_branch_taoo')).toBe(false);
});
test('legacy mapping is rejected', async () => {
  await central.Branch.create({ code: 'TEST01', name: 'Legacy', dbName: 'gym_management' });
  await expect(manager.getBranchModels('TEST01')).rejects.toMatchObject({ code: 'BRANCH_DATABASE_NOT_MIGRATED' });
});
test('shared databases are rejected', async () => {
  await central.Branch.create([{ code: 'TEST01', name: 'One', dbName: 'shared_test' }, { code: 'TEST02', name: 'Two', dbName: 'shared_test' }]);
  await expect(manager.getBranchModels('TEST01')).rejects.toMatchObject({ code: 'BRANCH_DATABASE_SHARED' });
});
test('cached model follows remapping and rejects deactivated branches', async () => {
  await central.Branch.create({ code: 'TEST01', name: 'One', dbName: 'old_test' });
  const old = await manager.getBranchModels('TEST01');
  await Promise.all(Object.values(old).filter(v => typeof v?.init === 'function').map(m => m.init()));
  await central.Branch.updateOne({ code: 'TEST01' }, { $set: { dbName: 'new_test' } });
  const fresh = await manager.getBranchModels('TEST01', true);
  await Promise.all(Object.values(fresh).filter(v => typeof v?.init === 'function').map(m => m.init()));
  expect(fresh.Customer.db.name).toBe('new_test');
  expect(fresh.Customer.db.name).not.toBe(old.Customer.db.name);
  await central.Branch.updateOne({ code: 'TEST01' }, { $set: { isActive: false } });
  await expect(manager.getBranchModels('TEST01')).rejects.toMatchObject({ code: 'BRANCH_ACCESS_DENIED' });
});
test('HN01 models use the dedicated database', async () => {
  const models = await manager.getBranchModels('HN01');
  for (const name of ['Customer', 'CheckIn', 'Package']) expect(models[name].db.name).toBe('gympro_branch_hn01');
  await Promise.all(Object.values(models).filter(v => typeof v?.init === 'function').map(m => m.init()));
});
test('TAOO deletion refuses registered or nonempty databases', async () => {
  const dropDatabase = jest.fn();
  let registered = true;
  const client = { db: name => name === 'gympro_branch_taoo' ? {
    listCollections: () => ({ toArray: async () => [{ name: 'customers' }] }),
    collection: () => ({ findOne: async () => ({ _id: 1 }) }), dropDatabase,
  } : { collection: () => ({ findOne: async () => registered ? { code: 'TAOO' } : null }) } };
  await expect(dropEmptyUnused(client)).rejects.toThrow('registered');
  registered = false;
  await expect(dropEmptyUnused(client)).rejects.toThrow('not empty');
  expect(dropDatabase).not.toHaveBeenCalled();
});
