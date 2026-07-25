const cacheService = require("../utils/cacheService");
const queueService = require("../utils/queueService");

describe("CacheService & QueueService Tests", () => {
  afterAll(async () => {
    await cacheService.clear();
  });

  test("CacheService set, get, del operations", async () => {
    await cacheService.set("test_key", { foo: "bar" }, 10);
    const cached = await cacheService.get("test_key");
    expect(cached).toEqual({ foo: "bar" });

    await cacheService.del("test_key");
    const empty = await cacheService.get("test_key");
    expect(empty).toBeNull();
  });

  test("CacheService delPattern works as expected", async () => {
    await cacheService.set("packages:list", [1, 2, 3], 10);
    await cacheService.set("packages:detail", { id: 1 }, 10);
    await cacheService.set("users:list", [4, 5], 10);

    await cacheService.delPattern("packages");

    expect(await cacheService.get("packages:list")).toBeNull();
    expect(await cacheService.get("packages:detail")).toBeNull();
    expect(await cacheService.get("users:list")).toEqual([4, 5]);
  });

  test("QueueService enqueue and background execution", (done) => {
    const mockWorker = jest.fn().mockImplementation(async (payload) => {
      expect(payload.data).toBe("test_payload");
      done();
    });

    queueService.registerWorker("TEST_JOB", mockWorker);
    queueService.enqueue("TEST_JOB", { data: "test_payload" });
  });
});
