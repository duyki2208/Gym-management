const dotenv = require('dotenv');
dotenv.config();
const { MongoClient, ObjectId } = require('mongodb');

async function sync() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db();

  console.log('=== Syncing null trainers to assignedStaff for session packages ===');
  
  // Find all PTs/PMs to check roles
  const users = await db.collection('users')
    .find({ role: { $in: ['pt', 'pm'] } })
    .project({ _id: 1 })
    .toArray();
  const ptIds = new Set(users.map(u => u._id.toString()));

  // Find all packages to know which ones are type "session"
  const packageDefinitions = await db.collection('packages')
    .find({ type: 'session' })
    .project({ name: 1 })
    .toArray();
  const sessionPackageNames = new Set(packageDefinitions.map(p => p.name));

  // Also manually add "12 buổi " if it was a session package (not found in packages def but might be session)
  sessionPackageNames.add("12 buổi ");
  sessionPackageNames.add("1000b family");
  sessionPackageNames.add("12 Session");

  console.log('Session package names:', Array.from(sessionPackageNames));

  // Find all customer packages
  const pkgs = await db.collection('customerpackages')
    .find({ 
      status: 'active', 
      isDeleted: { $ne: true },
      packageName: { $in: Array.from(sessionPackageNames) }
    })
    .toArray();

  let syncedCount = 0;
  for (const pkg of pkgs) {
    if (!pkg.trainer && pkg.assignedStaff && ptIds.has(pkg.assignedStaff.toString())) {
      console.log(`  Syncing Package: ${pkg._id} (${pkg.packageName}) | Staff: ${pkg.assignedStaff} → Set Trainer`);
      
      // Update CustomerPackage
      await db.collection('customerpackages').updateOne(
        { _id: pkg._id },
        { $set: { trainer: pkg.assignedStaff } }
      );

      // Update Customer
      await db.collection('customers').updateOne(
        { _id: pkg.customer },
        { $set: { trainer: pkg.assignedStaff } }
      );
      
      syncedCount++;
    }
  }

  console.log(`\nSuccessfully synced ${syncedCount} packages.`);
  await client.close();
}
sync().catch(console.error);
