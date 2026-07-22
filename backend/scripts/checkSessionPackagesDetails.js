const dotenv = require('dotenv');
dotenv.config();
const { MongoClient } = require('mongodb');

async function check() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db();

  console.log('=== Checking Session Packages Staff and Trainer ===');
  // Find all active packages where package name matches "12 Session" or "1000b family" or is a session package
  const pkgs = await db.collection('customerpackages').find({ status: 'active', isDeleted: { $ne: true } }).toArray();
  
  for (const pkg of pkgs) {
    const def = await db.collection('packages').findOne({ name: pkg.packageName });
    if (def && def.type === 'session') {
      const staff = await db.collection('users').findOne({ _id: pkg.assignedStaff });
      const trainer = await db.collection('users').findOne({ _id: pkg.trainer });
      console.log(`\nPackage ID: ${pkg._id}`);
      console.log(`  PackageName: "${pkg.packageName}"`);
      console.log(`  AssignedStaff: ${staff ? `${staff.fullName} (${staff.role})` : 'null'}`);
      console.log(`  Trainer (PT phụ trách): ${trainer ? `${trainer.fullName} (${trainer.role})` : 'null'}`);
    }
  }

  await client.close();
}
check().catch(console.error);
