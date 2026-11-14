// MRP — planejamento de necessidades de materiais.
//
// Para cada produto:
//   demanda bruta  = pedidos de venda em aberto (o que falta expedir)
//                  + consumo dos componentes pelas ordens de produção em aberto
//                  + demanda dependente gerada aqui mesmo (explosão da BOM)
//   necessidade    = demanda bruta + estoque mínimo − estoque físico − a receber
//   a receber      = pedidos de compra em aberto (falta receber)
//                  + ordens de produção em aberto (falta produzir)
// Produto fabricado (com estrutura ativa) vira sugestão de PRODUZIR e explode
// os componentes; o resto vira sugestão de COMPRAR. Cálculo puro, sem banco.

export type MrpProduct = {
  id: string;
  code: string;
  name: string;
  unit: string | null;
  minimumStock: number;
  productionType: "purchased" | "manufactured" | "both";
};

export type MrpBom = { productId: string; referenceQuantity: number; items: { componentId: string; quantity: number; scrapPercentage: number }[] };

export type MrpInput = {
  products: MrpProduct[];
  /** Estoque físico (on hand) por produto. */
  onHand: Record<string, number>;
  /** Demanda independente: pedidos de venda em aberto. */
  salesDemand: { productId: string; quantity: number; dueDate: string | null; source: string }[];
  /** Consumo ainda pendente dos componentes de ordens de produção em aberto. */
  productionDemand: { productId: string; quantity: number; dueDate: string | null; source: string }[];
  /** Entradas previstas: compras e ordens de produção em aberto. */
  scheduledReceipts: { productId: string; quantity: number; source: string }[];
  /** Estrutura ativa por produto fabricado. */
  boms: MrpBom[];
};

export type MrpAction = "produce" | "buy";

export type MrpLine = {
  productId: string;
  code: string;
  name: string;
  unit: string | null;
  action: MrpAction;
  grossDemand: number;
  dependentDemand: number;
  onHand: number;
  scheduled: number;
  minimumStock: number;
  netRequirement: number;
  /** Data mais cedo em que a demanda vence (ou null). */
  needBy: string | null;
  /** De onde vem a demanda: pedidos e ordens. */
  sources: string[];
  /** Nível na estrutura (0 = produto vendido; 1+ = componente). */
  level: number;
};

const r4 = (n: number) => Math.round(n * 10000) / 10000;
const earlier = (a: string | null, b: string | null) => (!a ? b : !b ? a : a < b ? a : b);

export function computeMrp(input: MrpInput): MrpLine[] {
  const products = new Map(input.products.map((p) => [p.id, p]));
  const boms = new Map(input.boms.filter((b) => b.items.length > 0).map((b) => [b.productId, b]));

  // Nível mais baixo de cada produto (low-level code): processa pais antes dos componentes.
  const level = new Map<string, number>();
  const visit = (id: string, lv: number, path: Set<string>) => {
    if (path.has(id)) return; // estrutura circular: ignora o ciclo
    if ((level.get(id) ?? -1) >= lv) return;
    level.set(id, lv);
    const bom = boms.get(id);
    if (!bom) return;
    path.add(id);
    for (const it of bom.items) visit(it.componentId, lv + 1, path);
    path.delete(id);
  };
  for (const p of input.products) visit(p.id, 0, new Set());

  type Acc = { gross: number; dependent: number; needBy: string | null; sources: Set<string> };
  const acc = new Map<string, Acc>();
  const get = (id: string) => {
    let a = acc.get(id);
    if (!a) acc.set(id, (a = { gross: 0, dependent: 0, needBy: null, sources: new Set() }));
    return a;
  };
  for (const d of [...input.salesDemand, ...input.productionDemand]) {
    if (!(d.quantity > 0)) continue;
    const a = get(d.productId);
    a.gross += d.quantity;
    a.needBy = earlier(a.needBy, d.dueDate);
    a.sources.add(d.source);
  }
  const scheduled = new Map<string, number>();
  for (const s of input.scheduledReceipts) if (s.quantity > 0) scheduled.set(s.productId, (scheduled.get(s.productId) ?? 0) + s.quantity);

  const order = [...products.keys()].sort((a, b) => (level.get(a) ?? 0) - (level.get(b) ?? 0));
  const lines: MrpLine[] = [];
  for (const id of order) {
    const p = products.get(id)!;
    const a = acc.get(id);
    const demand = (a?.gross ?? 0) + (a?.dependent ?? 0);
    const onHand = input.onHand[id] ?? 0;
    const sched = scheduled.get(id) ?? 0;
    const net = r4(demand + p.minimumStock - onHand - sched);
    if (net <= 0) continue;
    const bom = boms.get(id);
    const action: MrpAction = bom && p.productionType !== "purchased" ? "produce" : "buy";
    lines.push({
      productId: id,
      code: p.code,
      name: p.name,
      unit: p.unit,
      action,
      grossDemand: r4(a?.gross ?? 0),
      dependentDemand: r4(a?.dependent ?? 0),
      onHand: r4(onHand),
      scheduled: r4(sched),
      minimumStock: p.minimumStock,
      netRequirement: net,
      needBy: a?.needBy ?? null,
      sources: [...(a?.sources ?? [])].sort(),
      level: level.get(id) ?? 0,
    });
    if (action === "produce" && bom) {
      for (const it of bom.items) {
        if (!products.has(it.componentId)) continue;
        const qty = (net / bom.referenceQuantity) * it.quantity / (1 - it.scrapPercentage / 100);
        const c = get(it.componentId);
        c.dependent += qty;
        c.needBy = earlier(c.needBy, a?.needBy ?? null);
        c.sources.add(`Produzir ${p.code}`);
      }
    }
  }
  return lines.sort((x, y) => x.level - y.level || (x.needBy ?? "9999").localeCompare(y.needBy ?? "9999") || x.code.localeCompare(y.code));
}
