/* eslint-disable no-console */
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { MongoClient, ObjectId } = require("mongodb");
const { EJSON } = require("bson");
const { MongoMemoryServer } = require("mongodb-memory-server");

const checksumCollection = async (collection) => {
  const documents = await collection.find({}).sort({ _id: 1 }).toArray();
  const hash = crypto.createHash("sha256");
  for (const document of documents) {
    hash.update(EJSON.stringify(document, { relaxed: false }));
    hash.update("\n");
  }
  return { count: documents.length, sha256: hash.digest("hex") };
};

const serializableIndex = (index) => {
  const options = {};
  for (const key of [
    "name",
    "unique",
    "sparse",
    "expireAfterSeconds",
    "partialFilterExpression",
    "collation",
  ]) {
    if (index[key] !== undefined) options[key] = index[key];
  }
  return { key: index.key, options };
};

const main = async () => {
  const mongoServer = await MongoMemoryServer.create();
  const client = new MongoClient(mongoServer.getUri());
  const backupDir = await fs.mkdtemp(path.join(os.tmpdir(), "gympro-restore-drill-"));
  const sourceDbName = "gympro_drill_source";
  const restoreDbName = "gympro_drill_restore";
  const startedAt = Date.now();

  try {
    await client.connect();
    const source = client.db(sourceDbName);
    const now = new Date();
    const customerIds = Array.from({ length: 200 }, () => new ObjectId());

    await source.collection("customers").insertMany(
      customerIds.map((id, index) => ({
        _id: id,
        code: `DRILL-${String(index).padStart(4, "0")}`,
        name: `Restore Drill Customer ${index}`,
        phone: `08${String(index).padStart(8, "0")}`,
        endDate: new Date(now.getTime() + index * 86400000),
        faceEmbedding: index % 10 === 0 ? [0.1, 0.2, 0.3] : [],
      }))
    );
    await source.collection("customers").createIndex({ code: 1 }, { unique: true });
    await source.collection("customers").createIndex({ phone: 1 });

    await source.collection("transactions").insertMany(
      Array.from({ length: 500 }, (_, index) => ({
        _id: new ObjectId(),
        code: `DRILL-TXN-${String(index).padStart(5, "0")}`,
        customer: customerIds[index % customerIds.length],
        amount: 100000 + index,
        status: "success",
        createdAt: new Date(now.getTime() - index * 1000),
      }))
    );
    await source.collection("transactions").createIndex({ code: 1 }, { unique: true });
    await source.collection("transactions").createIndex({ createdAt: -1, status: 1 });

    await source.collection("sessions").insertMany(
      Array.from({ length: 25 }, (_, index) => ({
        _id: new ObjectId(),
        userId: new ObjectId(),
        tokenHash: crypto.createHash("sha256").update(`session-${index}`).digest("hex"),
        expiresAt: new Date(now.getTime() + 86400000),
      }))
    );
    await source.collection("sessions").createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0 }
    );

    const collectionNames = (await source.listCollections({}, { nameOnly: true }).toArray())
      .map((item) => item.name)
      .sort();
    const manifest = { sourceDbName, createdAt: new Date().toISOString(), collections: [] };
    const backupStartedAt = Date.now();

    for (const name of collectionNames) {
      const collection = source.collection(name);
      const documents = await collection.find({}).sort({ _id: 1 }).toArray();
      const indexes = (await collection.listIndexes().toArray())
        .filter((index) => index.name !== "_id_")
        .map(serializableIndex);
      await fs.writeFile(
        path.join(backupDir, `${name}.ejson`),
        documents.map((document) => EJSON.stringify(document, { relaxed: false })).join("\n"),
        "utf8"
      );
      const integrity = await checksumCollection(collection);
      manifest.collections.push({ name, indexes, ...integrity });
    }
    await fs.writeFile(
      path.join(backupDir, "manifest.ejson"),
      EJSON.stringify(manifest, { relaxed: false, indent: 2 }),
      "utf8"
    );
    const backupDurationMs = Date.now() - backupStartedAt;

    const restoreStartedAt = Date.now();
    const restored = client.db(restoreDbName);
    for (const entry of manifest.collections) {
      await restored.createCollection(entry.name);
      const raw = await fs.readFile(path.join(backupDir, `${entry.name}.ejson`), "utf8");
      const documents = raw
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => EJSON.parse(line, { relaxed: false }));
      if (documents.length > 0) await restored.collection(entry.name).insertMany(documents);
      for (const index of entry.indexes) {
        await restored.collection(entry.name).createIndex(index.key, index.options);
      }
    }
    const restoreDurationMs = Date.now() - restoreStartedAt;

    const verification = [];
    for (const expected of manifest.collections) {
      const actual = await checksumCollection(restored.collection(expected.name));
      const restoredIndexes = await restored.collection(expected.name).listIndexes().toArray();
      const expectedIndexNames = expected.indexes.map((index) => index.options.name).sort();
      const actualIndexNames = restoredIndexes
        .filter((index) => index.name !== "_id_")
        .map((index) => index.name)
        .sort();
      verification.push({
        collection: expected.name,
        countMatches: actual.count === expected.count,
        checksumMatches: actual.sha256 === expected.sha256,
        indexesMatch: JSON.stringify(actualIndexNames) === JSON.stringify(expectedIndexNames),
        count: actual.count,
        sha256: actual.sha256,
      });
    }

    const success = verification.every(
      (item) => item.countMatches && item.checksumMatches && item.indexesMatch
    );
    const evidence = {
      generatedAt: new Date().toISOString(),
      releaseSha: process.env.RELEASE_SHA || "working-tree",
      success,
      environment: {
        node: process.version,
        platform: `${process.platform}-${process.arch}`,
        database: "mongodb-memory-server",
      },
      backupDurationMs,
      restoreDurationMs,
      totalDrillDurationMs: Date.now() - startedAt,
      verification,
    };
    const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
    if (process.env.EVIDENCE_OUTPUT) {
      await fs.mkdir(path.dirname(path.resolve(process.env.EVIDENCE_OUTPUT)), { recursive: true });
      await fs.writeFile(process.env.EVIDENCE_OUTPUT, serialized, "utf8");
    }
    console.log(serialized);
    if (!success) process.exitCode = 1;
  } finally {
    await client.close();
    await mongoServer.stop();
    await fs.rm(backupDir, { recursive: true, force: true });
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
