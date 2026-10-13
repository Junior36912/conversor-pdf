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
5. **Implantação:** exportação estática, ajustes para o Render, README, `render.yaml`; site no ar em
   <https://conpdf.onrender.com/>.
6. **Fase 5 (conversões do menu do iLovePDF, pedido por imagem):** `/image-to-pdf`, `/word-to-pdf`,
   `/excel-to-pdf`, `/powerpoint-to-pdf`, `/html-to-pdf`, `/pdf-to-word`, `/pdf-to-excel`,
   `/pdf-to-powerpoint` (`/pdf-to-image` já existia). **Decisões do usuário:** motor **leve e aproximado**
   para Office → PDF (sem LibreOffice em WebAssembly) e **sem PDF → PDF/A** (só o Ghostscript faz, e ele é
   AGPL-3.0). Menu "Ferramentas" na Navbar e Home agrupada em 3 seções.

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
  layout.tsx · page.tsx (Home: 3 grupos) · globals.css · types-shims.d.ts (tipos do pacote "ssf")
  (tools)/<rota>/{layout,page}.tsx   # 14 ferramentas (layout.tsx só define metadata + container)
  components/
    ui/        button, card, input, progress          (shadcn; alias @/app/components/ui)
    layout/    Navbar, NavMenu (menu "Ferramentas": client, fecha com Esc/clique fora/ao navegar), Footer
    shared/    FileDropzone (genérico) · PdfDropzone (PDF + store) · FileThumbnail · ToolCard ·
               SelectedPdfCard (PDF) · SelectedFileCard (Word/Excel/HTML...) · SegmentedControl ·
               PageSelector · SortableFileList (Juntar e Imagem→PDF) · SortablePageGrid (Organizar)
  hooks/
    usePdfTask         # ciclo comum: status, progresso, erro, outputName, abort ao desmontar
    um hook por ferramenta: usePdfMerge/Split/Organize/Compress/Watermark/ToImage, useImagesToPdf,
    useWordToPdf, useExcelToPdf, usePowerPointToPdf, useHtmlToPdf, usePdfToWord/ToExcel/ToPowerPoint
    usePdfPageCount (nº de páginas) · usePdfPages (abre o PDF p/ miniaturas de qualquer página)
  lib/
    constants.ts · tools.ts (TOOL_GROUPS: fonte da Home e do menu) · utils.ts · download.ts · zip.ts
    pdf/
      core.ts          # pdf-lib: merge, split, organize, watermark (+ PdfLoadError)          [worker]
      compress.ts      # compressão (OffscreenCanvas)                                         [worker]
      images.ts        # Imagem → PDF (EXIF, JPEG sem recompressão, WebP/GIF/BMP via canvas)  [worker]
      docx.ts, docx-prepare.ts   # Word → PDF (docx-to-pdf-wasm + correções do .docx)       [worker]
      fonts.ts         # Arimo/Tinos/Cousine embutidas sob demanda (fontkit)                 [worker]
      extract.ts       # pdf.js -> RawPage[] (texto, posição, negrito/itálico)                [main thread]
      analyze-layout.ts# RawPage[] -> linhas/parágrafos/títulos/listas/tabelas (função pura)  [worker]
      watermark.ts · ranges.ts · text.ts
      render.ts        # pdf.js: miniaturas, páginas -> imagem, openPdfPages, getPdfPageSizes  [main thread]
    office/
      xml.ts           # parser XML mínimo (o worker não tem DOMParser)
      numbers.ts       # "1.234,56" / "12%" -> número (pt-BR ou EUA)
      docx-writer.ts · xlsx-writer.ts · pptx-writer.ts      # PDF → Word/Excel/PowerPoint
      xlsx-render.ts   # Excel → PDF (exceljs + ssf + renderizador próprio)
      pptx/{theme,model,draw,render}.ts   # PowerPoint → PDF (renderizador próprio)
    html/
      document.ts      # sanitiza o HTML, injeta CSP e @page, conta recursos bloqueados
      paginate.ts      # onde cortar as páginas (entre linhas; respeita break-before)
      raster.ts        # captura cada página como JPEG (SVG foreignObject)                    [main thread]
    workers/
      pdf-worker.ts          # o Web Worker (protocolo abaixo)
      pdf-worker-client.ts   # runInWorker + uma função por pedido (mergePdfsInWorker, ...)
  store/useFileStore.ts      # Zustand: só a lista do Juntar PDF
