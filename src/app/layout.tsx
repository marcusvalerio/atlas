import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { Toaster } from "@/components/ui/Toast";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { EnvironmentBadge } from "@/components/shell/EnvironmentBadge";
import { isHomologation } from "@/lib/environment";
import { PRODUCT_AUTHOR, PRODUCT_DESCRIPTION, PRODUCT_NAME } from "@/lib/brand";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import "./globals.css";

// Tipografia servida pelo próprio app (sem CDN; funciona offline após o
// build). Inter para interface e dados (dígitos tabulares via
// .tabular-nums/.num), Newsreader nos momentos editoriais (saudação do
// Início, login, títulos de página) e Geist Mono para códigos (SKU, NCM,
// chaves de acesso). Licenças OFL em src/app/fonts/.
const sans = localFont({
  src: [
    { path: "./fonts/inter-latin-wght-normal.woff2", weight: "100 900", style: "normal" },
    { path: "./fonts/inter-latin-ext-wght-normal.woff2", weight: "100 900", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
});

const serif = localFont({
  src: [
    { path: "./fonts/newsreader-latin-wght-normal.woff2", weight: "200 800", style: "normal" },
    { path: "./fonts/newsreader-latin-ext-wght-normal.woff2", weight: "200 800", style: "normal" },
  ],
  variable: "--font-serif",
  display: "swap",
});

const mono = localFont({
  src: "./fonts/geist-mono-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-geist-mono",
  display: "swap",
});

// Em homologação (APP_ENV=homologacao) a aba do navegador também avisa.
const TITLE_SUFFIX = isHomologation() ? " · HOMOLOGAÇÃO" : "";

export const metadata: Metadata = {
  title: { default: `${PRODUCT_NAME}${TITLE_SUFFIX}`, template: `%s · ${PRODUCT_NAME}${TITLE_SUFFIX}` },
  description: `${PRODUCT_NAME} — ${PRODUCT_DESCRIPTION}`,
  applicationName: PRODUCT_NAME,
  authors: [{ name: PRODUCT_AUTHOR }],
  creator: PRODUCT_AUTHOR,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eceeef" },
    { media: "(prefers-color-scheme: dark)", color: "#090705" },
  ],
};

// Evita "flash" de tema errado antes da hidratação: aplica a escolha
// explícita (claro/escuro) antes do primeiro paint. "Sistema" é resolvido
// só por CSS (prefers-color-scheme), sem atributo.
const NO_FLASH_THEME_SCRIPT = `(function(){try{var v=window.localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(v==="dark"||v==="light")document.documentElement.setAttribute("data-theme",v);}catch(e){}})();`;

// Anel de foco só para quem navega pelo teclado: toque e clique marcam
// data-input="pointer" e o anel some (globals.css); Tab volta a mostrar.
// Sem isso, alguns navegadores de celular deixavam o contorno no item do
// menu depois de um toque.
const INPUT_MODALITY_SCRIPT = `(function(){var d=document.documentElement;function s(v){if(d.getAttribute("data-input")!==v)d.setAttribute("data-input",v)}d.setAttribute("data-input","pointer");addEventListener("pointerdown",function(){s("pointer")},true);addEventListener("keydown",function(e){if(e.key==="Tab"||e.key.indexOf("Arrow")===0)s("keyboard")},true)})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${sans.variable} ${serif.variable} ${mono.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: INPUT_MODALITY_SCRIPT }} />
      </head>
      <body className="h-full">
        <ThemeProvider>
          <TooltipProvider delayDuration={300}>
            {children}
            <EnvironmentBadge />
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
