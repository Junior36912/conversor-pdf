@AGENTS.md

# CLAUDE.md — PDFLocal (conversor-pdf)

Guia para quem continuar este projeto (Claude Code ou pessoa). Resume o que foi pedido, o que foi
decidido, como o código é organizado e as armadilhas já encontradas. Para o catálogo de
funcionalidades, limites e ideias, veja [INFO.md](INFO.md).

> `@AGENTS.md` acima importa as regras que o Next.js gera para agentes. Elas mandam **ler a
> documentação embutida em `node_modules/next/dist/docs/` antes de escrever código**: este é o
> Next.js 16.4, com diferenças em relação ao que a maioria dos modelos conhece. O bloco é
> reescrito por `next dev`; não o edite à mão.

## 1. O projeto

Clone gratuito e privado de um site de ferramentas de PDF (estilo iLovePDF), em **português do
Brasil**. Nome de marca provisório: **PDFLocal** (em `src/app/lib/constants.ts`). Não usar o nome nem
a identidade visual do iLovePDF.

### Regra de ouro (inegociável)

**Nenhum PDF pode ser enviado a servidor ou backend.** Todo processamento (cálculo, edição,
renderização) acontece no navegador do usuário, com Web Workers para não travar a interface.
Consequências práticas:

- Sem API Routes, Route Handlers, Server Actions ou `fetch` com arquivos do usuário.
- Todo componente que toca em `File`, `Blob` ou `ArrayBuffer` é `"use client"`.
- `pdf-lib` roda **somente** no Web Worker (`src/app/lib/workers/pdf-worker.ts`). A main thread
  nunca importa `pdf-lib` em tempo de execução.
- `pdfjs-dist` fica na main thread e só **renderiza** (miniaturas, contagem de páginas, páginas
  para imagem). Ele usa o próprio worker interno para o parse.
- O site é exportado como HTML estático (`output: "export"`), então não existe servidor que
  pudesse receber arquivos.

### Pedido original (resumo fiel)

Stack definida pelo usuário: Next.js (App Router), TypeScript com tipagem estrita para `File`,
`Blob` e `ArrayBuffer`, Tailwind CSS, shadcn/ui + Lucide, Zustand, `pdf-lib` (edição),
`pdfjs-dist` (miniaturas em canvas) e `@dnd-kit` para arrastar e soltar.

Estrutura de pastas exigida **"rigorosamente"** (note que `components`, `lib` e `store` ficam
**dentro** de `src/app/`, e não em `src/`):

```
/src/app
  /(tools)/merge-pdf/{page,layout}.tsx
  /components/{ui,shared,layout}     # shared: PdfDropzone, PdfThumbnail; layout: Navbar, Footer
  /lib/pdf/{core,render}.ts          # core: helpers do pdf-lib; render: helpers do pdf.js
  /lib/workers/pdf-worker.ts         # Web Worker
  /store/useFileStore.ts             # Zustand
```

Fase 1 pedida: (A) setup e store Zustand (lista de arquivos com `id`, `File` original e preview
opcional em base64); (B) Navbar com logo em texto, Footer "100% Gratuita, Offline e Segura" e
Home com grid de cards (Juntar, Dividir, PDF para Imagem); (C) `/merge-pdf` com `PdfDropzone`,
worker que recebe `ArrayBuffer[]` e devolve `Uint8Array`, botão "Juntar PDFs" com estado
"Processando..." e download automático de `merged.pdf` via `URL.createObjectURL`. O usuário pediu
que eu **confirmasse o entendimento da arquitetura client-side antes de codar**; isso foi feito.
Pediu também código "o mais modular possível".

### Linha do tempo (o que já foi entregue)

1. **Fase 1:** setup, store, Navbar/Footer/Home, `/merge-pdf`.
2. **Fase 2:** reordenação por arrastar e soltar no Juntar PDF; `/split-pdf`.
3. **Fase 3:** `/pdf-to-image`.
4. **Fase 4:** `/organize-pdf`, `/compress-pdf`, `/watermark-pdf`; Navbar com links entre
   ferramentas; refatorações compartilhadas.
