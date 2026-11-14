"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw, ShoppingCart, Factory } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Stat, StatStrip } from "@/components/ui/Stat";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/Feedback";
import { toast } from "@/components/ui/Toast";
import { useSession } from "@/components/shell/SessionProvider";
import { apiGet, apiSend } from "@/lib/api-client";
import type { MrpLine } from "@/lib/production/mrp";

type Defaults = { bomId: string | null; unitId: string; sourceWarehouseId: string; consumptionLocationId: string; targetWarehouseId: string; outputLocationId: string } | null;
type Line = MrpLine & { productionDefaults: Defaults };
type Data = { calculatedAt: string; lines: Line[] };

const qty = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const day = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR") : "—");

export default function MrpPage() {
  const { can } = useSession();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "buy" | "produce">("all");

  const load = useCallback(() => {
    setError(null);
    apiGet<Data>("/api/mrp")
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Não foi possível calcular o MRP."));
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const lines = useMemo(() => (data?.lines ?? []).filter((l) => filter === "all" || l.action === filter), [data, filter]);
  const buy = (data?.lines ?? []).filter((l) => l.action === "buy");
  const produce = (data?.lines ?? []).filter((l) => l.action === "produce");
  const today = new Date().toISOString().slice(0, 10);
  const late = (data?.lines ?? []).filter((l) => l.needBy && l.needBy < today).length;

  async function requestPurchase(items: Line[]) {
    if (!items.length) return;
    setBusy("buy");
    try {
      const needBy = items.map((l) => l.needBy).filter(Boolean).sort()[0] ?? undefined;
      const res = await apiSend<{ code?: string }>("/api/purchase-requests", "POST", {
        priority: late ? "high" : "medium",
        justification: "Gerada pelo MRP a partir das necessidades líquidas.",
        neededBy: needBy,
        items: items.map((l) => ({ productId: l.productId, description: `${l.code} · ${l.name}`, unit: l.unit ?? undefined, quantity: Math.ceil(l.netRequirement), notes: l.sources.join(", ") || undefined })),
      });
      toast.success(`Solicitação de compra ${res?.code ?? ""} criada com ${items.length} ${items.length === 1 ? "item" : "itens"}.`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar a solicitação.");
    } finally {
      setBusy(null);
    }
  }

  async function createProductionOrder(l: Line) {
    const d = l.productionDefaults;
    if (!d) return;
    setBusy(l.productId);
    try {
      const res = await apiSend<{ code?: string }>("/api/production-orders", "POST", {
        productId: l.productId,
        bomId: d.bomId ?? undefined,
        plannedQuantity: Math.ceil(l.netRequirement),
        unitId: d.unitId,
        sourceWarehouseId: d.sourceWarehouseId,
        consumptionLocationId: d.consumptionLocationId,
        targetWarehouseId: d.targetWarehouseId,
        outputLocationId: d.outputLocationId,
        priority: l.needBy && l.needBy < today ? "urgent" : "high",
        plannedDate: l.needBy ?? undefined,
        notes: `Gerada pelo MRP. Demanda: ${l.sources.join(", ")}`,
      });
      toast.success(`Ordem de produção ${res?.code ?? ""} criada.`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar a ordem de produção.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Produção"
        title="Planejamento de materiais (MRP)"
        description="O que falta comprar e produzir para atender os pedidos em aberto, a estrutura dos produtos e o estoque mínimo."
        actions={
          <Button variant="secondary" size="sm" onClick={load}>
            <RefreshCw size={14} aria-hidden /> Recalcular
          </Button>
        }
      />

      {error && <Alert tone="danger">{error}</Alert>}

      <StatStrip columns={4}>
        <Stat label="Itens com necessidade" value={data ? String(data.lines.length) : "…"} loading={!data && !error} />
        <Stat label="Para comprar" value={data ? String(buy.length) : "…"} loading={!data && !error} />
        <Stat label="Para produzir" value={data ? String(produce.length) : "…"} loading={!data && !error} />
        <Stat label="Já atrasados" value={data ? String(late) : "…"} tone={late ? "danger" : "neutral"} loading={!data && !error} />
      </StatStrip>

      <Panel>
        <PanelHeader
          title="Necessidades líquidas"
          description={data ? `Calculado em ${new Date(data.calculatedAt).toLocaleString("pt-BR")}. Necessidade = demanda + estoque mínimo − estoque − a receber.` : "Calculando…"}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg border border-border p-0.5 text-xs" role="group" aria-label="Filtrar">
                {(["all", "buy", "produce"] as const).map((f) => (
                  <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={`rounded-md px-2.5 py-1 ${filter === f ? "bg-surface-hover font-semibold text-foreground" : "text-muted-foreground"}`}>
                    {f === "all" ? "Tudo" : f === "buy" ? "Comprar" : "Produzir"}
                  </button>
                ))}
              </div>
              {can("purchase_requests.create") && buy.length > 0 && (
                <Button size="sm" loading={busy === "buy"} onClick={() => requestPurchase(buy)}>
                  <ShoppingCart size={14} aria-hidden /> Gerar solicitação de compra ({buy.length})
                </Button>
              )}
            </div>
          }
        />
        {!data && !error ? (
          <SkeletonRows rows={5} columns={7} />
        ) : lines.length === 0 ? (
          <EmptyState title="Nada a planejar" description="Pedidos em aberto, estoque e entradas previstas estão equilibrados. Recalcule quando entrar um novo pedido." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border-subtle">
                  <th className="px-4 py-2 font-medium">Produto</th>
                  <th className="px-3 py-2 font-medium">Ação</th>
                  <th className="px-3 py-2 text-right font-medium">Demanda</th>
                  <th className="px-3 py-2 text-right font-medium">Estoque</th>
                  <th className="px-3 py-2 text-right font-medium">A receber</th>
                  <th className="px-3 py-2 text-right font-medium">Mínimo</th>
                  <th className="px-3 py-2 text-right font-medium">Necessidade</th>
                  <th className="px-3 py-2 font-medium">Precisa até</th>
                  <th className="px-4 py-2 font-medium">Origem</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.productId} className="border-b border-border-subtle last:border-0 align-top">
                    <td className="px-4 py-2.5">
                      <span className="code text-xs font-semibold">{l.code}</span>
                      <span className="block text-foreground" style={{ paddingLeft: l.level * 12 }}>{l.level > 0 ? "↳ " : ""}{l.name}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      {l.action === "produce" ? <Badge tone="info" icon={<Factory size={12} />}>Produzir</Badge> : <Badge tone="accent" icon={<ShoppingCart size={12} />}>Comprar</Badge>}
                    </td>
                    <td className="px-3 py-2.5 text-right">{qty(l.grossDemand + l.dependentDemand)}</td>
                    <td className="px-3 py-2.5 text-right">{qty(l.onHand)}</td>
                    <td className="px-3 py-2.5 text-right">{qty(l.scheduled)}</td>
                    <td className="px-3 py-2.5 text-right">{qty(l.minimumStock)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold">{qty(l.netRequirement)} {l.unit ?? ""}</td>
                    <td className={`px-3 py-2.5 ${l.needBy && l.needBy < today ? "font-semibold text-danger-fg" : ""}`}>{day(l.needBy)}{l.needBy && l.needBy < today ? " · atrasado" : ""}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      <span className="block max-w-56">{l.sources.length ? l.sources.join(", ") : "Estoque mínimo"}</span>
                      {l.action === "produce" && can("production_orders.create") && (
                        l.productionDefaults ? (
                          <Button className="mt-1.5" variant="secondary" size="sm" loading={busy === l.productId} onClick={() => createProductionOrder(l)}>
                            Criar ordem de produção
                          </Button>
                        ) : (
                          <Link href="/app/producao/ordens" className="mt-1.5 inline-block text-xs font-medium text-foreground underline">Criar a primeira OP deste produto</Link>
                        )
                      )}
                      {l.action === "buy" && can("purchase_requests.create") && (
                        <Button className="mt-1.5" variant="ghost" size="sm" loading={busy === "buy"} onClick={() => requestPurchase([l])}>
                          Solicitar compra
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
