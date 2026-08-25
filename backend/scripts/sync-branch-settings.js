const dotenv = require("dotenv");
dotenv.config();

const { getBranchModels, getCentralModels } = require("../db/branchConnectionManager");

const sync = async () => {
  const central = await getCentralModels();
  const branches = await central.Branch.find({});

  for (const b of branches) {
    const models = await getBranchModels(b.code);
    await models.Setting.findOneAndUpdate(
      {},
      { $set: { gymName: b.name, address: b.address } },
      { upsert: true }
    );
    console.log(`Synced Setting for branch ${b.code}: ${b.name} - ${b.address}`);
  }
  process.exit(0);
};

sync();
