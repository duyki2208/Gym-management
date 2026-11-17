import test from 'node:test';
import assert from 'node:assert/strict';
import { readAllPages } from '../src/services/paginatedList.js';

test('reads every bounded page without truncating a list above 100 records', async () => {
  const calls = [];
  const rows = await readAllPages(async (page, limit) => {
    calls.push([page, limit]);
    return { items: Array.from({ length: page === 3 ? 1 : 100 }, (_, i) => (page - 1) * 100 + i), totalPages: 3 };
  });
  assert.equal(rows.length, 201);
  assert.equal(new Set(rows).size, 201);
  assert.deepEqual(calls, [[1, 100], [2, 100], [3, 100]]);
});

test('oversized and malformed page metadata fail explicitly', async () => {
  await assert.rejects(readAllPages(async () => ({ items: [], totalPages: 101 })), /10.000/);
  await assert.rejects(readAllPages(async () => ({ items: [], totalPages: NaN })), /không hợp lệ/);
});

test('a later page failure never returns a silently incomplete result', async () => {
  await assert.rejects(readAllPages(async page => {
    if (page === 2) throw new Error('next page failed');
    return { items: [1], totalPages: 2 };
  }), /next page failed/);
});
