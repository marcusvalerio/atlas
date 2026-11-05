import { test } from "node:test";
import assert from "node:assert/strict";
import { computeCountAccuracy } from "../src/lib/inventory/accuracy";

const cost: Record<string, number> = { a: 10, b: 50, c: 2 };

test("acuracidade por itens ignora itens não contados", () => {
  const acc = computeCountAccuracy(
    [
      { product_id: "a", expected_quantity: "100", counted_quantity: "100" },
      { product_id: "b", expected_quantity: 20, counted_quantity: 18 },
      { product_id: "c", expected_quantity: 50, counted_quantity: null },
    ],
    (id) => cost[id] ?? 0,
  );
  assert.equal(acc.totalItems, 3);
  assert.equal(acc.countedItems, 2);
  assert.equal(acc.matchedItems, 1);
  assert.equal(acc.itemAccuracy, 50);
  // esperado em valor: 100×10 + 20×50 = 2000; erro: 2×50 = 100 → 95%
  assert.equal(acc.valueAccuracy, 95);
  assert.equal(acc.netVarianceValue, -100);
  assert.equal(acc.variances.length, 1);
  assert.equal(acc.variances[0].variance, -2);
});

test("sobra e falta somam em valor absoluto, mas a diferença líquida compensa", () => {
  const acc = computeCountAccuracy(
    [
      { product_id: "a", expected_quantity: 10, counted_quantity: 12 },
      { product_id: "b", expected_quantity: 10, counted_quantity: 9 },
    ],
    (id) => cost[id] ?? 0,
  );
  assert.equal(acc.itemAccuracy, 0);
  // esperado 600; erro absoluto 20 + 50 = 70 → 88,3%
  assert.equal(acc.valueAccuracy, 88.3);
  assert.equal(acc.netVarianceValue, -30);
  assert.equal(acc.variances[0].productId, "b", "ordena pela maior diferença em valor");
});

test("sem contagem ou sem custo, não inventa número", () => {
  const empty = computeCountAccuracy([{ product_id: "a", expected_quantity: 5, counted_quantity: null }], () => 10);
  assert.equal(empty.itemAccuracy, null);
  assert.equal(empty.valueAccuracy, null);
  const noCost = computeCountAccuracy([{ product_id: "x", expected_quantity: 5, counted_quantity: 5 }], () => 0);
  assert.equal(noCost.itemAccuracy, 100);
  assert.equal(noCost.valueAccuracy, null);
});
