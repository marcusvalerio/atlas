"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Segmented } from "@/components/ui/Controls";
import { EmptyState, Skeleton } from "@/components/ui/Feedback";
import { NoAccess } from "@/components/shell/ShellFrame";
import { useSession } from "@/components/shell/SessionProvider";
import { useCached } from "@/lib/dashboard/client";
import { formatCurrencyBRL, formatDate, formatInteger, formatPercent } from "@/lib/format";
import type { InventoryKpis, ItemKpi, ItemStatus } from "@/lib/inventory/kpis";

const num = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: digits });

const STATUS: Record<ItemStatus, { label: string; tone: Tone }> = {
  critico: { label: "Crítico", tone: "danger" },
  atencao: { label: "Atenção", tone: "warning" },
  excesso: { label: "Excesso", tone: "info" },
  sem_giro: { label: "Sem giro", tone: "neutral" },
  normal: { label: "Normal", tone: "success" },
};

type Card = {
  code: string;
  title: string;
  question: string;
  value: string;
  detail: string;
  formula: string;
  tone: Tone;
  reading: string;
};

function buildCards(k: InventoryKpis): Card[] {
  const d = k.settings.periodDays;
  return [
    {
      code: "8.2.1",
      title: "Prazo médio de estoque",
      question: "Quantos dias o material fica parado?",
      value: k.averageDays === null ? "—" : `${num(k.averageDays)} dias`,
      detail: `Estoque médio ${formatCurrencyBRL(k.averageStockValue)} · CMV ${formatCurrencyBRL(k.cmv)} em ${d} dias · giro ${num(k.turnover, 2)}×/ano`,
      formula: `PME = estoque médio ÷ CMV × ${d} dias`,
      tone: k.averageDays === null ? "neutral" : k.averageDays > 90 ? "warning" : "success",
      reading: "Prazo alto: dinheiro parado e risco de obsolescência. Baixo demais: risco de ruptura.",
    },
    {
      code: "8.2.2",
      title: "Nível de estoque mínimo",
      question: "Qual é a reserva de segurança?",
      value: `${formatInteger(k.belowMinimum)} abaixo`,
      detail: `${formatInteger(k.atReorderPoint)} no ponto de pedido · sugerido = consumo diário × ${num(k.settings.safetyDays, 0)} dias`,
      formula: "Mínimo = consumo médio diário × dias de segurança",
      tone: k.belowMinimum > 0 ? "danger" : "success",
      reading: "Saldo abaixo do mínimo: risco real de ruptura e reposição urgente.",
    },
    {
      code: "8.2.3",
      title: "Nível de estoque máximo",
      question: "Qual é o limite do estoque?",
      value: `${formatInteger(k.aboveMaximum)} acima`,
      detail: `${formatInteger(k.withoutParameters)} produto(s) sem mínimo, máximo nem ponto de reposição no cadastro`,
      formula: "Máximo = estoque mínimo + lote de compra",
      tone: k.aboveMaximum > 0 ? "warning" : "success",
      reading: "Saldo acima do máximo: capital parado, falta de espaço e risco de perdas.",
    },
    {
      code: "8.2.4",
      title: "Ruptura de estoque",
      question: "Quanto faltou?",
      value: formatPercent(k.stockoutPct),
      detail: `${formatInteger(k.stockoutItems)} em falta de ${formatInteger(k.activeItems)} itens ativos · nível de serviço ${formatPercent(k.serviceLevelPct)}`,
      formula: "Ruptura (%) = itens em falta ÷ itens ativos × 100",
      tone: k.stockoutPct === null ? "neutral" : k.stockoutPct > 3 ? "danger" : "success",
      reading: "Quanto maior, mais linha parada, venda perdida e cliente insatisfeito.",
    },
    {
      code: "8.2.5",
      title: "Custo de estoque",
      question: "Quanto custa manter?",
      value: `${formatCurrencyBRL(k.carryingCostYear)}/ano`,
      detail: `≈ ${formatCurrencyBRL(k.carryingCostMonth)} por mês · taxa de ${num(k.settings.carryingRate * 100, 1)}% ao ano`,
      formula: "Custo de manutenção = estoque médio (R$) × taxa anual",
      tone: "neutral",
      reading: "Estoque alto eleva o custo de manutenção; estoque baixo pode elevar o custo de falta.",
    },
    {
      code: "8.2.6",
      title: "Obsolescência de estoque",
      question: "Quanto perdeu uso?",
      value: formatPercent(k.obsoletePct),
      detail: `${formatCurrencyBRL(k.obsoleteValue)} de ${formatCurrencyBRL(k.totalValue)} sem saída há ${formatInteger(k.settings.obsoleteDays)} dias`,
      formula: "Obsolescência (%) = valor obsoleto ÷ valor total × 100",
      tone: k.obsoletePct === null ? "neutral" : k.obsoletePct > 5 ? "warning" : "success",
      reading: "Valor parado que tende a virar perda. Acompanhe o envelhecimento do saldo.",
    },
    {
      code: "8.2.7",
      title: "Índice de cobertura",
      question: "Quanto tempo o estoque dura?",
      value: k.coverageMonths === null ? "—" : `${num(k.coverageMonths)} meses`,
      detail: "Em valor, contra o consumo médio do período. Por item, na tabela abaixo.",
      formula: "Cobertura = estoque atual ÷ consumo médio mensal",
      tone: "neutral",
      reading: "Cobertura menor que o lead time: risco de ruptura. Muito maior: excesso.",
    },
    {
      code: "8.2.8",
      title: "Dias de estoque",
      question: "Dá tempo de repor?",
      value: k.stockDays === null ? "—" : `${num(k.stockDays)} dias`,
      detail: "Compare com lead time + segurança de cada item, na tabela abaixo.",
      formula: "Dias de estoque = estoque atual ÷ consumo médio diário",
      tone: "neutral",
      reading: "Dias de estoque menores que o lead time: o pedido chegará tarde.",
    },
    {
      code: "8.2.9",
      title: "Índice de avarias",
      question: "Quanto chegou danificado?",
      value: formatPercent(k.damagePct),
      detail: `${num(k.damagedQty, 2)} recusado(s) por qualidade de ${num(k.receivedQty, 2)} recebido(s) no período`,
      formula: "Avarias (%) = quantidade avariada ÷ movimentada × 100",
      tone: k.damagePct === null ? "neutral" : k.damagePct > 2 ? "warning" : "success",
      reading: "Perda direta de valor, retrabalho e reclamação. Rever embalagem, manuseio e fornecedor.",
    },
  ];
}