5. **Implantação:** exportação estática, ajustes para o Render, README, `render.yaml`.

O usuário costuma responder com instruções curtas ("faça", "faça todas") para autorizar as
sugestões que eu listei; trate isso como aval para executar o conjunto proposto. Ele escreve em
português; responda em português.

## 2. Comandos

```bash
npm install
npm run dev        # predev copia o worker do pdf.js para public/; porta 3000 (PORT=xxxx para mudar)
npm run lint       # ESLint
npx tsc --noEmit   # checagem de tipos (rode `npx next typegen` antes se criar rotas/layouts)
npm run build      # prebuild copia o worker; gera o site estático em out/
npm start          # = npx --yes serve out (o `next start` NÃO funciona com output: "export")
```

Versões: Next 16.4.0 (Turbopack), React 19.3, TypeScript 5.9. Node: desenvolvido no 20.20.2;
o build foi verificado também no 22.23.3 e no 24.21.0. `.node-version` fixa o 22 (para o Render).

## 3. Mapa do código

```
src/app/
  layout.tsx                  # raiz: fontes Geist, metadata, Navbar + <main> + Footer; lang="pt-BR"
  page.tsx                    # Home: grid de ToolCard a partir de lib/tools.ts
  globals.css                 # Tailwind 4 + tokens do shadcn (tema só claro; ver §8)
  (tools)/<rota>/{layout,page}.tsx   # uma pasta por ferramenta (layout.tsx só define metadata + container)
  components/
    ui/        button, card, input, progress          (shadcn; alias @/app/components/ui)
    layout/    Navbar, Footer
    shared/    PdfDropzone, PdfThumbnail, ToolCard, SelectedPdfCard, SegmentedControl,
               PageSelector, SortablePdfList (lista do merge), SortablePageGrid (grade do organizar)
  hooks/
    usePdfTask         # ciclo comum: status, progresso, erro, outputName, abort ao desmontar
    usePdfMerge / usePdfSplit / usePdfOrganize / usePdfCompress / usePdfWatermark / usePdfToImage
    usePdfPageCount    # nº de páginas (pdf.js); usePdfPages # abre o PDF p/ miniaturas de qualquer página
  lib/
    constants.ts       # SITE_NAME, SITE_TAGLINE
    tools.ts           # lista central de ferramentas (Home + Navbar)
    utils.ts           # cn (re-export do pacote "cn"), formatBytes, fileBaseName
    download.ts        # downloadBlob (createObjectURL + <a download>)
    zip.ts             # createZip (fflate, sem recompressão)
    pdf/
      core.ts          # pdf-lib: merge, split, organize, watermark (+ PdfLoadError)   [só no worker]
      compress.ts      # pdf-lib + OffscreenCanvas: compressão                          [só no worker]
      watermark.ts     # tipos + geometria pura (computePlacements) + hexToRgb
      ranges.ts        # parsePageRanges, chunkRanges, expandRanges, selectPages
      text.ts          # isWinAnsiText (texto que a Helvetica do PDF consegue desenhar)
      render.ts        # pdf.js: renderFirstPage, getPdfPageCount, renderPagesToImages, openPdfPages
    workers/
      pdf-worker.ts          # o Web Worker (protocolo abaixo)
      pdf-worker-client.ts   # runInWorker + mergePdfsInWorker, splitPdfInWorker, zipInWorker, ...
  store/useFileStore.ts      # Zustand: só a lista do Juntar PDF
scripts/copy-pdf-worker.mjs  # copia o worker do pdf.js para public/ como .js (ver §6)
public/pdf.worker.<versão>.min.js   # GERADO (ignorado pelo git)
next.config.ts · components.json · render.yaml · .node-version · AGENTS.md
```

