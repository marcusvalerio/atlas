import "server-only";

import { createClient as createSupabaseJsClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "./env";
import { dataBackend } from "@/lib/database/backend";
import { createPgDataClient, mirrorAuthUser } from "@/lib/database/pg/client";
import { authProvider } from "@/lib/auth/provider";

let cached: SupabaseClient | null = null;

/** Há acesso administrativo (service_role) configurado neste ambiente? */
export function adminAccessConfigured(): boolean {
  return dataBackend() === "postgres" ? !!process.env.DATABASE_URL : !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

/**
 * Cliente administrativo (service role key) — acesso total, ignora Row
 * Level Security. Uso exclusivo em código server-only (rotas de API),
 * nunca em um componente "use client" ou em qualquer módulo importado
 * pelo bundle do navegador (o `import "server-only"` acima garante um
 * erro de build caso isso aconteça).
 *
 * Enquanto a Fase 3 (Supabase Auth) não existir, as rotas de API usam
 * este cliente para todas as operações de cadastro — não há usuário
 * autenticado ainda para respeitar RLS por linha. Ver docs/SUPABASE.md
 * para as políticas de RLS aplicadas nesta fase.
 */
export function createAdminClient(): SupabaseClient {
  if (cached) return cached;
  if (dataBackend() === "postgres") {
    // PostgreSQL direto: papel service_role (BYPASSRLS), como a service key.
    const data = createPgDataClient({ role: "service_role" });
    if (authProvider() === "supabase") {
      // Modo híbrido: logins e senhas no Supabase Auth, dados no Neon. Toda conta
      // criada no Supabase é espelhada em auth.users do Neon (mesmo id), que é o
      // alvo das FKs (users.auth_user_id, platform_members…).
      const authAdmin = supabaseServiceClient().auth.admin;
      type Created = { data: { user: { id: string; email?: string | null; email_confirmed_at?: string | null; app_metadata?: unknown; user_metadata?: unknown } | null }; error: unknown };
      const mirrored = <A extends unknown[]>(fn: (...args: A) => Promise<Created>) => async (...args: A) => {
        const result = await fn(...args);
        if (!result.error && result.data.user) await mirrorAuthUser(result.data.user);
        return result;
      };
      const admin = Object.assign(Object.create(authAdmin), {
        createUser: mirrored(authAdmin.createUser.bind(authAdmin) as never),
        inviteUserByEmail: mirrored(authAdmin.inviteUserByEmail.bind(authAdmin) as never),
      });
      cached = { ...data, auth: { ...supabaseServiceClient().auth, admin } } as unknown as SupabaseClient;
      return cached;
    }
    cached = data as unknown as SupabaseClient;
    return cached;
  }
  cached = supabaseServiceClient();
  return cached;
}

let service: SupabaseClient | null = null;
function supabaseServiceClient(): SupabaseClient {
  service ??= createSupabaseJsClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return service;
}
