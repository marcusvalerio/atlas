"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Gabarito } from "next/font/google";
import { signInWithPassword } from "@/lib/auth/client";
import { primeSession } from "@/lib/session/client-state";
import type { SessionContext } from "@/lib/session/types";
import { AtlasIcon } from "@/components/brand/GalaxyMark";
import { WarpField } from "@/components/textures/WarpField";

// Login do Beta (/beta-entrar): o mesmo login do ERP (mesma conta, banco e
// permissões), na identidade nova. Senha provisória e convites seguem pelo
// /login atual. Depois de entrar, vai para /beta.

const gabarito = Gabarito({ subsets: ["latin", "latin-ext"], weight: ["500", "600"], display: "swap" });

function Form() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await signInWithPassword(email, password);
      if (!result.ok) {
        if (result.newPasswordRequired) {
          router.replace("/login");
          return;
        }
        setError(result.message);
        return;
      }
      const res = await fetch("/api/session/context", { cache: "no-store" });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        router.replace("/acesso");
        return;
      }
      primeSession(body.data as SessionContext);
      const next = params.get("next");
      router.replace(next && next.startsWith("/beta") ? next : "/beta");
    } catch {
      setError("Não foi possível conectar ao servidor de autenticação. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const field = "h-[46px] rounded-[10px] border border-[#DCDCD8] bg-white px-3.5 text-[15px] text-[#15161A] outline-none focus:border-[#15161A]";
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="rounded-[10px] bg-[#FDE1E0] px-3 py-2 text-[13px] text-[#8C0F1E]">
          {error}
        </p>
      )}
      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-[#15161A]">
        E-mail
        <input type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com.br" className={field} />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-[#15161A]">
        Senha
        <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={field} />
      </label>
      <div className="flex justify-end text-[13px]">
        <Link href="/recuperar-senha" className="font-medium text-[#8A6410] hover:underline">
          Esqueci minha senha
        </Link>
      </div>
      <button type="submit" disabled={loading} className="h-[50px] rounded-full bg-[#15161A] text-[15px] font-semibold text-[#F7F7F5] disabled:opacity-60">
        {loading ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}

export default function BetaLoginPage() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-[#111214] px-4 py-10">
      <WarpField ink="#F2C66D" ground="#111214" alpha={0.9} />
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 70% 70% at 50% 50%, rgba(17,18,20,0) 35%, rgba(17,18,20,.8) 100%)" }} />
      <section className="relative w-full max-w-[380px] rounded-[26px] bg-white p-8 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.7)] sm:p-9">
        <div className="mb-5 flex items-center gap-2.5">
          <AtlasIcon size={40} />
          <span className="flex flex-col leading-tight">
            <b className={`${gabarito.className} text-[26px] font-semibold text-[#15161A]`}>atlas</b>
            <span className="text-[12px] text-[#5E6066]">Gestão empresarial · Beta</span>
          </span>
        </div>
        <h1 className={`${gabarito.className} text-[24px] font-semibold text-[#15161A]`}>Bom te ver de novo</h1>
        <p className="mt-1 mb-5 text-[14px] text-[#5E6066]">Entre com a mesma conta do ERP.</p>
        <Suspense fallback={null}>
          <Form />
        </Suspense>
      </section>
      <p className="absolute bottom-6 left-6 hidden text-[13px] text-[#A4A6AD] sm:block">
        <b className={`${gabarito.className} font-semibold text-[#F2F2F0]`}>atlas</b> · versão beta
      </p>
    </main>
  );
}
