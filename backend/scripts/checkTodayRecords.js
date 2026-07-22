const dotenv = require('dotenv');
dotenv.config();
const { MongoClient } = require('mongodb');

async function check() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db();

  const todayStart = new Date('2026-07-21T00:00:00.000Z');

  console.log('=== Transactions created today ===');
  const txns = await db.collection('transactions')
    .find({ createdAt: { $gte: todayStart } })
    .toArray();
  txns.forEach(t => {
    console.log(`  TXN: ${t.code} | Type: ${t.type} | Amount: ${t.amount} | Package: ${t.customerPackage} | Staff: ${t.staff} | CreatedAt: ${t.createdAt?.toISOString()}`);
  });

  console.log('\n=== Commissions created today ===');
  const comms = await db.collection('commissions')
    .find({ createdAt: { $gte: todayStart } })
    .toArray();
  comms.forEach(c => {
    console.log(`  COMM: ${c._id} | Type: ${c.type} | Amount: ${c.amount} | BaseAmount: ${c.baseAmount} | Package: ${c.customerPackage} | Staff: ${c.staff} | CreatedAt: ${c.createdAt?.toISOString()}`);
  });

  await client.close();
}
check().catch(console.error);
