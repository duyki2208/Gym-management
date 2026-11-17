const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { MongoClient, BSON } = require('mongoose').mongo;
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });

const SOURCE = 'gym_management';
const TARGET = 'gympro_branch_hn01';
const UNUSED = 'gympro_branch_taoo';
const CENTRAL = process.env.CENTRAL_DB_NAME || 'gympro_central';
const encode = value => BSON.EJSON.stringify(value, { relaxed: false });
const digest = docs => createHash('sha256').update(docs.map(encode).sort().join('\n')).digest('hex');

async function snapshot(db) {
  const result = {};
  for (const info of await db.listCollections().toArray()) {
    if (info.type !== 'collection' || info.name.startsWith('system.')) {
      throw new Error(`Unsupported collection: ${db.databaseName}.${info.name}`);
    }
    const coll = db.collection(info.name);
    result[info.name] = { options: info.options, indexes: await coll.listIndexes().toArray(),
      docs: await coll.find({}).toArray() };
  }
  return result;
}
function summary(data) {
  return Object.fromEntries(Object.entries(data).sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) =>
    [name, { count: value.docs.length, sha256: digest(value.docs) }]));
}
async function backup(payload) {
  const dir = path.join(__dirname, '../backups', `hn01-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, 'snapshot.ejson');
  await fs.writeFile(file, encode(payload), { flag: 'wx' });
  // Confirm the saved BSON representation round-trips before any database writes.
  const saved = BSON.EJSON.parse(await fs.readFile(file, 'utf8'), { relaxed: false });
  if (JSON.stringify(summary(saved.source)) !== JSON.stringify(summary(payload.source))) {
    throw new Error('Backup verification failed');
  }
  console.log(JSON.stringify({ backup: file }));
  return dir;
}
async function dropEmptyUnused(client) {
  const branches = client.db(CENTRAL).collection('branches');
  if (await branches.findOne({ $or: [{ code: /^taoo$/i }, { dbName: UNUSED }] })) {
    throw new Error('TAOO is registered; refusing to delete');
  }
  const db = client.db(UNUSED);
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  for (const { name } of collections) {
    if (await db.collection(name).findOne({})) throw new Error(`TAOO is not empty: ${name}`);
  }
  if (collections.length) await db.dropDatabase();
  console.log(JSON.stringify({ deletedUnusedDatabase: UNUSED, wasAlreadyAbsent: !collections.length }));
}
async function migrate(client, apply, { backendStopped = false } = {}) {
  const branches = client.db(CENTRAL).collection('branches');
  const branch = await branches.findOne({ code: 'HN01' });
  if (!branch || !branch.isActive || ![SOURCE, TARGET].includes(branch.dbName)) {
    throw new Error('Unexpected HN01 registration; refusing migration');
  }
  if (await branches.findOne({ code: { $ne: 'HN01' }, dbName: { $in: [SOURCE, TARGET] } })) {
    throw new Error('Another branch references the source or target database');
  }
  const sourceDb = client.db(SOURCE), targetDb = client.db(TARGET);
  const source = await snapshot(sourceDb), target = await snapshot(targetDb);
  console.log(JSON.stringify({ mapping: branch.dbName, source: summary(source), target: summary(target) }));
  if (branch.dbName === TARGET) {
    console.log('HN01 already migrated; no changes applied.');
    return;
  }
  if (!source.customers?.docs.length || !source.users?.docs.length) throw new Error('Source data missing');
  for (const [name, value] of Object.entries(target)) {
    if (!['users', 'settings', 'counters', 'auditlogs'].includes(name) && value.docs.length) {
      throw new Error(`Target contains business data: ${name}; manual merge required`);
    }
  }
  if (!apply) { console.log('Dry run only. Stop all backends, then use --apply --backend-stopped.'); return; }
  if (!backendStopped) throw new Error('Confirm backend shutdown with --backend-stopped');
  const hello = await client.db('admin').command({ hello: 1 });
  if (!hello.setName && hello.msg !== 'isdbgrid') throw new Error('Atomic migration requires replica set or mongos');
  const backupDir = await backup({ createdAt: new Date(), branch, source, target });
  // Create missing collections before the transaction; leave all existing data intact here.
  for (const [name, value] of Object.entries(source)) {
    if (!target[name]) await targetDb.createCollection(name, value.options);
  }
  // Validate required indexes before changing data or branch mapping.
  for (const [name, value] of Object.entries(source)) {
    for (const index of value.indexes) {
      if (index.name === '_id_') continue;
      const { key, v, ns, ...options } = index;
      try {
        await targetDb.collection(name).createIndex(key, options);
      } catch (error) {
        if (![85, 86].includes(error.code)) throw error;
        // The stale target schema may have the same index name with different
        // uniqueness/options. Its original indexes are included in the backup.
        const existing = await targetDb.collection(name).listIndexes().toArray();
        if (!existing.some(index => index.name === options.name)) throw error;
        await targetDb.collection(name).dropIndex(options.name);
        await targetDb.collection(name).createIndex(key, options);
      }
    }
  }
  const before = JSON.stringify(summary(source));
  if (JSON.stringify(summary(await snapshot(sourceDb))) !== before) throw new Error('Source changed during backup');
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      // Verify the snapshot inside the same transaction as the copy and mapping update.
      for (const [name, value] of Object.entries(source)) {
        const docs = await sourceDb.collection(name).find({}, { session }).toArray();
        if (digest(docs) !== digest(value.docs)) throw new Error(`Source changed: ${name}`);
      }
      for (const name of new Set([...Object.keys(source), ...Object.keys(target)])) {
        const coll = targetDb.collection(name);
        await coll.deleteMany({}, { session });
        const docs = source[name]?.docs || [];
        if (docs.length) await coll.insertMany(docs, { session });
      }
      for (const [name, value] of Object.entries(source)) {
        const docs = await targetDb.collection(name).find({}, { session }).toArray();
        if (digest(docs) !== digest(value.docs)) throw new Error(`Copy verification failed: ${name}`);
      }
      const changed = await branches.updateOne({ _id: branch._id, dbName: SOURCE },
        { $set: { dbName: TARGET, updatedAt: new Date() } }, { session });
      if (changed.modifiedCount !== 1) throw new Error('Branch mapping changed concurrently');
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, maxCommitTimeMS: 30000 });
  } finally { await session.endSession(); }
  const verified = summary(await snapshot(targetDb));
  for (const [name, value] of Object.entries(summary(source))) {
    if (JSON.stringify(verified[name]) !== JSON.stringify(value)) throw new Error(`Post-copy verification failed: ${name}`);
  }
  if (JSON.stringify(summary(await snapshot(sourceDb))) !== before) {
    throw new Error('Source changed during migration; keep backend stopped and reconcile before use');
  }
  await fs.writeFile(path.join(backupDir, 'verification.json'), JSON.stringify({ mapping: TARGET, collections: verified }, null, 2));
  console.log(JSON.stringify({ migrated: true, mapping: TARGET, verified, legacyDatabasePreserved: true }));
}
async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required');
  const client = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    await client.connect();
    if (process.argv.includes('--drop-empty-taoo')) await dropEmptyUnused(client);
    else await migrate(client, process.argv.includes('--apply'), { backendStopped: process.argv.includes('--backend-stopped') });
  } finally { await client.close(); }
}
if (require.main === module) main().catch(error => {
  console.error(JSON.stringify({ error: error.name, message: error.message.replace(/mongodb(?:\+srv)?:\/\/\S+/g, '[redacted URI]') }));
  process.exitCode = 1;
});
module.exports = { main, migrate, digest, summary, dropEmptyUnused };
