/* eslint-disable no-console */
const crypto = require("node:crypto");
const { MongoClient } = require("mongodb");
const Redis = require("ioredis");
const fs = require("node:fs/promises");
const path = require("node:path");

const timeoutMs = Number(process.env.TOPOLOGY_TIMEOUT_MS || 10000);
const expectedRelease = process.env.RELEASE_SHA || process.env.GITHUB_SHA || null;
const transactionProbeDb = process.env.TRANSACTION_PROBE_DB;
const requireTransactionProbe = process.env.REQUIRE_TRANSACTION_PROBE === "true";
const requireMultiInstanceSession = process.env.REQUIRE_MULTI_INSTANCE_SESSION === "true";
const accessToken = process.env.STAGING_ACCESS_TOKEN;

if (requireTransactionProbe && !transactionProbeDb) {
  throw new Error("REQUIRE_TRANSACTION_PROBE=true requires TRANSACTION_PROBE_DB");
}
if (transactionProbeDb && process.env.CONFIRM_TRANSACTION_PROBE !== "yes") {
  throw new Error("Set CONFIRM_TRANSACTION_PROBE=yes after verifying TRANSACTION_PROBE_DB is safe for temporary writes");
}
if (requireMultiInstanceSession && !accessToken) {
  throw new Error("REQUIRE_MULTI_INSTANCE_SESSION=true requires STAGING_ACCESS_TOKEN");
}

const runTransactionProbe = async (client, databaseName) => {
  if (!databaseName) return { executed: false, passed: null };
  const suffix = crypto.randomUUID().replace(/-/g, "");
  const collectionName = `__readiness_tx_${Date.now()}_${suffix}`;
  const database = client.db(databaseName);
  let collection;
  try {
    collection = await database.createCollection(collectionName);
    const committedRun = crypto.randomUUID();
    const commitSession = client.startSession();
    try {
      await commitSession.withTransaction(async () => {
        await collection.insertMany([
          { run: committedRun, document: 1 },
          { run: committedRun, document: 2 },
        ], { session: commitSession });
      }, {
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
      });
    } finally {
      await commitSession.endSession();
    }

    const committedDocuments = await collection.countDocuments({ run: committedRun });
    const rolledBackRun = crypto.randomUUID();
    const rollbackSession = client.startSession();
    try {
      rollbackSession.startTransaction({
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
      });
      await collection.insertMany([
        { run: rolledBackRun, document: 1 },
        { run: rolledBackRun, document: 2 },
      ], { session: rollbackSession });
      await rollbackSession.abortTransaction();
    } finally {
      await rollbackSession.endSession();
    }
    const rolledBackDocuments = await collection.countDocuments({ run: rolledBackRun });
    return {
      executed: true,
      committedDocuments,
      rolledBackDocuments,
      passed: committedDocuments === 2 && rolledBackDocuments === 0,
    };
  } catch (error) {
    return {
      executed: true,
      passed: false,
      error: error?.codeName || error?.name || "TransactionProbeError",
    };
  } finally {
    if (collection) await collection.drop().catch(() => {});
  }
};

const fetchReadiness = async (url) => {
  const requestId = `topology-${Date.now()}-${crypto.randomUUID()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/api/v1/system/health/ready`, {
      signal: controller.signal,
      headers: { "x-request-id": requestId },
    });
    const body = await response.json().catch(() => ({}));
    return {
      origin: new URL(url).origin,
      status: response.status,
      dependencies: body?.data?.dependencies,
      release: body?.data?.release || null,
      requestIdPropagated: response.headers.get("x-request-id") === requestId,
    };
  } finally {
    clearTimeout(timer);
  }
};

const fetchSession = async (url, token) => {
  const requestId = `topology-session-${Date.now()}-${crypto.randomUUID()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/api/v1/auth/me`, {
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        "x-request-id": requestId,
      },
    });
    await response.arrayBuffer();
    return {
      origin: new URL(url).origin,
      status: response.status,
      requestIdPropagated: response.headers.get("x-request-id") === requestId,
      rateLimitPolicyPresent: Boolean(response.headers.get("ratelimit-policy")),
    };
  } finally {
    clearTimeout(timer);
  }
};

