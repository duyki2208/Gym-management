const dotenv = require('dotenv');
dotenv.config();
const { MongoClient } = require('mongodb');

async function check() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db();

  console.log('=== All active sale commissions in July 2026 ===');
  const comms = await db.collection('commissions')
    .find({ type: 'sale', month: 7, year: 2026, status: 'active' })
    .toArray();
  
  for (const c of comms) {
    const staff = await db.collection('users').findOne({ _id: c.staff }, { projection: { fullName: 1 } });
    const pkg = await db.collection('customerpackages').findOne({ _id: c.customerPackage }, { projection: { packageName: 1, createdAt: 1 } });
    console.log(`  Staff: ${staff?.fullName} | Package: ${pkg?.packageName} (ID: ${c.customerPackage}) | Amount: ${c.amount} | BaseAmount: ${c.baseAmount} | CreatedAt: ${c.createdAt?.toISOString()} | PkgCreatedAt: ${pkg?.createdAt?.toISOString()}`);
  }

  await client.close();
}
check().catch(console.error);