## 4. Arquitetura

### Protocolo main thread ↔ worker

`pdf-worker.ts` recebe um `PdfWorkerRequest` por mensagem e responde com `progress`, `done` ou
`error`. Tipos exportados de lá e importados com `import type` (apagados na compilação).

| `type` do pedido | Dados | Resultado (`done`) |
| --- | --- | --- |
| `merge` | `buffers: ArrayBuffer[]` | PDF |
| `split` | `buffer`, `ranges: PageRange[]`, `baseName` | PDF (1 intervalo) ou ZIP |
| `zip` | `entries: {name, buffer}[]` | ZIP (usado por PDF para Imagem) |
| `organize` | `buffer`, `pages: {page, rotation}[]` | PDF |
| `compress` | `buffer`, `level: light/recommended/strong` | PDF |
| `watermark` | `buffer`, `options: WatermarkOptions` | PDF |

- `done` traz `{ result: Uint8Array<ArrayBuffer>, format: "pdf" | "zip" }`; o buffer é
  **transferido** (zero-copy) nos dois sentidos. Depois de enviar, o `ArrayBuffer` de entrada fica
  vazio na main thread.
- `error` traz `message` e, para PDF ilegível, `failedIndex` (índice do arquivo). O worker usa
  `PdfLoadError`; `describePdfError(file, fallback)` transforma isso em mensagem para o usuário.
- `runInWorker` (cliente) **cria e encerra um worker por chamada**: libera a memória do pdf-lib e
  permite cancelar com `AbortSignal` (`worker.terminate()`).
- O `new Worker(new URL("./pdf-worker.ts", import.meta.url), { type: "module" })` precisa ser
  **literal** para o Turbopack detectá-lo. O worker real sai como `turbopack-worker-*.js`; um
  `pdf-worker.*.ts` cru em `static/media/` é só um asset residual do `new URL()` e ninguém o carrega.
- Dentro do worker, `self` é tipado com um contrato mínimo (não use `/// <reference lib="webworker" />`;
  conflita com o lib `dom`).

### Ciclo de uma ferramenta

`page.tsx` (UI, estado local) → hook da ferramenta (`usePdfXxx`, baseado em `usePdfTask`) →
`xxxInWorker` em `pdf-worker-client.ts` → `pdf-worker.ts` → função em `lib/pdf/core.ts`/`compress.ts`.
`usePdfTask.run(task, describeError)` cuida de status (`idle|processing|done|error`), progresso 0–100,
`outputName` (mostrado na mensagem de sucesso) e aborta o worker se a página sair de cena. Uma
`AbortError` volta o estado para `idle` sem mostrar erro.

Exceção: **PDF para Imagem** renderiza com pdf.js na main thread (`renderPagesToImages`) e só o ZIP
passa pelo worker.

### Estado

- `useFileStore` (Zustand) guarda **apenas** a lista do Juntar PDF (`files`, `addFiles`,
  `removeFile`, `clearFiles`, `reorderFiles`, `setPreview`). `PdfDropzone` escreve nele por padrão.
- Ferramentas de arquivo único usam `useState` local e `<PdfDropzone multiple={false} onFiles={...}/>`.
  Edições (ex.: páginas do Organizar) ficam atreladas ao `File` para não vazarem entre PDFs.
- Padrão para evitar `setState` síncrono em `effect` (regra do ESLint do React): guarde o resultado
  assíncrono junto com a chave que o gerou (`{file, count}`) e **derive** o valor atual comparando a
  chave (`usePdfPageCount`, `usePdfPages`, `PdfThumbnail`).

### pdf.js (`lib/pdf/render.ts`)

- Carregado por `import("pdfjs-dist")` **dinâmico**: o módulo costuma acessar APIs do navegador
  (como `DOMMatrix`) ao ser avaliado, o que quebraria no SSR/prerender.
