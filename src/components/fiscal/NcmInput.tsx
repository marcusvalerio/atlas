"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components/ui/Input";
import { apiGet } from "@/lib/api-client";
import { formatNcm, normalizeNcmQuery, type NcmItem } from "@/lib/fiscal/ncm-search";
import { cn } from "@/lib/cn";

// Campo de NCM com consulta à tabela oficial: digite o código ou uma palavra
// ("disjuntor") e escolha na lista. O valor salvo é o código formatado
// (8536.20.00); a descrição aparece abaixo para conferência.
export function NcmInput({
  value,
  onChange,
  readOnly,
  className,
  onPick,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Chamado quando a pessoa escolhe um item da tabela. */
  onPick?: (item: NcmItem) => void;
  readOnly?: boolean;
  className?: string;
}) {
  const [text, setText] = useState(value ?? "");
  const [items, setItems] = useState<NcmItem[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(-1);
  const [picked, setPicked] = useState<string | null>(null);
  const listId = useId();
  const seq = useRef(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setText(value ?? "");
  }, [value]);

  useEffect(() => {
    if (readOnly || !open) return;
    const q = normalizeNcmQuery(text);
    if (!q) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems([]);
      return;
    }
    const id = ++seq.current;
    const t = window.setTimeout(() => {
      setBusy(true);
      setError(null);
      apiGet<NcmItem[]>(`/api/ncm/search?q=${encodeURIComponent(q)}`)
        .then((r) => {
          if (id !== seq.current) return;
          setItems(r);
          setActive(r.length ? 0 : -1);
        })
        .catch((e: unknown) => id === seq.current && setError(e instanceof Error ? e.message : "Não foi possível consultar o NCM."))
        .finally(() => id === seq.current && setBusy(false));
    }, 300);
    return () => window.clearTimeout(t);
  }, [text, open, readOnly]);

  function choose(item: NcmItem) {
    setText(item.code);
    setPicked(item.description);
    onChange(item.code);
    onPick?.(item);
    setOpen(false);
  }

  const q = normalizeNcmQuery(text);
  return (
    <div className="relative">
      <Input
        className={cn("code", className)}
        value={text}
        readOnly={readOnly}
        placeholder="Código ou palavra (ex.: disjuntor)"
        role="combobox"
        aria-expanded={open && items.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        onFocus={() => !readOnly && setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          const v = e.target.value;
          setText(/^[\d.\s]*$/.test(v) ? formatNcm(v) : v);
          setPicked(null);
          setOpen(true);
          if (/^[\d.\s]*$/.test(v)) onChange(formatNcm(v));
        }}
        onKeyDown={(e) => {
          if (!open || !items.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
          else if (e.key === "Enter" && active >= 0) { e.preventDefault(); choose(items[active]); }
          else if (e.key === "Escape") setOpen(false);
        }}
      />
      {picked && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{picked}</p>}
      {open && !readOnly && q && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-lg border border-border bg-surface-raised shadow-lg">
          {busy && <p className="px-3 py-2 text-xs text-muted-foreground">Consultando a tabela de NCM…</p>}
          {error && <p className="px-3 py-2 text-xs text-danger-fg">{error}</p>}
          {!busy && !error && items.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum NCM de 8 dígitos encontrado. Tente outra palavra.</p>}
          {items.length > 0 && (
            <ul id={listId} role="listbox" className="py-1">
              {items.map((it, i) => (
                <li
                  key={it.digits}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => { e.preventDefault(); choose(it); }}
                  onMouseEnter={() => setActive(i)}
                  className={cn("flex cursor-pointer gap-3 px-3 py-2 text-sm", i === active && "bg-surface-hover")}
                >
                  <span className="code shrink-0 text-xs font-medium">{it.code}</span>
                  <span className="min-w-0 text-xs text-muted-foreground">{it.description}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
