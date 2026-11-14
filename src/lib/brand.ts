// Identidade do produto — fonte única para textos, títulos e metadados.
//
// O nome oficial é ATLAS.ERP, sem expansão. É um ERP empresarial, modular e
// generalista. Nomes TÉCNICOS antigos (cookie `educa_session`, GUC
// `educa.auth_link`, chaves `educa-*` do navegador, banco `educa`, projetos
// Neon/Vercel, variável EDUCA_CUTOVER_NEON_CONFIRMADO) continuam como estão:
// são identificadores de compatibilidade, invisíveis para quem usa o sistema.
//
// A autoria aparece só em pontos institucionais: "Sobre o ATLAS.ERP" (menu da
// conta), rodapé da landing, metadados e ficha técnica dos manuais.

export const PRODUCT_NAME = "ATLAS.ERP";
/** As duas partes do wordmark: o nome em destaque e o sufixo em tom menor. */
export const PRODUCT_WORDMARK = { name: "ATLAS", suffix: ".ERP" } as const;
export const PRODUCT_DESCRIPTION = "ERP empresarial modular: operação, finanças, fiscal e governança em um só sistema.";
export const PRODUCT_AUTHOR = "Marcus Valério";
export const PRODUCT_CREDIT = `Criado por ${PRODUCT_AUTHOR}`;

/**
 * Símbolo "Estrela" (grade 32×32): uma estrela de 4 pontas feita de pontos —
 * cada ponto um registro, juntos uma direção. Mesma geometria em
 * scripts/build-landing.mjs, scripts/build-manuals.mjs e src/app/icon.svg
 * (tests/brand.test.ts confere).
 */
export const BRAND_MARK = {
  dots: [
    [16, 2.4],
    [16, 5.8],
    [12.6, 9.2],
    [16, 9.2],
    [19.4, 9.2],
    [9.2, 12.6],
    [12.6, 12.6],
    [16, 12.6],
    [19.4, 12.6],
    [22.8, 12.6],
    [2.4, 16],
    [5.8, 16],
    [9.2, 16],
    [12.6, 16],
    [16, 16],
    [19.4, 16],
    [22.8, 16],
    [26.2, 16],
    [29.6, 16],
    [9.2, 19.4],
    [12.6, 19.4],
    [16, 19.4],
    [19.4, 19.4],
    [22.8, 19.4],
    [12.6, 22.8],
    [16, 22.8],
    [19.4, 22.8],
    [16, 26.2],
    [16, 29.6],
  ],
  radius: 1.35,
} as const;

/**
 * Versão do build (Vercel informa o commit; localmente, "local"). As variáveis
 * são lidas por nome completo: só assim o Next as grava no bundle do navegador.
 */
export function buildInfo(
  env: { NEXT_PUBLIC_BUILD_COMMIT?: string; NEXT_PUBLIC_BUILD_DATE?: string } = {
    NEXT_PUBLIC_BUILD_COMMIT: process.env.NEXT_PUBLIC_BUILD_COMMIT,
    NEXT_PUBLIC_BUILD_DATE: process.env.NEXT_PUBLIC_BUILD_DATE,
  }
) {
  const commit = (env.NEXT_PUBLIC_BUILD_COMMIT ?? "").slice(0, 7);
  const date = env.NEXT_PUBLIC_BUILD_DATE ?? "";
  return { commit: commit || "local", date };
}
