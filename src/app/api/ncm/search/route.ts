import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/context";
import { ApiError, unauthorizedError, validationError } from "@/lib/database/errors";
import { jsonError } from "@/lib/api/response";
import { NCM_API, ncmDigits, normalizeNcmQuery, parseNcmResponse } from "@/lib/fiscal/ncm-search";

// Consulta de NCM para os cadastros: o servidor busca na tabela pública
// vigente e devolve só códigos de 8 dígitos. Exige sessão (não é um proxy
// aberto) e guarda a resposta por um dia.
export async function GET(request: NextRequest) {
  try {
    if (!(await getAuthContext())) throw unauthorizedError();
    const q = normalizeNcmQuery(new URL(request.url).searchParams.get("q") ?? "");
    if (!q) throw validationError("Digite ao menos 2 números ou 3 letras.");
    const digits = /^\d+$/.test(q);
    const url = digits && q.length === 8 ? `${NCM_API}/${q}` : `${NCM_API}?search=${encodeURIComponent(q)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), next: { revalidate: 86400 } });
    if (res.status === 404) return NextResponse.json({ success: true, data: [] });
    if (!res.ok) throw new ApiError("UPSTREAM_ERROR", "A tabela de NCM não respondeu. Tente de novo em instantes.", 502);
    const body: unknown = await res.json();
    let items = parseNcmResponse(Array.isArray(body) ? body : [body]);
    if (digits) items = items.filter((i) => i.digits.startsWith(ncmDigits(q)));
    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return jsonError(new ApiError("UPSTREAM_ERROR", "A tabela de NCM demorou para responder. Tente de novo.", 504));
    }
    return jsonError(error);
  }
}