- Miniaturas são renderizadas **uma por vez** (fila) e cacheadas (`WeakMap` por `File`;
  `Map` por página em `openPdfPages`).
- Canvas: o limite de ~16 megapixels (Safari) é respeitado em `renderPagesToImages`, que reduz a
  escala de páginas enormes em vez de gerar imagem em branco.

## 5. Como adicionar uma ferramenta (checklist)

1. Lógica pura em `lib/pdf/` (importável pelo worker; sem DOM, exceto o que o worker tem, como OffscreenCanvas).
2. Novo tipo em `PdfWorkerRequest` + `case` no `pdf-worker.ts`.
3. Função `xxxInWorker` em `pdf-worker-client.ts` (usa `runInWorker`).
4. Hook fino `usePdfXxx` sobre `usePdfTask` (use `describePdfError`, `downloadBlob`, `fileBaseName`).
5. Página em `(tools)/<rota>/page.tsx` + `layout.tsx` com `metadata` (use `LayoutProps<"/rota">`).
6. Entrada em `lib/tools.ts` (alimenta Home e Navbar). Rode `npx next typegen` antes de `tsc`.
7. Reutilize: `PdfDropzone`, `SelectedPdfCard`, `SegmentedControl`, `PageSelector` + `selectPages`,
   `usePdfPageCount`, `parsePageRanges`. Edição de opções deve chamar `reset()` se `status` for
   `done`/`error` (padrão `edit(setter)` das páginas existentes).
8. Verifique em navegador real (ver §9), no build estático e no `next dev`.

## 6. Decisões importantes (e por quê)

- **`output: "export"` + `trailingSlash: true`** (`next.config.ts`): o app é 100% client-side, então
  vira HTML estático (`out/<rota>/index.html`), servível por qualquer host sem regras de rewrite.
- **`cacheComponents` e `partialPrefetching` foram DESLIGADOS**: o `create-next-app` os liga, mas o
  build falha com `Invariant: PPR cannot be enabled in export mode`. O app não usa `use cache`. Efeito
  colateral: o Next não preserva mais o estado de rotas ocultas (`<Activity>`); os hooks continuam
  abortando o worker no cleanup. Não os religue sem abandonar o export estático.
- **Worker do pdf.js servido como `.js`** (`scripts/copy-pdf-worker.mjs`, roda em `predev` e `prebuild`):
  o worker é um módulo `.mjs` e o navegador só o carrega se o servidor responder MIME de JavaScript.
  Hosts estáticos nem sempre mapeiam `.mjs` (e há relato de não conseguirem sobrescrever o
  Content-Type no Render). O script copia `node_modules/pdfjs-dist/build/pdf.worker.min.mjs` para
  `public/pdf.worker.<versão>.min.js` (versão no nome = lib e worker sempre casam, sem cache velho) e
  `render.ts` aponta para `/pdf.worker.${pdfjs.version}.min.js`. O arquivo gerado está no `.gitignore`.
  Se rodar `next build` direto (sem `npm run build`), rode o script antes.
- **Compressão sem mexer em texto**: ver §7. **`@types/pako`** está em devDependencies.
- **shadcn**: `components.json` aponta os aliases para `@/app/...`. O CLI atual gera
  `import { cn } from "cn"` (pacote oficial `shadcn-ui/cn`) e `lib/utils.ts` só o reexporta. Para
  adicionar componentes: `npx shadcn@latest add <nome>`; ele cria em `src/app/components/ui/`.
  O init deixou `--font-sans: var(--font-sans)` circular; foi corrigido para `var(--font-geist-sans)`.
- **Sem `next/image`**: miniaturas são data URLs locais (`<img>` com `eslint-disable` comentado).
- **Rodapé usa texto fixo**, sem `new Date()` (era proibido em Server Component com `cacheComponents`).

## 7. Detalhes não óbvios por ferramenta