scripts/copy-pdf-worker.mjs  # copia o worker do pdf.js para public/ como .js (ver §6)
public/pdf.worker.<versão>.min.js   # GERADO (ignorado pelo git e pelo ESLint)
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
| `images` | `images: {name, buffer}[]`, `options` (tamanho, orientação, margem, `dpi`) | PDF |
| `docx` / `xlsx` / `pptx` | `buffer` (xlsx leva também `options`) | PDF |
| `pdf-to-docx` / `pdf-to-xlsx` | `pages: RawPage[]`, `options` | .docx / .xlsx |
| `pdf-to-pptx-text` | `pages: RawPage[]`, `removeRepeated` | .pptx editável |
| `pdf-to-pptx-images` | `pages: {width, height, jpeg}[]` | .pptx (uma imagem por slide) |

- `done` traz `{ result: Uint8Array<ArrayBuffer>, format: "pdf" | "zip" | "docx" | "xlsx" | "pptx" }`; o buffer é
  **transferido** (zero-copy) nos dois sentidos. Depois de enviar, o `ArrayBuffer` de entrada fica
  vazio na main thread.
- `error` traz `message` e, para PDF ilegível, `failedIndex` (índice do arquivo). O worker usa
  `PdfLoadError`; `describePdfError(file, fallback)` transforma isso em mensagem para o usuário.
- `runInWorker` (cliente) **cria e encerra um worker por chamada**: libera a memória do pdf-lib e
  permite cancelar com `AbortSignal` (`worker.terminate()`).
- O `new Worker(new URL("./pdf-worker.ts", import.meta.url), { type: "module" })` precisa ser
  **literal** para o Turbopack detectá-lo. O worker real sai como `turbopack-worker-*.js`; um
  `pdf-worker.*.ts` cru em `static/media/` é só um asset residual do `new URL()` e ninguém o carrega.
- **Worker enxuto (importante p/ latência):** `pdf-worker.ts` importa de forma **estática** só o núcleo
  (`pdf-lib`, `compress`, `analyze-layout`, `images`, `ranges`, `zip`). Word, Excel, PowerPoint e os
  escritores de Office (`docx`, `exceljs`, `pptxgenjs`, motor do Word, renderizadores) entram com
  `await import(...)` **dentro do `case`**. Quando eram estáticos, até um simples Juntar baixava e interpretava
  ~3 MB por worker (e cada tarefa cria um worker novo); agora o Juntar carrega ~1 MB. Os demais módulos de
  Office entram no worker só com `import type`. Funciona no `next dev` e no build estático (medido).
- Códigos de erro compartilhados entre worker e hooks ficam em `lib/workers/error-codes.ts`
  (`NO_TABLES`, `EMPTY_WORKBOOK`, `WORKBOOK_TOO_LARGE`, `NO_SLIDES`): os hooks **não** podem importar
  constantes de `xlsx-writer`/`xlsx-render`/`pptx/render`, senão esses módulos pesados voltam ao bundle da página.
- Dentro do worker, `self` é tipado com um contrato mínimo (não use `/// <reference lib="webworker" />`;
  conflita com o lib `dom`).

### PDF → Word / Excel / PowerPoint

1. **Main thread** (`extract.ts`): `pdf.js` lê o texto de cada página (`getTextContent`) e as fontes
   (`page.commonObjs.get(id)` depois de `getOperatorList()`: nome real, `bold`, `italic`). Gera `RawPage[]`
   em pontos, origem no canto superior esquerdo, já com a rotação da página. Texto vertical/girado é ignorado.
