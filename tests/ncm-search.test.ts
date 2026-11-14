import { test } from "node:test";
import assert from "node:assert/strict";
import { formatNcm, normalizeNcmQuery, parseNcmResponse } from "../src/lib/fiscal/ncm-search";

test("formata e normaliza o termo de busca de NCM", () => {
  assert.equal(formatNcm("85362000"), "8536.20.00");
  assert.equal(formatNcm("8536.2"), "8536.2");
  assert.equal(normalizeNcmQuery(" 8536.20 "), "853620");
  assert.equal(normalizeNcmQuery("8"), null);
  assert.equal(normalizeNcmQuery("di"), null);
  assert.equal(normalizeNcmQuery("  disjuntor  "), "disjuntor");
});

test("só códigos de 8 dígitos vigentes entram, com a posição de 4 dígitos como contexto", () => {
  const raw = [
    { codigo: "85.36", descricao: "Aparelhos para interrupção, seccionamento, proteção de circuitos elétricos", data_fim: "9999-12-31" },
    { codigo: "8536.20.00", descricao: "- Disjuntores", data_fim: "9999-12-31" },
    { codigo: "8536.20.00", descricao: "- Disjuntores (duplicado)", data_fim: "9999-12-31" },
    { codigo: "8536.10.00", descricao: "- Fusíveis e corta-circuitos de fusíveis", data_fim: "2020-01-01" },
    { codigo: "8511.80.20", descricao: "Reguladores de voltagem (conjuntores-disjuntores)", data_fim: "9999-12-31" },
  ];
  const items = parseNcmResponse(raw, "2026-11-14");
  assert.deepEqual(items.map((i) => i.code), ["8536.20.00", "8511.80.20"]);
  assert.match(items[0].description, /proteção de circuitos.*› Disjuntores$/);
  assert.equal(items[1].description, "Reguladores de voltagem (conjuntores-disjuntores)");
  assert.deepEqual(parseNcmResponse({ erro: 1 }), []);
});
