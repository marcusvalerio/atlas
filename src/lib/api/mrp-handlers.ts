import "server-only";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext, hasPermission } from "@/lib/auth/context";
import { forbiddenError, translatePostgresError, unauthorizedError } from "@/lib/database/errors";
import { jsonError } from "./response";
import { computeMrp, type MrpInput, type MrpProduct } from "@/lib/production/mrp";

// MRP: lê os dados da empresa (somente leitura, já filtrados por company_id)
// e calcula as necessidades em lib/production/mrp. Nada é gravado aqui: as
// sugestões viram solicitação de compra ou ordem de produção pelas rotas
// que já existem, com as permissões de cada uma.

const OPEN_SALES = ["approved", "reservation_pending", "reserved", "picking", "ready_to_ship"];
const OPEN_PURCHASES = ["approved", "sent", "partially_received"];
const OPEN_PRODUCTION = ["planned", "released", "materials_reserved", "in_progress", "on_hold"];

const n = (v: unknown) => Number(v) || 0;
type Row = Record<string, unknown>;

async function rows(query: PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>): Promise<Row[]> {
  const { data, error } = await query;
  if (error) throw translatePostgresError(error);
  return (data as Row[] | null) ?? [];
}

export async function loadMrpInput(companyId: string): Promise<MrpInput> {
  const db = createAdminClient();
  const [products, balances, sales, purchases, orders, boms] = await Promise.all([
    rows(db.from("products").select("id, code, name, unit, minimum_stock, production_type, status").eq("company_id", companyId)),
    rows(db.from("stock_balances").select("product_id, on_hand").eq("company_id", companyId)),
    rows(db.from("sales_orders").select("id, code, expected_delivery_at").eq("company_id", companyId).in("status", OPEN_SALES)),
    rows(db.from("purchase_orders").select("id, code").eq("company_id", companyId).in("status", OPEN_PURCHASES)),
    rows(db.from("production_orders").select("id, code, product_id, planned_quantity, produced_quantity, planned_date").eq("company_id", companyId).in("status", OPEN_PRODUCTION)),
    rows(db.from("product_boms").select("id, product_id, reference_quantity, version, valid_from, valid_until").eq("company_id", companyId).eq("status", "active")),
  ]);
  const ids = (list: Row[]) => list.map((r) => r.id as string);
  const today = new Date().toISOString().slice(0, 10);
  const validBoms = boms
    .filter((b) => (!b.valid_from || String(b.valid_from) <= today) && (!b.valid_until || String(b.valid_until) >= today))
    .sort((a, b) => n(b.version) - n(a.version));
  const bomByProduct = new Map<string, Row>();
  for (const b of validBoms) if (!bomByProduct.has(b.product_id as string)) bomByProduct.set(b.product_id as string, b);

  const [saleItems, purchaseItems, materials, bomItems] = await Promise.all([
    sales.length ? rows(db.from("sales_order_items").select("order_id, product_id, ordered_quantity, shipped_quantity, cancelled_quantity").eq("company_id", companyId).in("order_id", ids(sales))) : [],
    purchases.length ? rows(db.from("purchase_order_items").select("order_id, product_id, ordered_quantity, received_quantity, cancelled_quantity").eq("company_id", companyId).in("order_id", ids(purchases))) : [],
    orders.length ? rows(db.from("production_order_materials").select("production_order_id, component_product_id, planned_quantity, consumed_quantity, status").eq("company_id", companyId).in("production_order_id", ids(orders))) : [],
    bomByProduct.size ? rows(db.from("product_bom_items").select("bom_id, component_product_id, quantity, scrap_percentage, is_optional").eq("company_id", companyId).in("bom_id", [...bomByProduct.values()].map((b) => b.id as string))) : [],
  ]);

  const saleById = new Map(sales.map((s) => [s.id as string, s]));
  const purchaseById = new Map(purchases.map((p) => [p.id as string, p]));
  const orderById = new Map(orders.map((o) => [o.id as string, o]));
  const onHand: Record<string, number> = {};
  for (const b of balances) onHand[b.product_id as string] = (onHand[b.product_id as string] ?? 0) + n(b.on_hand);

  const mrpProducts: MrpProduct[] = products
    .filter((p) => p.status !== "inactive")
    .map((p) => ({
      id: p.id as string,
      code: String(p.code ?? ""),
      name: String(p.name ?? ""),
      unit: (p.unit as string | null) ?? null,
      minimumStock: n(p.minimum_stock),
      productionType: (["manufactured", "both"].includes(String(p.production_type)) ? p.production_type : "purchased") as MrpProduct["productionType"],
    }));

  return {
    products: mrpProducts,
    onHand,
    salesDemand: saleItems
      .filter((i) => i.product_id)
      .map((i) => {
        const so = saleById.get(i.order_id as string);
        return { productId: i.product_id as string, quantity: n(i.ordered_quantity) - n(i.shipped_quantity) - n(i.cancelled_quantity), dueDate: (so?.expected_delivery_at as string | null) ?? null, source: String(so?.code ?? "Pedido") };
      }),
    productionDemand: materials
      .filter((m) => m.status !== "cancelled" && m.status !== "consumed")
      .map((m) => {
        const po = orderById.get(m.production_order_id as string);
        return { productId: m.component_product_id as string, quantity: n(m.planned_quantity) - n(m.consumed_quantity), dueDate: (po?.planned_date as string | null) ?? null, source: String(po?.code ?? "OP") };
      }),
    scheduledReceipts: [
      ...purchaseItems
        .filter((i) => i.product_id)
        .map((i) => ({ productId: i.product_id as string, quantity: n(i.ordered_quantity) - n(i.received_quantity) - n(i.cancelled_quantity), source: String(purchaseById.get(i.order_id as string)?.code ?? "PC") })),
      ...orders.map((o) => ({ productId: o.product_id as string, quantity: n(o.planned_quantity) - n(o.produced_quantity), source: String(o.code ?? "OP") })),
    ],
    boms: [...bomByProduct.values()].map((b) => ({
      productId: b.product_id as string,
      referenceQuantity: n(b.reference_quantity) || 1,
      items: bomItems
        .filter((i) => i.bom_id === b.id && !i.is_optional)
        .map((i) => ({ componentId: i.component_product_id as string, quantity: n(i.quantity), scrapPercentage: n(i.scrap_percentage) })),
    })),
  };
}

