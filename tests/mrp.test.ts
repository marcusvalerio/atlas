import { test } from "node:test";
import assert from "node:assert/strict";
import { computeMrp, type MrpInput } from "../src/lib/production/mrp";

const base = (): MrpInput => ({
  products: [
    { id: "kit", code: "AST-201", name: "Quadro montado", unit: "UN", minimumStock: 0, productionType: "manufactured" },
    { id: "disj", code: "AST-103", name: "Disjuntor", unit: "UN", minimumStock: 10, productionType: "purchased" },
    { id: "caixa", code: "AST-109", name: "Quadro vazio", unit: "UN", minimumStock: 0, productionType: "purchased" },
    { id: "fita", code: "AST-111", name: "Fita isolante", unit: "UN", minimumStock: 0, productionType: "purchased" },
  ],
  onHand: { kit: 2, disj: 30, caixa: 0, fita: 100 },
  salesDemand: [{ productId: "kit", quantity: 7, dueDate: "2026-11-20", source: "PV-0080" }],
  productionDemand: [],
  scheduledReceipts: [{ productId: "caixa", quantity: 1, source: "PC-0021" }],
  boms: [{ productId: "kit", referenceQuantity: 1, items: [{ componentId: "disj", quantity: 4, scrapPercentage: 0 }, { componentId: "caixa", quantity: 1, scrapPercentage: 0 }] }],
});

test("explode a estrutura: produzir o acabado e comprar só o que falta dos componentes", () => {
  const lines = computeMrp(base());
  const by = Object.fromEntries(lines.map((l) => [l.productId, l]));
  // Quadro: 7 vendidos − 2 em estoque = produzir 5.
  assert.equal(by.kit.action, "produce");
  assert.equal(by.kit.netRequirement, 5);
  // Disjuntor: 5 × 4 = 20 + mínimo 10 − 30 em estoque = 0 → não aparece.
  assert.equal(by.disj, undefined);
  // Quadro vazio: 5 − 0 em estoque − 1 a receber = comprar 4, até a data do pedido.
  assert.equal(by.caixa.action, "buy");
  assert.equal(by.caixa.netRequirement, 4);
  assert.equal(by.caixa.needBy, "2026-11-20");
  assert.deepEqual(by.caixa.sources, ["Produzir AST-201"]);
  assert.equal(by.caixa.level, 1);
  assert.equal(by.fita, undefined);
});

test("estoque mínimo gera compra mesmo sem pedido; refugo aumenta o consumo", () => {
  const input = base();
  input.salesDemand = [{ productId: "kit", quantity: 12, dueDate: null, source: "PV-0081" }];
  input.boms[0].items[0].scrapPercentage = 20;
  input.onHand.disj = 5;
  const by = Object.fromEntries(computeMrp(input).map((l) => [l.productId, l]));
  // Produzir 10; disjuntor: 10 × 4 / 0,8 = 50 + mínimo 10 − 5 = 55.
  assert.equal(by.kit.netRequirement, 10);
  assert.equal(by.disj.netRequirement, 55);
  assert.equal(by.disj.dependentDemand, 50);
});

test("produto só comprado nunca vira produção, e estrutura circular não trava", () => {
  const input = base();
  input.products[0].productionType = "purchased";
  input.boms.push({ productId: "caixa", referenceQuantity: 1, items: [{ componentId: "kit", quantity: 1, scrapPercentage: 0 }] });
  const lines = computeMrp(input);
  assert.equal(lines.find((l) => l.productId === "kit")?.action, "buy");
});