2. **Worker** (`analyze-layout.ts`, puro): itens → linhas (mesma linha de base) → segmentos (colunas, por
   vãos horizontais) → **tabelas** (perfil de projeção; colunas vizinhas que nunca coexistem numa linha são
   fundidas, o que resolve cabeçalho à esquerda sobre números à direita) → parágrafos (espaçamento,
   margem, tamanho da fonte; linha curta fecha o parágrafo) → títulos (tamanho vs. corpo mais comum) e
   listas (marcadores `•`/`-`; numeração "1." só em texto comum, não em título). Remove cabeçalho/rodapé que
   se repete em ≥50% das páginas. Limites: colunas de jornal intercalam; célula de várias linhas vira várias
   linhas; **imagens não são extraídas**; PDF sem texto (digitalizado) recebe aviso de OCR.
3. **Writers** (`office/*-writer.ts`): `docx` (estilos Heading 1-3, listas reais, tabelas com borda),
   `exceljs` (células numéricas pelo `numbers.ts`; formato pt-BR ou EUA) e `pptxgenjs` (caixas de texto e
   tabelas nas posições do PDF, ou, no modo "fiel", a página como imagem JPEG 2x por slide).

### Office / HTML → PDF

- **Word:** `docx-to-pdf-wasm` (Rust → WASM, MIT, ~2,4 MB, texto vetorial). O `.wasm` é buscado com `fetch` +
  `WebAssembly.compile` (não depende do MIME `application/wasm`); instância nova por conversão.
  `prepareDocx` reescreve o XML antes: marcadores do Word (caractere privado da fonte Symbol) viram "•" e as
  bordas do *estilo* da tabela (ex.: "Table Grid") são copiadas para a própria tabela.
- **Excel:** `exceljs` lê estilos; `ssf` aplica o formato de número/data de cada célula; `xlsx-render.ts`
  desenha (preenchimento, bordas, negrito, cores de tema, mesclagens, quebra de texto, vazamento de texto
  para células vazias, "###", escala para a largura, A4/Carta).
- **PowerPoint:** `pptx/model.ts` lê o pacote e **achata a herança** (padrão da apresentação → mestre →
  layout → slide → parágrafo → trecho; posição do placeholder herdada), `pptx/draw.ts` desenha com `pdf-lib`.
- **Fontes:** `fonts.ts` embute Arimo (≈Arial), Tinos (≈Times) e Cousine (≈Courier), só as famílias usadas.
  Texto fora do alfabeto latino vira "?". Calibri e similares usam fator 0,92 (a fonte substituta é mais larga).
- **HTML:** roda na main thread (precisa de DOM). O HTML vai para uma `<iframe sandbox="allow-same-origin
  allow-modals">` (sem `allow-scripts`) com `Content-Security-Policy` em `<meta>` (`default-src 'none'`; só
  `data:`/`blob:` para imagem/fonte): scripts não rodam e **nada é buscado na rede**. Cada página é capturada
  como SVG `foreignObject` → canvas → JPEG (2x) e montada com o pedido `images` (`dpi: 192`).
  O botão "Imprimir / salvar como PDF" chama `iframe.contentWindow.print()` (texto vetorial, via diálogo).

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
2. Novo tipo em `PdfWorkerRequest` + `case` no `pdf-worker.ts`. Se a lógica for pesada (>~100 KB), carregue-a
   com `await import()` dentro do `case` (e use só `import type` no topo), para não pesar nas outras tarefas.
3. Função `xxxInWorker` em `pdf-worker-client.ts` (usa `runInWorker`).
4. Hook fino `usePdfXxx` sobre `usePdfTask` (use `describePdfError`, `downloadBlob`, `fileBaseName`).
5. Página em `(tools)/<rota>/page.tsx` + `layout.tsx` com `metadata` (use `LayoutProps<"/rota">`).
6. Entrada no grupo certo de `TOOL_GROUPS` em `lib/tools.ts` (alimenta a Home e o menu da Navbar). Rode `npx next typegen` antes de `tsc`.
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
- **Motor de Office → PDF "leve e aproximado"** (escolha do usuário): LibreOffice em WebAssembly daria mais
  fidelidade, mas custa centenas de MB, vem de CDN externo e exige cabeçalhos COOP/COEP. Fica como melhoria.