export async function getMrp() {
  try {
    const ctx = await getAuthContext();
    if (!ctx) throw unauthorizedError();
    const allowed = (await hasPermission(ctx.companyId, "production_orders.view")) || (await hasPermission(ctx.companyId, "purchase_requests.view"));
    if (!allowed) throw forbiddenError("production_orders.view");
    const input = await loadMrpInput(ctx.companyId);
    const lines = computeMrp(input);
    // Para gerar a OP com um clique: armazéns e locais da última ordem do mesmo produto.
    const produceIds = lines.filter((l) => l.action === "produce").map((l) => l.productId);
    const defaults: Record<string, Row> = {};
    if (produceIds.length) {
      const last = await rows(
        createAdminClient()
          .from("production_orders")
          .select("product_id, bom_id, unit_id, source_warehouse_id, consumption_location_id, target_warehouse_id, output_location_id, created_at")
          .eq("company_id", ctx.companyId)
          .in("product_id", produceIds)
          .order("created_at", { ascending: false })
      );
      for (const o of last) if (!defaults[o.product_id as string]) defaults[o.product_id as string] = o;
    }
    const withDefaults = lines.map((l) => {
      const d = defaults[l.productId];
      return {
        ...l,
        productionDefaults: d
          ? { bomId: d.bom_id, unitId: d.unit_id, sourceWarehouseId: d.source_warehouse_id, consumptionLocationId: d.consumption_location_id, targetWarehouseId: d.target_warehouse_id, outputLocationId: d.output_location_id }
          : null,
      };
    });
    return NextResponse.json({ success: true, data: { calculatedAt: new Date().toISOString(), lines: withDefaults } });
  } catch (error) {
    return jsonError(error);
  }
}
