const dotenv = require('dotenv');
dotenv.config();
const { MongoClient, ObjectId } = require('mongodb');

async function fix() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db();

  console.log('=== Cleaning up backdated transactions ===');
  // Tìm các transactions có customerPackage
  const txns = await db.collection('transactions').find({ customerPackage: { $ne: null } }).toArray();
  
  let fixedCount = 0;
  for (const t of txns) {
    const pkg = await db.collection('customerpackages').findOne({ _id: t.customerPackage });
    if (pkg && pkg.createdAt) {
      const diffMs = Math.abs(t.createdAt.getTime() - pkg.createdAt.getTime());
      // Nếu thời gian tạo transaction lệch với thời gian tạo package quá 1 ngày (86400000 ms)
      if (diffMs > 86400000) {
        console.log(`  Fixing Transaction: ${t.code}`);
        console.log(`    Current CreatedAt: ${t.createdAt.toISOString()}`);
        console.log(`    Target CreatedAt (Package): ${pkg.createdAt.toISOString()}`);
        
        await db.collection('transactions').updateOne(
          { _id: t._id },
          { $set: { createdAt: pkg.createdAt, updatedAt: pkg.createdAt } }
        );
        fixedCount++;
      }
    }
  }

  console.log(`\nFixed ${fixedCount} transactions.`);
  await client.close();
}
fix().catch(console.error);