const TONE_TEXT: Partial<Record<Tone, string>> = {
  danger: "text-danger-fg",
  warning: "text-warning-fg",
  success: "text-success-fg",
};

function KpiCard({ card }: { card: Card }) {
  return (
    <Panel className="flex flex-col p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-2xs font-semibold tracking-label text-subtle-foreground uppercase">{card.code}</span>
        <span className="truncate text-xs text-muted-foreground">{card.question}</span>
      </div>
      <h3 className="mt-1 text-sm font-semibold text-foreground">{card.title}</h3>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${TONE_TEXT[card.tone] ?? "text-foreground"}`}>{card.value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{card.detail}</p>
      <p className="mt-3 rounded-md bg-muted/70 px-2.5 py-1.5 text-xs text-foreground">{card.formula}</p>
      <p className="mt-2 text-xs text-muted-foreground">{card.reading}</p>
    </Panel>
  );
}

type Filter = "todos" | ItemStatus;

export default function IndicadoresEstoquePage() {
  const { can } = useSession();
  const allowed = can("stock.view");
  const [dias, setDias] = useState("90");
  const [filter, setFilter] = useState<Filter>("todos");
  const res = useCached<InventoryKpis>(`/api/inventory/kpis?dias=${dias}`, allowed);
  const k = res.data;
  const cards = useMemo(() => (k ? buildCards(k) : []), [k]);
  const counts = useMemo(() => {
    const c: Record<ItemStatus, number> = { critico: 0, atencao: 0, excesso: 0, sem_giro: 0, normal: 0 };
    for (const i of k?.items ?? []) c[i.status]++;
    return c;
  }, [k]);
  const rows: ItemKpi[] = (k?.items ?? []).filter((i) => filter === "todos" || i.status === filter);

  if (!allowed) return <NoAccess description="Os indicadores de estoque exigem a permissão de consultar estoque." />;

  return (
    <>
      <PageHeader
        title="Indicadores de estoque"
        description="Os 9 KPIs do monitoramento de estoque, calculados com o que está lançado no ERP: medir, comparar com a meta, analisar e agir."
        actions={
          <Segmented
            label="Período do consumo"
            value={dias}
            onChange={setDias}
            options={[
              { value: "30", label: "30 dias" },
              { value: "90", label: "90 dias" },
              { value: "180", label: "180 dias" },
              { value: "360", label: "360 dias" },
            ]}
          />
        }
      />

      {res.loading && !k ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 9 }, (_, i) => <Skeleton key={i} className="h-52 w-full" />)}
        </div>
      ) : res.error ? (
        <EmptyState kind="error" title="Indicadores indisponíveis" description={res.error} onRetry={res.reload} />
      ) : k ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((c) => <KpiCard key={c.code} card={c} />)}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Período de {formatDate(k.period.start)} a {formatDate(k.period.end)}. A meta de cada indicador é definida pela empresa: compare sempre com a meta e com o histórico.
            Indicador bom depende de dado correto: lançamento errado gera indicador errado.
          </p>

          <Panel className="mt-6">
            <PanelHeader
              title="Gestão à vista por item"
              description="Cobertura, ponto de pedido e situação de cada produto ativo. Sem parâmetro no cadastro, o ERP usa o mínimo sugerido e calcula o ponto de pedido."
              actions={
                <Segmented<Filter>
                  label="Filtrar situação"
                  size="xs"
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { value: "todos", label: `Todos (${k.items.length})` },
                    { value: "critico", label: `Crítico (${counts.critico})` },
                    { value: "atencao", label: `Atenção (${counts.atencao})` },
                    { value: "excesso", label: `Excesso (${counts.excesso})` },
                    { value: "sem_giro", label: `Sem giro (${counts.sem_giro})` },
                    { value: "normal", label: `Normal (${counts.normal})` },
                  ]}
                />
              }
            />
            {rows.length === 0 ? (
              <EmptyState compact title="Nenhum item nesta situação" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-subtle text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Produto</th>
                      <th className="px-3 py-2 text-right font-medium">Saldo</th>
                      <th className="px-3 py-2 text-right font-medium">Consumo/dia</th>
                      <th className="px-3 py-2 text-right font-medium">Cobertura</th>
                      <th className="px-3 py-2 text-right font-medium">Lead time</th>
                      <th className="px-3 py-2 text-right font-medium">Mínimo</th>
                      <th className="px-3 py-2 text-right font-medium">Ponto de pedido</th>
                      <th className="px-3 py-2 text-right font-medium">Máximo</th>
                      <th className="px-3 py-2 font-medium">Situação</th>
                      <th className="px-3 py-2 font-medium">Ação sugerida</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((i) => (
                      <tr key={i.productId} className="border-b border-border-subtle last:border-0">
                        <td className="max-w-64 truncate px-3 py-2.5 text-foreground" title={i.label}>{i.label}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{num(i.onHand, 2)} {i.unit}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{num(i.dailyConsumption, 2)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{i.coverageDays === null ? "sem consumo" : `${num(i.coverageDays)} dias`}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{i.leadTime} dias</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{num(i.minimum, 2)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{num(i.reorderPoint, 2)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{i.maximum > 0 ? num(i.maximum, 2) : "—"}</td>
                        <td className="px-3 py-2.5"><Badge tone={STATUS[i.status].tone} dot>{STATUS[i.status].label}</Badge></td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{i.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
          <p className="mt-3 text-xs text-muted-foreground">
            Mínimo, máximo e ponto de reposição se ajustam no <Link className="underline" href="/app/cadastros/produtos">cadastro de produtos</Link>; o lead time vem do prazo do fornecedor do produto.
            Avarias contam os itens recusados por qualidade na conferência do recebimento.
          </p>
        </>
      ) : null}
    </>
  );
}