- **Juntar:** lista ordenável (`@dnd-kit`, alça + teclado, anúncios em pt-BR). Mínimo 2 arquivos.
  Saída fixa `merged.pdf`.
- **Dividir:** `parsePageRanges` aceita `1-3, 5, 8-` (`8-` = até a última). Modo "a cada N" exige
  `N < total de páginas`. 1 intervalo → PDF; vários → ZIP `<base>_dividido.zip` com
  `<base>_parte-NN_pag-X-Y.pdf` (índice no nome evita colisão com intervalos repetidos).
- **PDF para Imagem:** 72/150/300 DPI (escala = DPI/72), PNG ou JPEG (qualidade 0,92 fixa). 1 página →
  arquivo direto; várias → `<base>_imagens.zip`. Páginas repetidas no texto são deduplicadas.
- **Organizar:** `PageItem {id, page, rotation}`; giro soma ao `/Rotate` que a página já tinha.
  Miniaturas de todas as páginas, uma por vez. A miniatura é a alça de arrastar.
- **Comprimir** (`lib/pdf/compress.ts`): só imagens 8-bit `DeviceRGB`/`DeviceGray`/ICC (N=1 ou 3), JPEG
  ou Flate, sem `/Decode` nem `/Mask`, com ≥30 KB; recodifica em JPEG (OffscreenCanvas) e só troca se
  o resultado for ≥10% menor; imagens usadas como **`SMask` nunca são tocadas** (precisam continuar em
  cinza); reduz o maior lado a 2000 px (recomendada) ou 1400 px (forte); qualidade 0,75 / 0,5. Todos
  os níveis aplicam deflate (pako) a streams sem filtro ≥1 KB (exceto `ObjStm`/`XRef`/`Metadata`).
  O `pdf-lib` já comprime os streams que ele mesmo gera, então "Leve" só rende em PDFs de outros
  geradores. Se o ganho for <1% o arquivo **não é baixado** e a UI diz "já está otimizado".
- **Marca d'água** (`core.addTextWatermark`): Helvetica-Bold (WinAnsi), texto ≤80 caracteres,
  tamanho 8–300, opacidade 5–100% (um único ExtGState compartilhado, pois `drawText({opacity})` cria
  um por chamada), rotação 45/0/90 como o usuário vê a página (soma `page.getRotation()`), mosaico
  limitado a 5000 posições por página. Texto fora de WinAnsi é rejeitado na UI.

## 8. Convenções

- UI e comentários em **português do Brasil**; identificadores em inglês. Comentários só onde o
  porquê não é óbvio (o código existente segue esse estilo: explica restrições e armadilhas).
- TypeScript estrito. Use `Uint8Array<ArrayBuffer>` (TS 5.9) para bytes que serão transferidos ou
  passados a `Blob`; o estreitamento vindo do `pdf-lib` é justificado em comentário.
- Imports com alias `@/app/...`. Pastas `components`, `lib`, `store`, `hooks` ficam dentro de `src/app/`.
- Acessibilidade: botões com `aria-label`, mensagens com `role="status"`/`role="alert"`,
  `aria-pressed` nos seletores, `aria-invalid`/`aria-describedby` nos campos.
- **Tema escuro não está ligado**: os tokens existem, mas o shadcn usa `@custom-variant dark (.dark *)`
  e nada aplica a classe `dark`. Tema claro apenas.
- Git: commits terminam com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Identidade do
  repositório: Junior36912 (`juniojackson369@gmail.com`). Branch `main`.

## 9. Testes e verificação

Não há suíte de testes dentro do repositório. A verificação foi feita com **testes de navegador
descartáveis** (puppeteer-core + `/usr/bin/google-chrome`, Chrome 152 headless no Linux) que ficaram
na pasta temporária da sessão, **fora do repo**. Cobriram: 7 suítes, 175 verificações, em `next dev`,
no `next build` e no site estático servido por `python3 -m http.server` (host estrito, sem rewrites).

