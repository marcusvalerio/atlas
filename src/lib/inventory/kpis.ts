// Os 9 indicadores de monitoramento de estoque (Aula 1 · Monitoramento de
// estoque, tópico 8.2), calculados a partir do que o ERP já registra:
// saldo e custo médio, movimentos de custo do período, parâmetros do
// cadastro de produto (mínimo, máximo, ponto de reposição), prazo do
// fornecedor preferencial e conferência do recebimento.
//
// Funções puras: o handler lê o banco e entrega os dados prontos aqui.

/** Tipos de saída que representam consumo ou venda (base do CMV). */
export const CONSUMPTION_TYPES = new Set(["ISSUE", "PRODUCTION_OUT", "SCRAP"]);
export const INBOUND_TYPES = new Set(["RECEIPT", "TRANSFER_IN", "ADJUSTMENT_IN", "RETURN_IN", "PRODUCTION_IN"]);
export const OUTBOUND_TYPES = new Set(["ISSUE", "TRANSFER_OUT", "ADJUSTMENT_OUT", "RETURN_OUT", "PRODUCTION_OUT", "SCRAP"]);

export type KpiSettings = {
  /** Dias do período analisado (base do consumo médio). */
  periodDays: number;
  /** Taxa anual de manutenção do estoque (0,24 = 24% ao ano). */
  carryingRate: number;
  /** Dias de segurança para o mínimo sugerido. */
  safetyDays: number;
  /** Sem saída há este número de dias: obsoleto. */
  obsoleteDays: number;
  /** Lead time quando o produto não tem fornecedor com prazo. */
  defaultLeadTime: number;
  /** Cobertura acima disto (dias) é excesso, quando o item não tem máximo. */
  excessDays: number;
};

export const DEFAULT_SETTINGS: KpiSettings = {
  periodDays: 90,
  carryingRate: 0.24,
  safetyDays: 5,
  obsoleteDays: 365,
  defaultLeadTime: 7,
  excessDays: 60,
};

export type ProductInput = {
  id: string;
  label: string;
  unit: string;
  minimum: number;
  maximum: number;
  reorderPoint: number;
  leadTime: number | null;
};

export type CostMovementInput = { productId: string; type: string; quantity: number; totalCost: number; createdAt: string };

export type ItemStatus = "critico" | "atencao" | "normal" | "excesso" | "sem_giro";

export type ItemKpi = {
  productId: string;
  label: string;
  unit: string;
  onHand: number;
  value: number;
  dailyConsumption: number;
  coverageDays: number | null;
  leadTime: number;
  minimum: number;
  suggestedMinimum: number;
  reorderPoint: number;
  maximum: number;
  lastOutAt: string | null;
  obsolete: boolean;
  status: ItemStatus;
  action: string;
};

export type InventoryKpis = {
  settings: KpiSettings;
  period: { start: string; end: string };
  averageStockValue: number;
  cmv: number;
  /** 8.2.1 · estoque médio ÷ CMV × dias do período. */
  averageDays: number | null;
  turnover: number | null;
  /** 8.2.2 / 8.2.3 · itens fora dos níveis. */
  belowMinimum: number;
  atReorderPoint: number;
  aboveMaximum: number;
  withoutParameters: number;
  /** 8.2.4 · itens em falta ÷ itens ativos × 100. */
  activeItems: number;
  stockoutItems: number;
  stockoutPct: number | null;
  serviceLevelPct: number | null;
  /** 8.2.5 · estoque médio × taxa anual. */
  carryingCostYear: number;
  carryingCostMonth: number;
  /** 8.2.6 · valor obsoleto ÷ valor total × 100. */
  totalValue: number;
  obsoleteValue: number;
  obsoletePct: number | null;
  /** 8.2.7 · estoque atual ÷ consumo médio mensal (meses), em valor. */
  coverageMonths: number | null;
  /** 8.2.8 · estoque atual ÷ consumo médio diário (dias), em valor. */
  stockDays: number | null;
  /** 8.2.9 · quantidade avariada ÷ recebida × 100. */
  damagedQty: number;
  receivedQty: number;
  damagePct: number | null;
  items: ItemKpi[];
};

const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const pct = (num: number, den: number) => (den > 0 ? round((num / den) * 100, 2) : null);

