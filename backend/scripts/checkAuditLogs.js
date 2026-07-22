const dotenv = require('dotenv');
dotenv.config();
const { MongoClient } = require('mongodb');

async function check() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db();

  console.log('=== Recent Audit Logs ===');
  const logs = await db.collection('auditlogs')
    .find({})
    .sort({ createdAt: -1 })
    .limit(15)
    .toArray();
  
  logs.forEach(log => {
    console.log(`[${log.createdAt?.toISOString()}] User: ${log.userEmail || log.userId} | Action: ${log.action} | Method: ${log.method} | URL: ${log.url}`);
    if (log.payload) console.log('  Payload:', JSON.stringify(log.payload));
  });

  await client.close();
}
check().catch(console.error);
