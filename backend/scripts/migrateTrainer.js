/**
 * Direct migration using native MongoDB driver — bypass Mongoose schema validation
 * Converts trainer String → ObjectId, sets trainer "" → null
 */
const dotenv = require('dotenv');
dotenv.config();
const { MongoClient, ObjectId } = require('mongodb');

async function migrate() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db();

  // Build lookup map: fullName (lowercase trim) → ObjectId
  const users = await db.collection('users').find({}).project({ _id: 1, fullName: 1 }).toArray();
  const nameToId = new Map();
  users.forEach(u => {
    if (u.fullName) nameToId.set(u.fullName.trim().toLowerCase(), u._id);
  });

  console.log('Users found:', users.map(u => `${u.fullName} → ${u._id}`));

  async function migrateCollection(colName) {
    const col = db.collection(colName);
    const docs = await col.find({}).project({ _id: 1, trainer: 1 }).toArray();

    let converted = 0, setNull = 0, skipped = 0;
    for (const doc of docs) {
      const t = doc.trainer;

      // Không có trainer → skip
      if (t === undefined) { skipped++; continue; }

      // Đã là ObjectId → skip
      if (t instanceof ObjectId) { skipped++; continue; }

      // String rỗng → set null
      if (typeof t === 'string' && t.trim() === '') {
        await col.updateOne({ _id: doc._id }, { $set: { trainer: null } });
        setNull++;
        continue;
      }

      // String tên PT → tìm user
      if (typeof t === 'string') {
        const userId = nameToId.get(t.trim().toLowerCase());
        if (userId) {
          await col.updateOne({ _id: doc._id }, { $set: { trainer: userId } });
          console.log(`  ✅ [${colName}] ${doc._id}: "${t}" → ${userId}`);
          converted++;
        } else {
          console.warn(`  ⚠️  [${colName}] ${doc._id}: trainer "${t}" không tìm thấy → set null`);
          await col.updateOne({ _id: doc._id }, { $set: { trainer: null } });
          setNull++;
        }
        continue;
      }

      skipped++;
    }

    console.log(`\n[${colName}] converted=${converted}, setNull=${setNull}, skipped=${skipped}`);
  }

  console.log('\n=== MIGRATING customerpackages ===');
  await migrateCollection('customerpackages');

  console.log('\n=== MIGRATING customers ===');
  await migrateCollection('customers');

  await client.close();
  console.log('\nMigration complete. Connection closed.');
}

migrate().catch(console.error);