- **PowerPoint: renderizador próprio** em vez do `pptx-preview`: foi testado e rejeitado (sem marcadores de
  lista, sem o estilo da tabela, fonte trocada, depende de `echarts` e o resultado seria imagem).
- **PDF → PDF/A não existe** (decisão do usuário): conversão real só com Ghostscript (AGPL-3.0), o que obrigaria
  o projeto a adotar AGPL; `pdf-lib` sozinho não garante conformidade (fontes padrão não são embutidas).
- **Captura de HTML usa data URL**: um SVG com `foreignObject` carregado de `blob:` "contamina" o canvas e o
  navegador recusa `toBlob`/`toDataURL`.
- **Dependências novas:** `docx-to-pdf-wasm`, `docx`, `exceljs`, `pptxgenjs`, `ssf`, `@pdf-lib/fontkit`,
  `@fontsource/{arimo,tinos,cousine}`; todas MIT/Apache/OFL (nenhuma AGPL/GPL).
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
- **Imagem → PDF** (`lib/pdf/images.ts`): JPEG sem EXIF vai **byte a byte** para o PDF (sem recompressão);
  JPEG com orientação EXIF ≠ 1, WebP, GIF, BMP e AVIF passam por `createImageBitmap` (que aplica o EXIF) e
  são recodificados; PNG usa `embedPng` (alfa vira SMask). "Do tamanho da imagem" = px × 72/dpi (+ margem).
  Saída `imagens.pdf` (ou `<nome>.pdf` com uma só imagem).
- **Word → PDF:** só `.docx`; `.doc` antigo é recusado com orientação. Notas de rodapé não são desenhadas.
- **Excel → PDF:** `.xlsx`/`.xlsm`; planilhas ocultas e vazias são ignoradas; >10.000 linhas por planilha dá
  erro (`WORKBOOK_TOO_LARGE`); gráficos, imagens e formatação condicional não são desenhados; sem ajuste à
  largura o Excel divide em faixas de colunas ("desce e depois avança").
- **PowerPoint → PDF:** slides ocultos são ignorados; degradês viram a cor da 1ª parada; gráficos/SmartArt
  aparecem como caixa cinza com o rótulo; formas desconhecidas caem para retângulo; EMF/WMF/SVG não aparecem.
  Tabelas usam o estilo embutido "Medium Style 2 - Accent N" (não fica no arquivo).
- **HTML → PDF:** página = 794×1123 px (A4) ou 816×1056 (Carta) menos a margem; corta entre linhas de texto,
  imagens e linhas de tabela; `canvas`/vídeo não são capturados; só fontes do sistema (web fonts bloqueadas).
- **PDF → Word/Excel/PowerPoint:** ver o pipeline acima. Excel: "1.234,56" só vira número com o formato certo
  (`numbers.ts` não converte CEP, códigos com zero à esquerda, datas).

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
na pasta temporária da sessão, **fora do repo**. Cobriram: **15 suítes, 388 verificações**, em `next dev`,
no `next build` e no site estático servido por `python3 -m http.server` (host estrito, sem rewrites).

O que foi verificado de ponta a ponta: upload real, drag-and-drop com mouse e teclado, download real,
e **inspeção do arquivo resultante com leitores independentes**: `pdf-lib` e `pdf.js` (outra aba, que
renderiza o PDF e devolve pixels/texto/posições) para PDFs e imagens; **`python-docx`, `openpyxl` e
`python-pptx`** (venv no scratchpad) para .docx/.xlsx/.pptx gerados, e os mesmos pacotes + `reportlab` +
Pillow para criar as entradas; o **próprio Chrome (`page.pdf()`) como oráculo** da conversão de HTML (diferença
média de 3,4/255). Também: ausência de requisições externas/POST/corpos (`HEAD` do prefetch é permitido; pedidos
barrados pelo CSP são identificados por `blockedReason` do CDP e não podem ter resposta) e de erros no console.

