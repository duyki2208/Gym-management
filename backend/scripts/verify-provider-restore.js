/* eslint-disable no-console */
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { MongoClient } = require("mongodb");
const { EJSON } = require("bson");

const sourceUri = process.env.RESTORE_SOURCE_URI;
const restoredUri = process.env.RESTORE_TARGET_URI;
const databases = String(process.env.RESTORE_DATABASES || "").split(",").map((item) => item.trim()).filter(Boolean);
const suffix = process.env.RESTORE_DB_SUFFIX || "_restore_drill";
const sampleSize = Math.min(10000, Math.max(1, Number(process.env.RESTORE_SAMPLE_SIZE || 1000)));
const backupCreatedAt = Date.parse(process.env.BACKUP_CREATED_AT || "");
const incidentAt = Date.parse(process.env.DRILL_INCIDENT_AT || "");
const drillStartedAt = Date.parse(process.env.DRILL_STARTED_AT || "");
const rpoTargetSeconds = process.env.RPO_TARGET_SECONDS === undefined
  ? null
  : Number(process.env.RPO_TARGET_SECONDS);
const rtoTargetSeconds = process.env.RTO_TARGET_SECONDS === undefined
  ? null
  : Number(process.env.RTO_TARGET_SECONDS);

if (!sourceUri || !restoredUri || databases.length === 0) throw new Error("RESTORE_SOURCE_URI, RESTORE_TARGET_URI and RESTORE_DATABASES are required");
if (sourceUri === restoredUri && !suffix) throw new Error("Restore target must be isolated from source");
if (process.env.CONFIRM_ISOLATED_RESTORE !== "yes") throw new Error("Set CONFIRM_ISOLATED_RESTORE=yes after verifying the target is isolated");
if (![backupCreatedAt, incidentAt, drillStartedAt].every(Number.isFinite)) throw new Error("BACKUP_CREATED_AT, DRILL_INCIDENT_AT and DRILL_STARTED_AT are required ISO timestamps");
if (backupCreatedAt > incidentAt || incidentAt > drillStartedAt) throw new Error("Expected BACKUP_CREATED_AT <= DRILL_INCIDENT_AT <= DRILL_STARTED_AT");
if (rpoTargetSeconds !== null && (!Number.isFinite(rpoTargetSeconds) || rpoTargetSeconds < 0)) throw new Error("RPO_TARGET_SECONDS must be a non-negative number");
if (rtoTargetSeconds !== null && (!Number.isFinite(rtoTargetSeconds) || rtoTargetSeconds < 0)) throw new Error("RTO_TARGET_SECONDS must be a non-negative number");

const fingerprint = async (collection) => {
  const hash = crypto.createHash("sha256");
  const documents = await collection.find({}).sort({ _id: 1 }).limit(sampleSize).toArray();
  for (const document of documents) hash.update(EJSON.stringify(document, { relaxed: false }));
  return { sampled: documents.length, sha256: hash.digest("hex") };
};

const main = async () => {
  const source = new MongoClient(sourceUri, { serverSelectionTimeoutMS: 10000 });
  const target = new MongoClient(restoredUri, { serverSelectionTimeoutMS: 10000 });
  const startedAt = Date.now();
  try {
    await Promise.all([source.connect(), target.connect()]);
    const results = [];
    for (const database of databases) {
      const restoredDatabase = `${database}${suffix}`;
      if (restoredDatabase === database && sourceUri === restoredUri) throw new Error(`Unsafe target database: ${database}`);
      const collections = (await source.db(database).listCollections({}, { nameOnly: true }).toArray()).map((item) => item.name).sort();
      for (const collectionName of collections) {
        const sourceCollection = source.db(database).collection(collectionName);
        const targetCollection = target.db(restoredDatabase).collection(collectionName);
        const [sourceCount, targetCount, sourceHash, targetHash, sourceIndexes, targetIndexes] = await Promise.all([
          sourceCollection.countDocuments(),
          targetCollection.countDocuments(),
          fingerprint(sourceCollection),
          fingerprint(targetCollection),
          sourceCollection.listIndexes().toArray(),
          targetCollection.listIndexes().toArray(),
        ]);
        const normalizeIndexes = (items) => items.map((item) => ({ name: item.name, key: item.key, unique: Boolean(item.unique), expireAfterSeconds: item.expireAfterSeconds ?? null })).sort((a, b) => a.name.localeCompare(b.name));
        results.push({
          sourceDatabase: database,
          restoredDatabase,
          collection: collectionName,
          sourceCount,
          restoredCount: targetCount,
          countMatches: sourceCount === targetCount,
          sampleMatches: sourceHash.sha256 === targetHash.sha256,
          indexesMatch: JSON.stringify(normalizeIndexes(sourceIndexes)) === JSON.stringify(normalizeIndexes(targetIndexes)),
          sampledDocuments: sourceHash.sampled,
        });
      }
    }
    const measuredRpoSeconds = Math.max(0, (incidentAt - backupCreatedAt) / 1000);
    const measuredRtoSeconds = Math.max(0, (Date.now() - drillStartedAt) / 1000);
    const integrityPassed = results.every((item) => item.countMatches && item.sampleMatches && item.indexesMatch);
    const objectivesMet = (rpoTargetSeconds === null || measuredRpoSeconds <= rpoTargetSeconds) &&
      (rtoTargetSeconds === null || measuredRtoSeconds <= rtoTargetSeconds);
    const evidence = {
      gate: "provider-restore",
      generatedAt: new Date().toISOString(),
      environment: process.env.EVIDENCE_ENVIRONMENT || "staging-isolated-restore",
      releaseSha: process.env.RELEASE_SHA || process.env.GITHUB_SHA || "unknown",
      executedBy: process.env.EVIDENCE_EXECUTED_BY || process.env.GITHUB_ACTOR || "unknown",
      approvedBy: process.env.EVIDENCE_APPROVED_BY || null,
      success: integrityPassed && objectivesMet,
      integrityPassed,
      objectivesMet,
      sampleSize,
      measuredRpoSeconds,
      measuredRtoSeconds,
      targets: { rpoSeconds: rpoTargetSeconds, rtoSeconds: rtoTargetSeconds },
      verificationDurationMs: Date.now() - startedAt,
      results,
    };
    const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
    if (process.env.EVIDENCE_OUTPUT) {
      await fs.mkdir(path.dirname(path.resolve(process.env.EVIDENCE_OUTPUT)), { recursive: true });
      await fs.writeFile(process.env.EVIDENCE_OUTPUT, serialized, "utf8");
    }
    console.log(serialized);
    if (!evidence.success) process.exitCode = 1;
  } finally {
    await Promise.all([source.close(), target.close()]);
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
