import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeBalances,
  physicalOnHand,
  sumQtyByProduct,
} from '../dailyStockModel.ts';

// ─── computeBalances ────────────────────────────────────────────────────────────

test('computeBalances: closing = opening - delivered - reserved + received', () => {
  // From the spec image (RUBIE row): 100 - 40 - 20 + 150 = 190 closing,
  // grand total = 190 + 300 in-transit = 490.
  const { closing, grandTotal } = computeBalances({
    opening: 100, delivered: 40, reserved: 20, received: 150, inTransit: 300,
  });
  assert.equal(closing, 190);
  assert.equal(grandTotal, 490);
});

test('computeBalances: grand total = closing + in transit', () => {
  const { closing, grandTotal } = computeBalances({
    opening: 10, delivered: 0, reserved: 0, received: 0, inTransit: 5,
  });
  assert.equal(closing, 10);
  assert.equal(grandTotal, 15);
});

test('computeBalances: a fully-reserved row closes at zero but keeps grand total', () => {
  const { closing, grandTotal } = computeBalances({
    opening: 10, delivered: 0, reserved: 10, received: 0, inTransit: 4,
  });
  assert.equal(closing, 0);
  assert.equal(grandTotal, 4);
});

// ─── physicalOnHand ─────────────────────────────────────────────────────────────

test('physicalOnHand ignores reservations (a reserve is a hold, not a removal)', () => {
  // Opening 10, 2 delivered, 3 received → 11 physically present, regardless
  // of how many are reserved.
  assert.equal(physicalOnHand({ opening: 10, delivered: 2, received: 3 }), 11);
});

// ─── sumQtyByProduct ────────────────────────────────────────────────────────────

test('sumQtyByProduct aggregates duplicate products and keeps the first name', () => {
  const map = sumQtyByProduct([
    { productId: 3, productName: 'NEU', qty: 4 },
    { productId: 3, productName: 'NEU dup', qty: 6 },
    { productId: 1, productName: 'RUBIE', qty: 2 },
  ]);
  assert.equal(map.get(3)?.qty, 10);
  assert.equal(map.get(3)?.name, 'NEU');
  assert.equal(map.get(1)?.qty, 2);
});

test('sumQtyByProduct skips non-numeric products and non-positive qty', () => {
  const map = sumQtyByProduct([
    { productId: undefined, qty: 5 },
    { productId: 2, qty: 0 },
    { productId: 2, qty: -3 },
    { productId: 2, qty: 7 },
  ]);
  assert.equal(map.size, 1);
  assert.equal(map.get(2)?.qty, 7);
});

// ─── Simulated PI lifecycle ─────────────────────────────────────────────────────
// Mirrors exactly what the API endpoints do to the daily ledger, but in-memory,
// so we can assert the stock invariants the create/payment/dispatch routes rely
// on. (The endpoints call bumpDailyStock to apply these same deltas in Mongo.)

interface Ledger { opening: number; delivered: number; reserved: number; received: number; inTransit: number }

const fresh = (opening: number): Ledger =>
  ({ opening, delivered: 0, reserved: 0, received: 0, inTransit: 0 });

// PI creation guard: must have closing >= qty to commit.
const canCommit = (l: Ledger, qty: number) => computeBalances(l).closing >= qty;
// Dispatch guard: must have physical on-hand >= qty.
const canDispatch = (l: Ledger, qty: number) => physicalOnHand(l) >= qty;

test('lifecycle: create → first payment (reserve) → dispatch keeps stock consistent', () => {
  const l = fresh(10); // opening stock of 10 units

  // 1) Create a PI for 4 units — allowed (closing 10 >= 4).
  assert.ok(canCommit(l, 4));

  // 2) Record first payment → reserve 4. Closing drops to 6, physical still 10.
  l.reserved += 4;
  assert.equal(computeBalances(l).closing, 6);
  assert.equal(physicalOnHand(l), 10);

  // 3) Dispatch the 4 units — allowed (physical 10 >= 4). Delivered += 4,
  //    reserved released by 4. Closing stays 6, physical drops to 6.
  assert.ok(canDispatch(l, 4));
  l.delivered += 4;
  l.reserved -= 4;
  assert.equal(computeBalances(l).closing, 6);
  assert.equal(physicalOnHand(l), 6);
});

test('lifecycle: cannot commit a PI larger than available closing', () => {
  const l = fresh(5);
  l.reserved += 5;                 // a prior paid PI reserved everything
  assert.equal(computeBalances(l).closing, 0);
  assert.equal(canCommit(l, 1), false); // no committable stock left
  assert.ok(canDispatch(l, 5));          // but the 5 reserved are still physically dispatchable
});

test('lifecycle: receiving in-transit stock raises closing and physical', () => {
  const l = fresh(0);
  l.inTransit += 20;               // ops registers 20 inbound
  assert.equal(computeBalances(l).closing, 0); // not yet received
  // Receive 12 → inTransit 8, received 12.
  l.inTransit -= 12;
  l.received += 12;
  assert.equal(computeBalances(l).closing, 12);
  assert.equal(physicalOnHand(l), 12);
  assert.equal(computeBalances(l).grandTotal, 20); // 12 closing + 8 still in transit
});
