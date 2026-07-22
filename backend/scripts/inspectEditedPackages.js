const dotenv = require('dotenv');
dotenv.config();
const { MongoClient, ObjectId } = require('mongodb');

async function check() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db();

  const ids = [
    new ObjectId('6a0dd333448127f91b733e26'),
    new ObjectId('6a1d4bef00a70112771a488c')
  ];

  console.log('=== Customer Packages ===');
  const pkgs = await db.collection('customerpackages')
    .find({ _id: { $in: ids } })
    .toArray();
  
  for (const pkg of pkgs) {
    console.log(`Package ID: ${pkg._id}`);
    console.log(`  PackageName: ${pkg.packageName}`);
    console.log(`  Price: ${pkg.price} | PaidAmount: ${pkg.paidAmount} | PaymentStatus: ${pkg.paymentStatus}`);
    console.log(`  AssignedStaff: ${pkg.assignedStaff} | Trainer: ${pkg.trainer}`);
    console.log(`  IsDeleted: ${pkg.isDeleted}`);

    // Check associated Transactions
    const txns = await db.collection('transactions')
      .find({ customerPackage: pkg._id })
      .toArray();
    console.log(`  Associated Transactions (${txns.length}):`);
    txns.forEach(t => {
      console.log(`    TXN: ${t.code} | Type: ${t.type} | Amount: ${t.amount} | Status: ${t.status} | Staff: ${t.staff} | CreatedAt: ${t.createdAt?.toISOString()}`);
    });

    // Check associated Commissions
    const comms = await db.collection('commissions')
      .find({ customerPackage: pkg._id })
      .toArray();
    console.log(`  Associated Commissions (${comms.length}):`);
    comms.forEach(c => {
      console.log(`    COMM: ${c._id} | Type: ${c.type} | Amount: ${c.amount} | BaseAmount: ${c.baseAmount} | Staff: ${c.staff} | Status: ${c.status} | CreatedAt: ${c.createdAt?.toISOString()}`);
    });
  }

  await client.close();
}
check().catch(console.error);
