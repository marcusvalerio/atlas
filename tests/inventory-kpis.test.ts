import { test } from "node:test";
import assert from "node:assert/strict";
import { computeInventoryKpis } from "../src/lib/inventory/kpis";

const now = new Date("2026-11-18T12:00:00Z");
const base = {
  period: { start: "2026-08-20", end: "2026-11-18" },
  now,
  lastOut: new Map([["a", "2026-11-10T00:00:00Z"], ["c", "2026-11-01T00:00:00Z"]]),
};

test("exemplos da aula: PME, ruptura, custo, obsolescência e avarias", () => {
  const k = computeInventoryKpis({
    ...base,
    settings: { periodDays: 360 },
    products: [
      { id: "a", label: "A", unit: "un", minimum: 0, maximum: 0, reorderPoint: 0, leadTime: 10 },
      { id: "b", label: "B", unit: "un", minimum: 0, maximum: 0, reorderPoint: 0, leadTime: null },
    ],
    // Estoque inicial = final: R$ 120.000 médio; CMV anual R$ 720.000.
    balances: new Map([["a", { quantity: 7200, value: 120_000 }]]),
    movements: [
      { productId: "a", type: "ISSUE", quantity: 7200, totalCost: 720_000, createdAt: "2026-10-01" },
      { productId: "a", type: "RECEIPT", quantity: 7200, totalCost: 720_000, createdAt: "2026-10-02" },
    ],
    receipts: { received: 2000, damaged: 30 },
  });
  assert.equal(k.averageDays, 60);
  assert.equal(k.turnover, 6);
  assert.equal(k.stockoutItems, 1);
  assert.equal(k.stockoutPct, 50);
  assert.equal(k.carryingCostYear, 28_800);
  assert.equal(k.damagePct, 1.5);
  assert.equal(k.obsoletePct, 0);
});

test("mínimo sugerido, ponto de pedido e situação por item", () => {
  const k = computeInventoryKpis({
    ...base,
    settings: { periodDays: 30, safetyDays: 5 },
    products: [
      // 20 un/dia, segurança 5 dias, lead time 10: mínimo 100, ponto de pedido 300.
      { id: "a", label: "A", unit: "un", minimum: 0, maximum: 500, reorderPoint: 0, leadTime: 10 },
      { id: "c", label: "C", unit: "un", minimum: 0, maximum: 500, reorderPoint: 0, leadTime: 10 },
      { id: "d", label: "D", unit: "un", minimum: 0, maximum: 0, reorderPoint: 0, leadTime: 10 },
    ],
    balances: new Map([
      ["a", { quantity: 250, value: 2500 }],
      ["c", { quantity: 600, value: 6000 }],
      ["d", { quantity: 10, value: 100 }],
    ]),
    movements: [
      { productId: "a", type: "ISSUE", quantity: 600, totalCost: 6000, createdAt: "2026-11-01" },
      { productId: "c", type: "ISSUE", quantity: 600, totalCost: 6000, createdAt: "2026-11-01" },
    ],
    receipts: { received: 0, damaged: 0 },
  });
  const a = k.items.find((i) => i.productId === "a")!;
  assert.equal(a.suggestedMinimum, 100);
  assert.equal(a.reorderPoint, 300);
  assert.equal(a.coverageDays, 12.5);
  assert.equal(a.status, "atencao");
  assert.equal(k.items.find((i) => i.productId === "c")!.status, "excesso");
  const d = k.items.find((i) => i.productId === "d")!;
  assert.equal(d.obsolete, true);
  assert.equal(d.status, "sem_giro");
  assert.equal(k.aboveMaximum, 1);
  assert.equal(k.damagePct, null);
});
