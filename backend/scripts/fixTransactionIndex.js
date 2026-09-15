const dotenv = require('dotenv');
dotenv.config();
const { MongoClient } = require('mongodb');

async function main() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();

  const adminDb = client.db().admin();
  const dbs = await adminDb.listDatabases();
  console.log('All Databases:', dbs.databases.map(d => d.name));

  // Find all DBs that might have transactions collection
  for (const dbInfo of dbs.databases) {
    const dbName = dbInfo.name;
    if (['admin', 'local', 'config'].includes(dbName)) continue;

    const db = client.db(dbName);
    const collections = await db.listCollections().toArray();
    const hasTransactions = collections.some(c => c.name === 'transactions');
    if (hasTransactions) {
      console.log(`\nChecking DB: ${dbName} ...`);
      const coll = db.collection('transactions');
      const indexes = await coll.indexes();
      console.log(`Current indexes on ${dbName}.transactions:`, indexes.map(i => i.name));

      const problematicIndex = indexes.find(i => i.name === 'saleOrder_1_paymentPhase_1');
      if (problematicIndex) {
        console.log(`Dropping index saleOrder_1_paymentPhase_1 in ${dbName}...`);
        await coll.dropIndex('saleOrder_1_paymentPhase_1');
        console.log(`Dropped index saleOrder_1_paymentPhase_1 in ${dbName}.`);

        console.log(`Recreating saleOrder_1_paymentPhase_1 with partialFilterExpression in ${dbName}...`);
        await coll.createIndex(
          { saleOrder: 1, paymentPhase: 1 },
          {
            name: 'saleOrder_1_paymentPhase_1',
            unique: true,
            partialFilterExpression: { saleOrder: { $type: 'objectId' } }
          }
        );
        console.log(`Recreated index with partialFilterExpression in ${dbName}.`);
      } else {
        console.log(`saleOrder_1_paymentPhase_1 not found in ${dbName}. Creating with partialFilterExpression...`);
        await coll.createIndex(
          { saleOrder: 1, paymentPhase: 1 },
          {
            name: 'saleOrder_1_paymentPhase_1',
            unique: true,
            partialFilterExpression: { saleOrder: { $type: 'objectId' } }
          }
        );
        console.log(`Created index in ${dbName}.`);
      }
    }
  }

  await client.close();
  console.log('\nDone fixing indexes!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
