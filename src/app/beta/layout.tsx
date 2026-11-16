import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Gabarito, Inter } from "next/font/google";
import { getSessionIdentity } from "@/lib/auth/session";
import { BetaShell } from "@/components/beta/BetaShell";
import "./beta.css";

// Beta (/beta): identidade nova (grafite e ouro) sobre o MESMO login, banco
// e permissões. Aberto a qualquer conta com acesso ao ERP; os dados vêm das
// APIs atuais com a sessão do usuário (RLS) e os itens do menu levam às
// telas atuais.

const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-beta", display: "swap" });
const gabarito = Gabarito({ subsets: ["latin", "latin-ext"], weight: ["500", "600"], variable: "--font-beta-display", display: "swap" });

export const metadata: Metadata = { title: "Beta", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function BetaLayout({ children }: { children: React.ReactNode }) {
  const identity = await getSessionIdentity();
  if (!identity) redirect("/beta-entrar?next=/beta");
  return (
    <div className={`beta-root ${inter.variable} ${gabarito.variable}`}>
      <BetaShell>{children}</BetaShell>
    </div>
  );
}
