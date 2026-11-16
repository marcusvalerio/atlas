"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ExternalLink, LayoutGrid, LogOut, Menu, Moon, Search, Sun, X } from "lucide-react";
import { AtlasIcon } from "@/components/brand/GalaxyMark";
import { SessionProvider, useSession } from "@/components/shell/SessionProvider";
import { CommandMenu } from "@/components/shell/CommandMenu";
import { LogoutForm } from "@/components/auth/LogoutButton";
import { ERP_NAV, type NavSection } from "@/lib/nav";
import { initials, visibleSections } from "@/lib/navigation/access";

// Moldura do Beta: sidebar com navegação em pílula e topbar com a busca
// (⌘K). O menu é o mesmo do ERP, filtrado pelas mesmas permissões; os
// itens levam às telas atuais (/app/...), que seguem sem alteração.

function SidebarNav({ sections, onNavigate }: { sections: NavSection[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <nav aria-label="Menu do Beta" className="flex flex-col gap-1">
      <Link href="/beta" onClick={onNavigate} className="bx-nav-item" aria-current={pathname === "/beta" ? "page" : undefined}>
        <Sun size={17} aria-hidden /> Hoje
      </Link>
      <p className="bx-meta mt-3 mb-1 px-3">Módulos</p>
      {sections
        .filter((s) => s.href !== "/app")
        .map((s) => {
          const Icon = s.icon;
          const open = openId === s.id;
          return (
            <div key={s.id}>
              <button type="button" className="bx-nav-item w-full text-left" aria-expanded={open} onClick={() => setOpenId(open ? null : s.id)}>
                <Icon size={17} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{s.label}</span>
                <ChevronDown size={14} aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`} />
              </button>
              {open && (
                <ul className="mt-0.5 mb-1 ml-5 flex flex-col border-l border-[var(--bx-line)] pl-2">
                  {s.items.map((item) => (
                    <li key={item.href}>
                      <Link href={item.href} onClick={onNavigate} className="flex h-[30px] items-center rounded-full px-3 text-[13px] text-[var(--bx-muted)] hover:bg-[var(--bx-havana-soft)] hover:text-[var(--bx-ink)]">
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/beta" className="flex items-center gap-2.5 px-2">
      <AtlasIcon size={34} />
      <span className="flex flex-col leading-tight">
        <span className="bx-title text-[21px]">atlas</span>
        <span className="text-[11px] font-semibold tracking-wide text-[var(--bx-gold-ink)]">BETA</span>
      </span>
    </Link>
  );
}

const THEME_KEY = "atlas-beta-theme";

/** Claro por padrão; o escuro (grafite) é escolha do usuário e fica salvo neste navegador. */
function useBetaTheme(): [boolean, () => void] {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(THEME_KEY);
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(saved === "dark");
  }, []);
  useEffect(() => {
    const root = document.querySelector(".beta-root");
    if (dark) root?.setAttribute("data-theme", "dark");
    else root?.removeAttribute("data-theme");
  }, [dark]);
  const toggle = () =>
    setDark((d) => {
      try {
        localStorage.setItem(THEME_KEY, d ? "light" : "dark");
      } catch {}
      return !d;
    });
  return [dark, toggle];
}

function Frame({ children }: { children: ReactNode }) {
  const { status, data, can } = useSession();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const pathname = usePathname();
  const [dark, toggleTheme] = useBetaTheme();
  const screens = data?.tenant?.screens ?? null;
  const sections = useMemo(() => visibleSections(ERP_NAV, can, screens), [can, screens]);

  useEffect(() => {
    // Fecha a gaveta do celular ao trocar de página.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMenu(false);
  }, [pathname]);

  const tenant = data?.tenant;
  const name = tenant?.user.name ?? data?.authUser.email ?? "";

  if (status === "loading") {
    return <div className="grid min-h-dvh place-items-center text-[var(--bx-muted)]">Carregando…</div>;
  }
  if (!tenant) {
    return (
      <div className="grid min-h-dvh place-items-center p-4">
        <div className="bx-card max-w-sm p-6 text-center">
          <p className="bx-title text-lg">Sem empresa ativa</p>
          <p className="mt-2 text-[var(--bx-muted)]">O Beta usa a empresa do seu login. Entre pelo ERP para concluir o acesso.</p>
          <Link href="/app" className="bx-btn bx-btn-primary mt-4">Abrir o ERP</Link>
        </div>
      </div>
    );
  }

  const sidebar = (
    <div className="flex h-full flex-col gap-4 p-3">
      <Brand />
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <SidebarNav sections={sections} onNavigate={() => setMenu(false)} />
      </div>
      <div className="flex flex-col gap-1 border-t border-[var(--bx-line)] pt-3">
        <Link href="/app" className="bx-nav-item text-[13px]">
          <LayoutGrid size={16} aria-hidden /> Versão atual do ERP
        </Link>
        <LogoutForm>
          <button type="submit" className="bx-nav-item w-full text-[13px]">
            <LogOut size={16} aria-hidden /> Sair
          </button>
        </LogoutForm>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 lg:block">{sidebar}</aside>

      {menu && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Fechar menu" className="absolute inset-0 bg-[var(--bx-scrim)]" onClick={() => setMenu(false)} />
          <div className="absolute inset-y-0 left-0 w-[min(18rem,86vw)] bg-[var(--bx-bg)] pt-[env(safe-area-inset-top,0px)] shadow-xl">
            <button type="button" aria-label="Fechar menu" className="bx-btn bx-btn-ghost absolute top-3 right-3 size-9 p-0" onClick={() => setMenu(false)}>
              <X size={18} />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 bg-[var(--bx-header)] px-4 pt-[calc(env(safe-area-inset-top,0px)+12px)] pb-3 backdrop-blur sm:px-6 lg:px-8">
          <button type="button" aria-label="Abrir menu" className="bx-btn bx-btn-secondary size-10 p-0 lg:hidden" onClick={() => setMenu(true)}>
            <Menu size={18} />
          </button>
          <button
            type="button"
            onClick={() => setSearch(true)}
            className="bx-card flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full px-4 text-left text-[var(--bx-subtle)] sm:max-w-md"
          >
            <Search size={16} aria-hidden />
            <span className="min-w-0 flex-1 truncate">Buscar telas e ações…</span>
            <kbd className="bx-meta hidden sm:inline">⌘K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-3">
            <button type="button" onClick={toggleTheme} aria-label={dark ? "Usar tema claro" : "Usar tema escuro"} aria-pressed={dark} className="bx-btn bx-btn-secondary size-10 p-0">
              {dark ? <Sun size={17} aria-hidden /> : <Moon size={17} aria-hidden />}
            </button>
            <div className="hidden text-right sm:block">
              <p className="text-[13px] font-semibold text-[var(--bx-ink)]">{name}</p>
              <p className="bx-meta">{tenant.company.name}</p>
            </div>
            <span aria-hidden className="grid size-10 place-items-center rounded-full bg-[var(--bx-ink)] text-[13px] font-semibold text-[var(--bx-bg)]">
              {initials(name)}
            </span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+32px)] sm:px-6 lg:px-8">{children}</main>
        <footer className="px-4 pb-6 text-center sm:px-6">
          <Link href="/app" className="bx-meta inline-flex items-center gap-1 hover:text-[var(--bx-ink)]">
            Abrir a versão atual <ExternalLink size={11} aria-hidden />
          </Link>
        </footer>
      </div>

      <CommandMenu open={search} onOpenChange={setSearch} sections={[{ id: "beta", label: "Beta", icon: Sun, href: "/beta", group: "overview", description: "", items: [{ label: "Hoje (Beta)", href: "/beta" }] }, ...sections]} />
    </div>
  );
}

export function BetaShell({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <Frame>{children}</Frame>
    </SessionProvider>
  );
}