**Não verificado:** abrir os arquivos gerados no Microsoft Office/LibreOffice reais (não há LibreOffice aqui;
só os leitores Python), Firefox/Safari, dispositivos móveis e documentos reais grandes/complexos.

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
- Com 2+ abas, cada `render` do verificador troca o foco: não rode `Promise.all` de renders.
- O `DOMParser`/`XMLSerializer` não existem no Node: nada do navegador no **topo de módulo** (ver abaixo).
- No `next dev`, uma execução isolada falhou uma vez (recarga do servidor de dev, provavelmente) e passou
  nas repetições; o build estático passou em todas as repetições.

## 10. Armadilhas de código já encontradas

- **Nomes reservados do Next dentro de `src/app/`:** `layout.*`, `page.*`, `template.*`, `error.*`, `loading.*`,
  `route.*`, `default.*`, `not-found.*` viram arquivos de rota, mesmo em `lib/`. Um `lib/pdf/layout.ts` foi
  tratado como layout da rota `/lib/pdf` (por isso `analyze-layout.ts`).
- **Nada do navegador no topo de módulo** (`new XMLSerializer()`, `DOMParser`, `window`...): o prerender
  roda no Node e dá 500 no dev e **falha no `next build`**. Instancie dentro da função.
- **Import estático de lib pesada no `pdf-worker.ts`** faz TODA tarefa pagar o download (foi uma regressão
  real no site: Juntar com PDF corrompido levava ~15 s só para o alerta). Use `import()` no `case`.
- **`.d.ts` de pacotes sem tipos** vão em `src/app/types-shims.d.ts` (hoje só `ssf`).
- **`readText` do PPTX:** a cor-base do texto (`fontRef` do estilo da forma, ou do estilo da tabela) fica
  *entre* os estilos gerais e os do placeholder; senão a cor padrão do tema (preta) sempre ganharia.
- **Atributos XML mantêm o prefixo** (`r:id`, `r:embed`); descartá-lo faz `r:id` sobrescrever o `id` do mesmo nó.
- **`emu()` no `pptx/model.ts`** recebe o fallback em EMU (não em pontos).
- **ESLint** precisa ignorar `public/pdf.worker.*.min.js` (arquivo minificado gerado).
- O `.docx`/`.xlsx`/`.pptx` gerados com bibliotecas só foram validados por leitores Python; antes de prometer
  compatibilidade total com o Office, abra-os no Office real.

## 11. Ambiente e armadilhas de shell

- **Nunca** use `pkill -f "next start"`/`pkill -f next`: a string aparece na linha de comando do próprio
  shell e ele se mata (código 144). Encerre servidores pelo PID: `ss -ltnp | grep :PORTA`.
- Portas usadas nos testes: 3111 (prod), 3112 (dev), 3113 (estático), 3199 (verificador pdf.js).
- `next dev`/`next build` compartilham `.next/`; `build` apaga/recria `out/`.
- `grep` desta máquina (ugrep) falha com `.{0,200}` em arquivos UTF-8: use Python para extrair contexto.

## 12. Implantação (Render)

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

## 13. Estado atual

- **14 ferramentas** prontas (Home em 3 grupos e menu "Ferramentas"); falta apenas PDF → PDF/A (decisão do usuário).
- Repositório público no GitHub: <https://github.com/Junior36912/conversor-pdf> (`origin`, branch `main`
  acompanhando `origin/main`). O `gh` está autenticado como `Junior36912`.
- Deploy no Render feito e verificado: <https://conpdf.onrender.com/> (ver §12). Cada `git push` na `main`
  dispara um novo deploy (padrão do Render para Static Site).
- Pendências e ideias: ver "Possíveis melhorias" em [INFO.md](INFO.md).
