const dotenv = require('dotenv');
dotenv.config();
const { MongoClient } = require('mongodb');

async function check() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db();
  
  // Tìm tất cả packages có trainer != null
  const pkgs = await db.collection('customerpackages')
    .find({ trainer: { $exists: true, $ne: null } })
    .project({ trainer: 1, packageName: 1 })
    .toArray();
  
  console.log('=== Packages with trainer set:', pkgs.length, '===');
  pkgs.forEach(p => {
    console.log('  Name:', p.packageName, '| trainer:', JSON.stringify(p.trainer), '| type:', typeof p.trainer);
  });

  const custs = await db.collection('customers')
    .find({ trainer: { $exists: true, $ne: null } })
    .project({ trainer: 1, name: 1, code: 1 })
    .toArray();
  
  console.log('\n=== Customers with trainer set:', custs.length, '===');
  custs.forEach(c => {
    console.log('  Name:', c.name, '(', c.code, ') | trainer:', JSON.stringify(c.trainer), '| type:', typeof c.trainer);
  });

  await client.close();
  console.log('Done.');
}
check().catch(console.error);
