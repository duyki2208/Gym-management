const dotenv = require('dotenv');
dotenv.config();
const { MongoClient } = require('mongodb');

async function check() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db();

  console.log('=== Log for 6a0dd333448127f91b733e26 ===');
  const logs = await db.collection('auditlogs')
    .find({ url: { $regex: /6a0dd333448127f91b733e26/i } })
    .toArray();
  
  if (logs.length === 0) {
    // try action field
    const logsByAction = await db.collection('auditlogs')
      .find({ action: { $regex: /6a0dd333448127f91b733e26/i } })
      .toArray();
    logsByAction.forEach(l => {
      console.log('Action:', l.action);
      console.log('Details:', JSON.stringify(l.details, null, 2));
    });
  } else {
    logs.forEach(l => {
      console.log('URL:', l.url);
      console.log('Details:', JSON.stringify(l.details, null, 2));
    });
  }

  await client.close();
}
check().catch(console.error);
