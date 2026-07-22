const dotenv = require('dotenv');
dotenv.config();
const { MongoClient } = require('mongodb');

async function check() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db();

  console.log('=== Checking Expiration and Details of 12 Session Packages ===');
  const pkgs = await db.collection('customerpackages')
    .find({ packageName: '12 Session' })
    .toArray();
  
  const now = new Date();
  for (const pkg of pkgs) {
    console.log(`\nPackage ID: ${pkg._id}`);
    console.log(`  status: ${pkg.status} | paymentStatus: ${pkg.paymentStatus}`);
    console.log(`  startDate: ${pkg.startDate?.toISOString()} | endDate: ${pkg.endDate?.toISOString()}`);
    console.log(`  price: ${pkg.price} | paidAmount: ${pkg.paidAmount}`);
    console.log(`  remainingSessions: ${pkg.remainingSessions}`);
    console.log(`  Is Expired by Date? ${pkg.endDate < now ? 'YES' : 'NO'}`);
  }

  await client.close();
}
check().catch(console.error);