export function computeInventoryKpis(input: {
  settings?: Partial<KpiSettings>;
  period: { start: string; end: string };
  products: ProductInput[];
  /** Saldo atual por produto (todas as posições somadas). */
  balances: Map<string, { quantity: number; value: number }>;
  /** Movimentos de custo do período. */
  movements: CostMovementInput[];
  /** Última saída de cada produto (qualquer data). */
  lastOut: Map<string, string>;
  receipts: { received: number; damaged: number };
  now?: Date;
}): InventoryKpis {
  const s: KpiSettings = { ...DEFAULT_SETTINGS, ...input.settings };
  const now = input.now ?? new Date();
  const days = Math.max(1, s.periodDays);

  let cmv = 0;
  let netFlow = 0;
  const consumed = new Map<string, number>();
  for (const m of input.movements) {
    if (CONSUMPTION_TYPES.has(m.type)) {
      cmv += m.totalCost;
      consumed.set(m.productId, (consumed.get(m.productId) ?? 0) + m.quantity);
    }
    if (INBOUND_TYPES.has(m.type)) netFlow += m.totalCost;
    else if (OUTBOUND_TYPES.has(m.type)) netFlow -= m.totalCost;
  }

  let totalValue = 0;
  for (const b of input.balances.values()) totalValue += b.value;
  // Estoque médio = (inicial + final) ÷ 2. O inicial é o final menos o que entrou e mais o que saiu no período.
  const initialValue = Math.max(0, totalValue - netFlow);
  const averageStockValue = (initialValue + totalValue) / 2;

  const obsoleteCut = now.getTime() - s.obsoleteDays * 86_400_000;
  const items: ItemKpi[] = [];
  let obsoleteValue = 0;
  let belowMinimum = 0;
  let atReorderPoint = 0;
  let aboveMaximum = 0;
  let withoutParameters = 0;
  let stockoutItems = 0;

  for (const p of input.products) {
    const bal = input.balances.get(p.id) ?? { quantity: 0, value: 0 };
    const daily = (consumed.get(p.id) ?? 0) / days;
    const leadTime = p.leadTime ?? s.defaultLeadTime;
    const suggestedMinimum = round(daily * s.safetyDays);
    const minimum = p.minimum > 0 ? p.minimum : suggestedMinimum;
    const reorderPoint = p.reorderPoint > 0 ? p.reorderPoint : round(daily * leadTime + minimum);
    const maximum = p.maximum;
    const coverageDays = daily > 0 ? round(bal.quantity / daily, 1) : null;
    const lastOutAt = input.lastOut.get(p.id) ?? null;
    const obsolete = bal.quantity > 0 && (!lastOutAt || new Date(lastOutAt).getTime() < obsoleteCut);
    if (obsolete) obsoleteValue += bal.value;
    if (p.minimum <= 0 && p.maximum <= 0 && p.reorderPoint <= 0) withoutParameters++;

    let status: ItemStatus;
    let action: string;
    if (bal.quantity <= 0) {
      stockoutItems++;
      status = "critico";
      action = "Em falta: compra urgente e revisar mínimo e lead time.";
    } else if (minimum > 0 && bal.quantity < minimum) {
      status = "critico";
      action = "Abaixo do mínimo: ação imediata de reposição.";
    } else if (reorderPoint > 0 && bal.quantity <= reorderPoint) {
      status = "atencao";
      action = "No ponto de pedido: emitir o pedido de compra agora.";
    } else if ((maximum > 0 && bal.quantity > maximum) || (coverageDays !== null && coverageDays > s.excessDays && maximum <= 0)) {
      status = "excesso";
      action = "Acima do máximo: suspender compras e usar o excedente.";
    } else if (obsolete) {
      status = "sem_giro";
      action = "Sem saída no prazo: liquidar, devolver ou reaproveitar.";
    } else {
      status = "normal";
      action = "Nenhuma ação.";
    }
    if (minimum > 0 && bal.quantity < minimum) belowMinimum++;
    else if (reorderPoint > 0 && bal.quantity <= reorderPoint && bal.quantity > 0) atReorderPoint++;
    if (maximum > 0 && bal.quantity > maximum) aboveMaximum++;

    items.push({
      productId: p.id,
      label: p.label,
      unit: p.unit,
      onHand: round(bal.quantity, 4),
      value: round(bal.value),
      dailyConsumption: round(daily, 3),
      coverageDays,
      leadTime,
      minimum: round(minimum),
      suggestedMinimum,
      reorderPoint: round(reorderPoint),
      maximum: round(maximum),
      lastOutAt,
      obsolete,
      status,
      action,
    });
  }

  const order: Record<ItemStatus, number> = { critico: 0, atencao: 1, excesso: 2, sem_giro: 3, normal: 4 };
  items.sort((a, b) => order[a.status] - order[b.status] || b.value - a.value);

  const dailyCmv = cmv / days;
  const activeItems = input.products.length;
  const stockoutPct = pct(stockoutItems, activeItems);
  return {
    settings: s,
    period: input.period,
    averageStockValue: round(averageStockValue),
    cmv: round(cmv),
    averageDays: cmv > 0 ? round((averageStockValue / cmv) * days, 1) : null,
    turnover: averageStockValue > 0 ? round((cmv / averageStockValue) * (360 / days), 2) : null,
    belowMinimum,
    atReorderPoint,
    aboveMaximum,
    withoutParameters,
    activeItems,
    stockoutItems,
    stockoutPct,
    serviceLevelPct: stockoutPct === null ? null : round(100 - stockoutPct, 2),
    carryingCostYear: round(averageStockValue * s.carryingRate),
    carryingCostMonth: round((averageStockValue * s.carryingRate) / 12),
    totalValue: round(totalValue),
    obsoleteValue: round(obsoleteValue),
    obsoletePct: pct(obsoleteValue, totalValue),
    coverageMonths: dailyCmv > 0 ? round(totalValue / (dailyCmv * 30), 1) : null,
    stockDays: dailyCmv > 0 ? round(totalValue / dailyCmv, 1) : null,
    damagedQty: round(input.receipts.damaged, 4),
    receivedQty: round(input.receipts.received, 4),
    damagePct: pct(input.receipts.damaged, input.receipts.received),
    items,
  };
}
