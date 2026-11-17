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
    delete process.env.SEPAY_WEBHOOK_AUTH_MODE;
  });

  afterEach(() => {
    delete process.env.SEPAY_WEBHOOK_SECRET;
    delete process.env.SEPAY_WEBHOOK_TOLERANCE_SECONDS;
    delete process.env.SEPAY_WEBHOOK_AUTH_MODE;
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

  test.each(["body-only", "changed-timestamp", "changed-body", "missing-raw", "malformed-signature", "missing-timestamp", "future-timestamp"])("rejects %s without falling back to an API key", (variant) => {
    const req = signedRequest(String(Math.floor(Date.now() / 1000)));
    req.headers.authorization = `Apikey ${process.env.SEPAY_WEBHOOK_SECRET}`;
    if (variant === "body-only") req.headers["x-sepay-signature"] = "sha256=" + crypto.createHmac("sha256", process.env.SEPAY_WEBHOOK_SECRET).update(req.rawBody).digest("hex");
    if (variant === "changed-timestamp") req.headers["x-sepay-timestamp"] = String(Number(req.headers["x-sepay-timestamp"]) - 1);
    if (variant === "changed-body") req.rawBody += " ";
    if (variant === "missing-raw") delete req.rawBody;
    if (variant === "malformed-signature") req.headers["x-sepay-signature"] = "sha256=xyz";
    if (variant === "missing-timestamp") delete req.headers["x-sepay-timestamp"];
    if (variant === "future-timestamp") req.headers["x-sepay-timestamp"] = String(Math.floor(Date.now() / 1000) + 600);
    const res = createResponse(), next = jest.fn();
    verifySepayWebhook(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  test("uses original raw whitespace and Unicode when verifying HMAC", () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = '{ "content": "Thanh toán", "id": 123 }';
    const signature = crypto.createHmac("sha256", process.env.SEPAY_WEBHOOK_SECRET).update(`${timestamp}.${rawBody}`).digest("hex");
    const next = jest.fn();
    verifySepayWebhook({ headers: { "x-sepay-timestamp": timestamp, "x-sepay-signature": `sha256=${signature}` }, rawBody, body: JSON.parse(rawBody) }, createResponse(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test.each(["development", "production", "test"])("fails closed without a secret in %s", (environment) => {
    delete process.env.SEPAY_WEBHOOK_SECRET;
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = environment;
    try {
      const res = createResponse(), next = jest.fn();
      verifySepayWebhook({ headers: {} }, res, next);
      expect(res.statusCode).toBe(500);
      expect(next).not.toHaveBeenCalled();
    } finally { process.env.NODE_ENV = previous; }
  });

  test.each(["Apikey", "Bearer", "raw"])("API key mode accepts only Apikey scheme: %s", (scheme) => {
    process.env.SEPAY_WEBHOOK_AUTH_MODE = "apikey";
    const token = process.env.SEPAY_WEBHOOK_SECRET;
    const res = createResponse(), next = jest.fn();
    verifySepayWebhook({ headers: { authorization: scheme === "raw" ? token : `${scheme} ${token}` } }, res, next);
    expect(next).toHaveBeenCalledTimes(scheme === "Apikey" ? 1 : 0);
    expect(res.statusCode).toBe(scheme === "Apikey" ? 200 : 401);
  });

  test("API key credentials alone cannot downgrade default HMAC mode", () => {
    const res = createResponse(), next = jest.fn();
    verifySepayWebhook({ headers: { authorization: `Apikey ${process.env.SEPAY_WEBHOOK_SECRET}` } }, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});