O que foi verificado de ponta a ponta: upload real, drag-and-drop com mouse e teclado, download real,
e **inspeção do PDF/imagem resultante** (páginas e ordem com `pdf-lib`; pixels com um verificador
independente que renderiza o PDF com `pdf.js` em outra aba). Também: ausência de requisições externas,
de POST/PUT e de corpos enviados (`HEAD` do prefetch dos links é permitido), e de erros no console.

Se for recriar: prefira **Playwright** dentro do repo. Armadilhas já enfrentadas:

- Só a aba da frente recebe `requestAnimationFrame`. `page.click` do Puppeteer e a renderização do
  pdf.js **travam em aba de segundo plano**: com 2+ abas, use `bringToFront()` e renders sequenciais.
- `<input type="color">` e `type="range"` precisam do setter nativo de `value` + evento `input` para o
  React perceber a mudança.
- Seletor de lista deve ser `main ul li` (a Navbar também tem `<ul><li>`). Mensagens de sucesso:
  `p[role="status"]` (o `DndContext` injeta um `div[role="status"]` vazio antes).
- Com `trailingSlash`, `href` fica `/rota/`: use `a[href^='/rota']`.
- Imprima resultados com `console.log` direto em **arquivo** ao depurar (a saída por pipe se perde se
  o processo morrer).
- Download: aguarde o arquivo aparecer (e sumir o `.crdownload`) antes de lê-lo.
- No `next dev`, uma execução isolada falhou uma vez (recarga do servidor de dev, provavelmente) e passou
  nas repetições; o build estático passou em todas as repetições.

## 10. Ambiente e armadilhas de shell

- **Nunca** use `pkill -f "next start"`/`pkill -f next`: a string aparece na linha de comando do próprio
  shell e ele se mata (código 144). Encerre servidores pelo PID: `ss -ltnp | grep :PORTA`.
- Portas usadas nos testes: 3111 (prod), 3112 (dev), 3113 (estático), 3199 (verificador pdf.js).
- `next dev`/`next build` compartilham `.next/`; `build` apaga/recria `out/`.
- `grep` desta máquina (ugrep) falha com `.{0,200}` em arquivos UTF-8: use Python para extrair contexto.

## 11. Implantação (Render)

Alvo recomendado: **Static Site** (grátis, sem "adormecer", sem servidor Node). `render.yaml`:
`runtime: static`, `buildCommand: npm install && npm run build`, `staticPublishPath: ./out`; Node 22 via `.node-version`.

- **No ar:** <https://conpdf.onrender.com/> (Static Site `conpdf`, servido pelo Cloudflare do Render).
  Todas as 7 suítes de navegador (175 verificações) passaram contra a URL real, sem requisição externa,
  sem POST e sem erro de console.
- **Confirmado no Render:** `/rota` sem barra final abre direto (200, sem redirecionamento); o worker do
  pdf.js é servido como `application/javascript`; rota inexistente devolve 404 com a página 404 do app.
- **Verificado antes do deploy:** build estático nos Node 20/22/24 (24.21.0 é o padrão do Render) e as
  suítes contra `out/` num servidor estático estrito.
- **Não verificado:** a cota de banda do plano gratuito e o comportamento sob carga.
- Cabeçalhos de segurança (ex.: CSP com `connect-src 'self'`) não estão configurados; seriam uma
  camada extra para provar a regra de ouro.

## 12. Estado atual

- 6 ferramentas prontas; Home e Navbar listam todas.
- Repositório público no GitHub: <https://github.com/Junior36912/conversor-pdf> (`origin`, branch `main`
  acompanhando `origin/main`). O `gh` está autenticado como `Junior36912`.
- Deploy no Render feito e verificado: <https://conpdf.onrender.com/> (ver §11). Cada `git push` na `main`
  dispara um novo deploy (padrão do Render para Static Site).
- Pendências e ideias: ver "Possíveis melhorias" em [INFO.md](INFO.md).
