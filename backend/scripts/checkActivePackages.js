const dotenv = require('dotenv');
dotenv.config();
const { MongoClient } = require('mongodb');

async function check() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db();

  console.log('=== Checking Active Packages ===');
  const pkgs = await db.collection('customerpackages')
    .find({ status: 'active', isDeleted: { $ne: true } })
    .toArray();
  
  console.log(`Found ${pkgs.length} active customer packages.`);

  for (const pkg of pkgs) {
    // Find the definition of this package in 'packages' collection
    const def = await db.collection('packages').findOne({ name: pkg.packageName });
    console.log(`\nCustomerPackage: ${pkg._id}`);
    console.log(`  PackageName: "${pkg.packageName}"`);
    console.log(`  Trainer: ${pkg.trainer} (type: ${typeof pkg.trainer})`);
    console.log(`  Package Definition in DB:`, def ? `type: ${def.type}, sessions: ${def.sessions}` : 'NOT FOUND');
  }

  await client.close();
}
check().catch(console.error);
