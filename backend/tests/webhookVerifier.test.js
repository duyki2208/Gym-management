const crypto = require("crypto");
const { verifySepayWebhook } = require("../middleware/webhookVerifier");

const createResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

const signedRequest = (timestamp) => {
  const rawBody = JSON.stringify({ id: "evt_1", transferAmount: 100000 });
  const signature = crypto
    .createHmac("sha256", process.env.SEPAY_WEBHOOK_SECRET)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  return {
    headers: {
      "x-sepay-signature": `sha256=${signature}`,
      "x-sepay-timestamp": timestamp,
    },
    rawBody,
    body: JSON.parse(rawBody),
  };
};

describe("SePay webhook replay protection", () => {
  beforeEach(() => {
    process.env.SEPAY_WEBHOOK_SECRET = "webhook-test-secret";
    process.env.SEPAY_WEBHOOK_TOLERANCE_SECONDS = "300";
  });

  afterEach(() => {
    delete process.env.SEPAY_WEBHOOK_SECRET;
    delete process.env.SEPAY_WEBHOOK_TOLERANCE_SECONDS;
  });

  test("accepts a valid signature with a fresh timestamp", () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const req = signedRequest(timestamp);
    const res = createResponse();
    const next = jest.fn();

    verifySepayWebhook(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
  });

  test("rejects an otherwise valid signature with a stale timestamp", () => {
    const timestamp = Math.floor((Date.now() - 10 * 60 * 1000) / 1000).toString();
    const req = signedRequest(timestamp);
    const res = createResponse();
    const next = jest.fn();

    verifySepayWebhook(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toMatch(/hết thời hạn/i);
  });
});