const evaluateInstanceResults = ({ readiness, sessions, expectedRelease: release, sessionRequired }) => {
  const readinessPassed = readiness.length >= 2 && readiness.every((item) =>
    item.status === 200 &&
    item.requestIdPropagated === true &&
    item.dependencies?.defaultDatabase === true &&
    item.dependencies?.centralDatabase === true &&
    item.dependencies?.sharedCache === true &&
    item.dependencies?.transactions === true &&
    (!release || item.release === release)
  );
  const sessionPassed = !sessionRequired || (
    sessions.length === readiness.length &&
    sessions.every((item) => item.status === 200 && item.requestIdPropagated === true)
  );
  const rateLimitPolicyPassed = !sessionRequired || (
    sessions.length === readiness.length &&
    sessions.every((item) => item.rateLimitPolicyPresent === true)
  );
  return {
    readinessPassed,
    sessionPassed,
    rateLimitPolicyPassed,
    passed: readinessPassed && sessionPassed && rateLimitPolicyPassed,
  };
};

const main = async () => {
  if (!process.env.MONGO_URI || !process.env.REDIS_URL) throw new Error("MONGO_URI and REDIS_URL are required");
  if (!Number.isFinite(timeoutMs) || timeoutMs < 100 || timeoutMs > 60000) throw new Error("TOPOLOGY_TIMEOUT_MS must be 100..60000");
  const mongo = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  const redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, connectTimeout: 10000, maxRetriesPerRequest: 1 });
  try {
    await mongo.connect();
    const hello = await mongo.db("admin").command({ hello: 1 });
    const transactionProbe = await runTransactionProbe(mongo, transactionProbeDb);
    await redis.connect();
    const redisPing = await redis.ping();
    const instanceUrls = String(process.env.INSTANCE_BASE_URLS || "").split(",").map((item) => item.trim()).filter(Boolean);
    if (instanceUrls.length < 2) throw new Error("INSTANCE_BASE_URLS must contain at least two backend instance URLs");
    const instanceOrigins = instanceUrls.map((url) => new URL(url).origin);
    if (new Set(instanceOrigins).size !== instanceOrigins.length) throw new Error("INSTANCE_BASE_URLS must contain unique instance origins");
    for (const url of instanceUrls) {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" && process.env.ALLOW_INSECURE_STAGING !== "true") {
        throw new Error("INSTANCE_BASE_URLS must use HTTPS");
      }
    }
    const instanceReadiness = await Promise.all(instanceUrls.map(fetchReadiness));
    const readinessPreflight = evaluateInstanceResults({
      readiness: instanceReadiness,
      sessions: [],
      expectedRelease,
      sessionRequired: false,
    });
    const instanceSessions = readinessPreflight.readinessPassed && accessToken
      ? await Promise.all(instanceUrls.map((url) => fetchSession(url, accessToken)))
      : [];
    const multiInstance = evaluateInstanceResults({
      readiness: instanceReadiness,
      sessions: instanceSessions,
      expectedRelease,
      sessionRequired: requireMultiInstanceSession,
    });
    const evidence = {
      gate: "topology-transaction",
      generatedAt: new Date().toISOString(),
      environment: process.env.EVIDENCE_ENVIRONMENT || "staging",
      releaseSha: expectedRelease || "unknown",
      executedBy: process.env.EVIDENCE_EXECUTED_BY || process.env.GITHUB_ACTOR || "unknown",
      approvedBy: process.env.EVIDENCE_APPROVED_BY || null,
      success: Boolean(hello.setName || hello.msg === "isdbgrid") &&
        redisPing === "PONG" &&
        multiInstance.passed &&
        (!requireTransactionProbe || transactionProbe.passed === true),
      mongo: {
        deploymentType: hello.msg === "isdbgrid" ? "sharded" : (hello.setName ? "replica-set" : "standalone"),
        replicaSet: hello.setName || null,
        writablePrimary: Boolean(hello.isWritablePrimary),
      },
      redis: { ping: redisPing },
      transactionProbe,
      instances: instanceReadiness,
      instanceSessions,
      multiInstance,
    };
    const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
    if (process.env.EVIDENCE_OUTPUT) {
      await fs.mkdir(path.dirname(path.resolve(process.env.EVIDENCE_OUTPUT)), { recursive: true });
      await fs.writeFile(process.env.EVIDENCE_OUTPUT, serialized, "utf8");
    }
    console.log(serialized);
    if (!evidence.success) process.exitCode = 1;
  } finally {
    await mongo.close();
    redis.disconnect();
  }
};

module.exports = { evaluateInstanceResults, runTransactionProbe };

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
