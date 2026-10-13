/* eslint-disable no-console */
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(48).toString("base64url");

const percentile = (sorted, ratio) => {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
};

const runLoad = async ({ baseUrl, token, name, path, requests, concurrency }) => {
  for (let index = 0; index < Math.min(5, requests); index += 1) {
    const warmup = await fetch(`${baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    await warmup.arrayBuffer();
  }

  let cursor = 0;
  let failures = 0;
  let responseBytes = 0;
  const latencies = [];
  const startedAt = process.hrtime.bigint();

  const worker = async () => {
    while (true) {
      const requestIndex = cursor;
      cursor += 1;
      if (requestIndex >= requests) return;

      const requestStartedAt = process.hrtime.bigint();
      try {
        const response = await fetch(`${baseUrl}${path}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.arrayBuffer();
        responseBytes += payload.byteLength;
        if (!response.ok) failures += 1;
      } catch {
        failures += 1;
      }
      latencies.push(Number(process.hrtime.bigint() - requestStartedAt) / 1e6);
    }
  };

  await Promise.all(Array.from({ length: concurrency }, worker));
  const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
  latencies.sort((a, b) => a - b);

  return {
    name,
    path,
    requests,
    concurrency,
    failures,
    throughputRps: Number((requests / durationSeconds).toFixed(2)),
    latencyMs: {
      min: Number((latencies[0] || 0).toFixed(2)),
      p50: Number(percentile(latencies, 0.5).toFixed(2)),
      p95: Number(percentile(latencies, 0.95).toFixed(2)),
      p99: Number(percentile(latencies, 0.99).toFixed(2)),
      max: Number((latencies[latencies.length - 1] || 0).toFixed(2)),
    },
    averageResponseBytes: Math.round(responseBytes / requests),
  };
};

const main = async () => {
  const dataset = {
    customers: Number(process.env.BENCH_CUSTOMERS || 1000),
    checkins: Number(process.env.BENCH_CHECKINS || 5000),
    posOrders: Number(process.env.BENCH_POS_ORDERS || 250),
    transactions: Number(process.env.BENCH_TRANSACTIONS || 5000),
  };
  const requests = Number(process.env.BENCH_REQUESTS || 80);
  const concurrency = Number(process.env.BENCH_CONCURRENCY || 8);
  const mongoServer = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongoServer.getUri("gym_management");

  let httpServer;
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const app = require("../server");
    const User = require("../models/User");
    const Customer = require("../models/Customer");
    const CustomerPackage = require("../models/CustomerPackage");
    const CheckIn = require("../models/CheckIn");
    const SaleOrder = require("../models/SaleOrder");
    const Transaction = require("../models/Transaction");

    const user = await User.create({
      username: "benchmark_admin",
      password: "not-used-by-benchmark",
      fullName: "Benchmark Admin",
      role: "admin",
      isActive: true,
    });
    const token = jwt.sign(
      { id: user._id, role: "admin", branchCode: "HN01", isCentral: false },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const now = new Date();
    const endDate = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
    const customerDocs = Array.from({ length: dataset.customers }, (_, index) => ({
      _id: new mongoose.Types.ObjectId(),
      name: `Benchmark Customer ${index}`,
      code: `BENCH${String(index).padStart(6, "0")}`,
      phone: `09${String(index).padStart(8, "0")}`,
      packageType: "Benchmark Package",
      startDate: now,
      endDate,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    }));
    await Customer.collection.insertMany(customerDocs);

    await CustomerPackage.collection.insertMany(
      customerDocs.map((customer, index) => ({
        customer: customer._id,
        packageName: "Benchmark Package",
        startDate: now,
        endDate,
        price: 1000000,
        paidAmount: 1000000,
        paymentStatus: "paid",
        contractCode: `BENCH-HD-${index}`,
        status: "active",
        assignedStaff: user._id,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      }))
    );

    await CheckIn.collection.insertMany(
      Array.from({ length: dataset.checkins }, (_, index) => {
        const customer = customerDocs[index % customerDocs.length];
        return {
          customerId: customer._id,
          customerName: customer.name,
          customerCode: customer.code,
          packageType: "Benchmark Package",
          time: new Date(now.getTime() - index * 1000),
          createdAt: now,
          updatedAt: now,
        };
      })
    );

    await SaleOrder.collection.insertMany(
      Array.from({ length: dataset.posOrders }, (_, index) => ({
        isWalkIn: true,
        totalAmount: 50000 + index,
        paymentMethod: "Tiền mặt",
        status: "Đã thanh toán",
        details: [],
        staff: user._id,
        createdAt: now,
        updatedAt: now,
      }))
    );

    await Transaction.collection.insertMany(
      Array.from({ length: dataset.transactions }, (_, index) => ({
        code: `BENCH-TXN-${String(index).padStart(7, "0")}`,
        type: index % 2 === 0 ? "package_purchase" : "pos_sale",
        amount: 100000 + index,
        status: "success",
        paymentMethod: "Tiền mặt",
        staff: user._id,
        createdAt: now,
        updatedAt: now,
      }))
    );

    httpServer = app.listen(0);
    await new Promise((resolve) => httpServer.once("listening", resolve));
    const baseUrl = `http://127.0.0.1:${httpServer.address().port}`;

    const scenarios = [
      { name: "customer-list", path: "/api/v1/customers?page=1&limit=25" },
      { name: "checkin-history", path: "/api/v1/checkins?page=1&limit=50" },
      { name: "pos-sales-today", path: "/api/v1/pos/sales?preset=today&page=1&limit=25" },
      { name: "report-summary", path: "/api/v1/reports/summary" },
    ];
    const results = [];
    for (const scenario of scenarios) {
      results.push(await runLoad({
        baseUrl,
        token,
        requests,
        concurrency,
        ...scenario,
      }));
    }

    const evidence = {
      generatedAt: new Date().toISOString(),
      releaseSha: process.env.RELEASE_SHA || "working-tree",
      success: results.every((item) => item.failures === 0),
      environment: {
        node: process.version,
        platform: `${process.platform}-${process.arch}`,
        database: "mongodb-memory-server (single process, local)",
      },
      dataset,
      results,
    };
    const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
    if (process.env.EVIDENCE_OUTPUT) {
      await fs.mkdir(path.dirname(path.resolve(process.env.EVIDENCE_OUTPUT)), { recursive: true });
      await fs.writeFile(process.env.EVIDENCE_OUTPUT, serialized, "utf8");
    }
    console.log(serialized);
  } finally {
    if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
    const { closeAllConnections } = require("../db/branchConnectionManager");
    await closeAllConnections();
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    await mongoServer.stop();
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
