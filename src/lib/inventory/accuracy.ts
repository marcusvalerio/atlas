// Acuracidade do inventário, calculada só a partir das contagens gravadas
// (stock_count_items). Nada é estimado: um item sem contagem não entra.
//
//   por itens  = itens que bateram ÷ itens contados
//   por valor  = 1 − Σ|diferença| × custo ÷ Σ esperado × custo
//
// O custo é o custo médio do produto; sem custo, o item pesa só na conta
// por itens.

export type CountItemInput = {
  product_id: string;
  expected_quantity: number | string | null;
  counted_quantity: number | string | null;
};

export type VarianceLine = {
  productId: string;
  expected: number;
  counted: number;
  variance: number;
  unitCost: number;
  varianceValue: number;
};

export type CountAccuracy = {
  totalItems: number;
  countedItems: number;
  matchedItems: number;
  /** % de itens contados que bateram; null sem item contado. */
  itemAccuracy: number | null;
  /** % do valor esperado que estava certo; null sem custo conhecido. */
  valueAccuracy: number | null;
  /** Soma das diferenças em valor, com sinal (negativo = falta). */
  netVarianceValue: number;
  /** Diferenças ordenadas da maior para a menor em valor absoluto. */
  variances: VarianceLine[];
};

const n = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

const round1 = (x: number) => Math.round(x * 10) / 10;

/** Meta usual de mercado para acuracidade de inventário. */
export const ACCURACY_TARGET = 95;

export function computeCountAccuracy(items: CountItemInput[], unitCost: (productId: string) => number): CountAccuracy {
  let counted = 0;
  let matched = 0;
  let expectedValue = 0;
  let absVarianceValue = 0;
  let netVarianceValue = 0;
  const variances: VarianceLine[] = [];

  for (const item of items) {
    if (item.counted_quantity === null || item.counted_quantity === undefined || item.counted_quantity === "") continue;
    counted += 1;
    const expected = n(item.expected_quantity);
    const got = n(item.counted_quantity);
    const variance = Math.round((got - expected) * 10000) / 10000;
    const cost = Math.max(0, n(unitCost(item.product_id)));
    expectedValue += expected * cost;
    if (variance === 0) {
      matched += 1;
      continue;
    }
    const value = variance * cost;
    absVarianceValue += Math.abs(value);
    netVarianceValue += value;
    variances.push({ productId: item.product_id, expected, counted: got, variance, unitCost: cost, varianceValue: value });
  }

  variances.sort((a, b) => Math.abs(b.varianceValue) - Math.abs(a.varianceValue) || Math.abs(b.variance) - Math.abs(a.variance));

  return {
    totalItems: items.length,
    countedItems: counted,
    matchedItems: matched,
    itemAccuracy: counted ? round1((matched / counted) * 100) : null,
    valueAccuracy: expectedValue > 0 ? round1(Math.max(0, 1 - absVarianceValue / expectedValue) * 100) : null,
    netVarianceValue: Math.round(netVarianceValue * 100) / 100,
    variances,
  };
}
