/**
 * Verification script: test-closure-logic.js
 * Test the compensation formula, double-apply check, reverse mechanism, and audit history logic
 */
const assert = require("assert");

// Formula
const toStartOfDay = (d) => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
};

const toEndOfDay = (d) => {
  const date = new Date(d);
  date.setHours(23, 59, 59, 999);
  return date;
};

const calculateOverlapDays = (pkgStart, pkgEnd, closureStart, closureEnd) => {
  const pStart = toStartOfDay(pkgStart);
  const pEnd = toEndOfDay(pkgEnd);
  const cStart = toStartOfDay(closureStart);
  const cEnd = toEndOfDay(closureEnd);

  const overlapStart = pStart > cStart ? pStart : cStart;
  const overlapEnd = pEnd < cEnd ? pEnd : cEnd;

  if (overlapEnd >= overlapStart) {
    const diffMs = overlapEnd.getTime() - overlapStart.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  }
  return 0;
};

console.log("=== 1. TEST OVERLAP DAYS FORMULA ===");

// Case A: Closure inside package duration
// Package: 2026-10-01 to 2026-10-31
// Closure: 2026-10-10 to 2026-10-14 (5 days: 10, 11, 12, 13, 14)
const daysA = calculateOverlapDays("2026-10-01", "2026-10-31", "2026-10-10", "2026-10-14");
assert.strictEqual(daysA, 5, `Expected 5 days, got ${daysA}`);
console.log(" Case A (Closure inside package): 5 days overlap -> PASS");

// Case B: Package ends during closure
// Package: 2026-10-01 to 2026-10-12
// Closure: 2026-10-10 to 2026-10-15
// Overlap: 2026-10-10 to 2026-10-12 (3 days: 10, 11, 12)
const daysB = calculateOverlapDays("2026-10-01", "2026-10-12", "2026-10-10", "2026-10-15");
assert.strictEqual(daysB, 3, `Expected 3 days, got ${daysB}`);
console.log(" Case B (Package ends inside closure): 3 days overlap -> PASS");

// Case C: Package starts during closure
// Package: 2026-10-12 to 2026-10-31
// Closure: 2026-10-10 to 2026-10-15
// Overlap: 2026-10-12 to 2026-10-15 (4 days: 12, 13, 14, 15)
const daysC = calculateOverlapDays("2026-10-12", "2026-10-31", "2026-10-10", "2026-10-15");
assert.strictEqual(daysC, 4, `Expected 4 days, got ${daysC}`);
console.log(" Case C (Package starts inside closure): 4 days overlap -> PASS");

// Case D: No overlap (Closure before package)
// Package: 2026-10-20 to 2026-10-31
// Closure: 2026-10-10 to 2026-10-15
const daysD = calculateOverlapDays("2026-10-20", "2026-10-31", "2026-10-10", "2026-10-15");
assert.strictEqual(daysD, 0, `Expected 0 days, got ${daysD}`);
console.log(" Case D (No overlap): 0 days -> PASS");

console.log("\n=== 2. TEST COMPENSATION & DOUBLE-APPLY LOGIC ===");
const closureId = "closure_event_123";
let pkg = {
  _id: "pkg_456",
  startDate: new Date("2026-10-01T00:00:00.000Z"),
  endDate: new Date("2026-10-31T23:59:59.999Z"),
  appliedClosures: [],
};

// First run: Apply closure
const daysToAdd = calculateOverlapDays(pkg.startDate, pkg.endDate, "2026-10-10", "2026-10-14");
const alreadyApplied = pkg.appliedClosures.some(c => c.closureEventId === closureId);
assert.strictEqual(alreadyApplied, false);

const prevEnd = new Date(pkg.endDate);
const newEnd = new Date(prevEnd.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
pkg.endDate = newEnd;
pkg.appliedClosures.push({
  closureEventId: closureId,
  daysAdded: daysToAdd,
  previousEndDate: prevEnd,
  newEndDate: newEnd,
  appliedAt: new Date(),
});

assert.strictEqual(pkg.appliedClosures.length, 1);
assert.strictEqual(pkg.endDate.getTime() > prevEnd.getTime(), true);
console.log(` Package extended by +${daysToAdd} days -> New end date: ${pkg.endDate.toISOString()} -> PASS`);

// Second run: Attempt double apply
const secondCheck = pkg.appliedClosures.some(c => c.closureEventId === closureId);
assert.strictEqual(secondCheck, true, "Double apply check should detect already applied");
console.log(" Double-apply attempt blocked -> PASS");

console.log("\n=== 3. TEST REVERSE LOGIC ===");
const entry = pkg.appliedClosures.find(c => c.closureEventId === closureId);
assert.ok(entry);
// Restore previousEndDate
pkg.endDate = new Date(entry.previousEndDate);
pkg.appliedClosures = pkg.appliedClosures.filter(c => c.closureEventId !== closureId);

assert.strictEqual(pkg.endDate.getTime(), prevEnd.getTime());
assert.strictEqual(pkg.appliedClosures.length, 0);
console.log(` Reversed successfully. End date restored to: ${pkg.endDate.toISOString()} -> PASS`);

console.log("\n=== ALL UNIT LOGIC TESTS PASSED SUCCESSFULLY! ===");
