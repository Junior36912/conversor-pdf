// Copia o worker do pdf.js para `public/` com extensão `.js` e a versão no nome.
//
// O worker é um módulo ES (`.mjs`), e o navegador só o carrega se o servidor responder com
// MIME de JavaScript. Hosts estáticos nem sempre mapeiam `.mjs` (nem deixam sobrescrever o
// Content-Type); `.js` funciona em qualquer um. A versão no nome evita servir um worker em
// cache de outra versão do pdf.js. Roda automaticamente antes de `dev` e `build`.
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const pdfjs = new URL("node_modules/pdfjs-dist/", root);
const publicDir = new URL("public/", root);

const { version } = JSON.parse(readFileSync(new URL("package.json", pdfjs), "utf8"));
mkdirSync(publicDir, { recursive: true });

// Remove workers de versões anteriores.
for (const name of readdirSync(publicDir)) {
  if (/^pdf\.worker\..+\.min\.js$/.test(name)) rmSync(new URL(name, publicDir));
}

const target = new URL(`pdf.worker.${version}.min.js`, publicDir);
copyFileSync(new URL("build/pdf.worker.min.mjs", pdfjs), target);
console.log(`pdf.js worker -> ${fileURLToPath(target)}`);
