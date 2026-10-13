const {
  evaluateInstanceResults,
  runTransactionProbe,
} = require("../scripts/verify-production-topology");

describe("transaction topology probe", () => {
  test("commits and rolls back multi-document transactions, then removes its collection", async () => {
    const persisted = [];
    let dropped = false;
    const collection = {
      insertMany: jest.fn(async (documents, { session }) => {
        session.pending.push(...documents);
      }),
      countDocuments: jest.fn(async ({ run }) => persisted.filter((item) => item.run === run).length),
      drop: jest.fn(async () => { dropped = true; }),
    };
    const client = {
      db: jest.fn(() => ({ createCollection: jest.fn(async () => collection) })),
      startSession: jest.fn(() => ({
        pending: [],
        async withTransaction(callback) {
          await callback();
          persisted.push(...this.pending);
          this.pending = [];
        },
        startTransaction() {},
        async abortTransaction() { this.pending = []; },
        async endSession() {},
      })),
    };

    const result = await runTransactionProbe(client, "transaction_probe_test");

    expect(result).toEqual({
      executed: true,
      committedDocuments: 2,
      rolledBackDocuments: 0,
      passed: true,
    });
    expect(collection.insertMany).toHaveBeenCalledTimes(2);
    expect(dropped).toBe(true);
  });

  test("requires readiness, shared session and rate-limit policy on every instance", () => {
    const readiness = ["https://one.example", "https://two.example"].map((origin) => ({
      origin,
      status: 200,
      requestIdPropagated: true,
      release: "release-sha",
      dependencies: {
        defaultDatabase: true,
        centralDatabase: true,
        sharedCache: true,
        transactions: true,
      },
    }));
    const sessions = readiness.map(({ origin }) => ({
      origin,
      status: 200,
      requestIdPropagated: true,
      rateLimitPolicyPresent: true,
    }));

    expect(evaluateInstanceResults({
      readiness,
      sessions,
      expectedRelease: "release-sha",
      sessionRequired: true,
    })).toEqual({
      readinessPassed: true,
      sessionPassed: true,
      rateLimitPolicyPassed: true,
      passed: true,
    });

    sessions[1].rateLimitPolicyPresent = false;
    expect(evaluateInstanceResults({
      readiness,
      sessions,
      expectedRelease: "release-sha",
      sessionRequired: true,
    }).passed).toBe(false);
  });
});
