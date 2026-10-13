# INFO.md — O que o PDFLocal faz, o que não faz e para onde pode crescer

Catálogo do projeto: funcionalidades, restrições conhecidas e ideias de melhoria. Para a arquitetura e
as convenções de código, veja [CLAUDE.md](CLAUDE.md).

## 1. Visão geral

**PDFLocal** é um conjunto de ferramentas de PDF que roda **inteiramente no navegador**:

- **Privado:** nenhum arquivo é enviado a servidor. Não existe backend; o site é HTML estático.
- **Gratuito:** sem contas, sem limites artificiais, sem anúncios, sem rastreamento.
- **Responsivo:** o processamento pesado roda em Web Workers e a interface continua fluida.
- **Em português do Brasil.**

| # | Ferramenta | Rota | Resumo |
| - | --- | --- | --- |
| 1 | Juntar PDF | `/merge-pdf` | Combina vários PDFs em um |
| 2 | Dividir PDF | `/split-pdf` | Separa por intervalos ou a cada N páginas |
| 3 | Organizar PDF | `/organize-pdf` | Gira, reordena e exclui páginas |
| 4 | Comprimir PDF | `/compress-pdf` | Reduz o tamanho (3 níveis) |
| 5 | Marca d'água | `/watermark-pdf` | Aplica texto sobre as páginas |
| 6 | Imagem para PDF | `/image-to-pdf` | JPG, PNG, WebP... em um PDF, uma por página |
| 7 | Word para PDF | `/word-to-pdf` | .docx → PDF com texto selecionável |
| 8 | PowerPoint para PDF | `/powerpoint-to-pdf` | .pptx → PDF, um slide por página |
| 9 | Excel para PDF | `/excel-to-pdf` | .xlsx → PDF com cores, bordas e formatos |
| 10 | HTML para PDF | `/html-to-pdf` | Código ou arquivo HTML → PDF |
| 11 | PDF para Imagem | `/pdf-to-image` | Páginas em PNG ou JPG |
| 12 | PDF para Word | `/pdf-to-word` | Texto, títulos, listas e tabelas em .docx |
| 13 | PDF para PowerPoint | `/pdf-to-powerpoint` | Slides editáveis (texto) ou fiéis (imagens) |
| 14 | PDF para Excel | `/pdf-to-excel` | Tabelas do PDF em células de .xlsx |

Fora do catálogo, por decisão: **PDF para PDF/A** (a conversão real exige o Ghostscript, licenciado em
AGPL-3.0, que obrigaria o projeto inteiro a adotar essa licença).

## 2. Funcionalidades por ferramenta

### 2.1 Juntar PDF
- Aceita vários PDFs de uma vez (arrastar para a área ou clicar para escolher); arquivos que não são
  PDF são ignorados, com aviso do quanto foi descartado.
- Lista com miniatura da primeira página, nome e tamanho de cada arquivo.
- **Reordenação por arrastar e soltar** (alça à esquerda) com mouse, toque ou teclado
  (espaço/Enter, setas, espaço/Enter; Esc cancela), com anúncios para leitor de tela em português.
  A ordem da lista é a ordem do resultado; um número mostra a posição.
- Remover arquivo, "Limpar tudo". Mínimo de 2 arquivos para juntar.
- Barra de progresso e botão "Processando..."; baixa `merged.pdf` ao terminar.
- Se algum PDF estiver corrompido ou protegido, a mensagem **cita o nome do arquivo**.

### 2.2 Dividir PDF
- Um PDF por vez; mostra o número de páginas.
- **Por intervalos:** `1-3, 5, 8-` (vírgula ou ponto e vírgula; `8-` vai até a última página). Cada
  intervalo vira um arquivo. Intervalos podem se sobrepor.
- **A cada N páginas:** blocos consecutivos (o último pode ser menor).
- Validação ao vivo com mensagens claras (fora do documento, primeira página maior que a última,
  formato inválido, N inválido) e **resumo do que será gerado** ("Serão gerados 3 arquivos...").
- Saída: 1 arquivo → PDF `<nome>_pag-X-Y.pdf`; vários → ZIP `<nome>_dividido.zip` contendo
  `<nome>_parte-NN_pag-X-Y.pdf`.

### 2.3 Organizar PDF
- Grade de **miniaturas de todas as páginas** (renderizadas uma a uma).
- Por página: **girar 90° à esquerda/direita** (a prévia gira na hora), **excluir**, **arrastar** para
  reordenar (a própria miniatura é a alça; funciona com teclado também).
- Em lote: girar todas à esquerda/direita; **Restaurar original** (desfaz tudo, inclusive exclusões).
- O giro **soma** ao que a página já tinha (uma página com 90° girada à direita fica com 180°).
- Mostra "N de M páginas"; avisa quando todas foram excluídas e desabilita o salvamento.
- Saída: `<nome>_organizado.pdf`.

### 2.4 Comprimir PDF
- **Leve:** sem perda de qualidade. Comprime (deflate) conteúdo que estava sem compressão.
  Em um PDF de texto sem compressão, 43,5 KB caíram para 2,5 KB com renderização idêntica.
- **Recomendada:** além do Leve, recodifica as imagens em JPEG (qualidade 75%, maior lado até 2000 px).
- **Forte:** imagens a 50% de qualidade e até 1400 px.
- **Texto e gráficos vetoriais nunca são alterados**; só imagens podem perder qualidade.
- Imagens com transparência continuam corretas (as máscaras de transparência são preservadas).
- Mostra "De X para Y (−N%)". Se não houver ganho relevante (<1%), **não baixa nada** e avisa
  "já está otimizado", em vez de entregar um arquivo igual ou maior.
- Exemplos medidos: PDF com uma imagem PNG de 2200×1500 (9,3 MB) → 0,17 MB (−98%) na Recomendada;
  JPEG de 1,15 MB → 0,04 MB na Forte, ambos com diferença visual média baixa (≈2 em 255).
- Saída: `<nome>_comprimido.pdf`.

### 2.5 Marca d'água
- **Texto** (até 80 caracteres; padrão "CONFIDENCIAL"), fonte Helvetica Bold.
- **Tamanho** 8–300, **cor** (seletor), **opacidade** 5–100% (passos de 5).
- **Orientação:** diagonal (45°), horizontal ou vertical.
- **Posição:** centralizada ou **repetida em mosaico** (linhas alternadas deslocadas).
- **Páginas:** todas ou específicas (`1-3, 5, 8-`).
- Funciona corretamente em páginas que já têm rotação (`/Rotate`): o texto aparece na orientação pedida
  como o usuário vê a página.
- Aceita letras latinas com acento, números e pontuação comum; **outros alfabetos são recusados** com
  explicação (ex.: chinês, árabe, cirílico).
- A marca é desenhada **por cima** do conteúdo. Saída: `<nome>_marca-dagua.pdf`.

### 2.6 PDF para Imagem
- **Formato:** PNG ou JPG (qualidade 92%).
- **Resolução:** 72 (rápida), 150 ou 300 DPI.
- **Páginas:** todas ou específicas; repetições são removidas.
- 1 página → arquivo direto `<nome>_pagina-N.png|jpg`; várias → ZIP `<nome>_imagens.zip`.
- Páginas muito grandes são **reduzidas automaticamente** para respeitar o limite de ~16 megapixels do
  canvas (uma página de 5000×5000 pt a 300 DPI sai com 3999×3999 px, em vez de falhar).

### 2.7 Imagem para PDF
- Aceita JPG, PNG, WebP, GIF, BMP e AVIF (vários de uma vez); lista com miniaturas e **reordenação por
  arrastar e soltar** (mouse ou teclado), remoção individual e "Limpar tudo".
- **Tamanho da página:** do tamanho da imagem, A4 ou Carta; **orientação** automática, retrato ou paisagem
  (em A4/Carta); **margem** nenhuma, pequena ou grande. A imagem é ajustada à área útil sem distorcer.
- **Fotos de celular saem na posição certa**: a orientação EXIF é aplicada.
- **JPEG normal entra no PDF sem recompressão** (byte a byte); PNG com transparência mantém o fundo transparente.
- Saída: `imagens.pdf` (ou `<nome>.pdf` quando há uma só imagem).

### 2.8 Word para PDF
- Converte `.docx` em PDF vetorial (texto selecionável): títulos, negrito/itálico/cores, listas numeradas e
  com marcadores, tabelas com bordas, imagens, quebras de página.
- Corrige dois defeitos comuns do motor antes de converter: marcadores do Word (fonte Symbol) e bordas de
  tabela definidas no estilo ("Table Grid").
- Saída: `<nome>.pdf`. Um `.doc` antigo é recusado, com a orientação de salvar como `.docx`.

### 2.9 Excel para PDF
- Cada planilha visível vira páginas de PDF; planilhas ocultas e vazias são ignoradas.
- Reproduz **preenchimentos, bordas, negrito/itálico, cores (inclusive de tema), células mescladas, larguras
  de coluna, quebra de texto com altura automática** e o **formato de número e data de cada célula**
  (moeda, porcentagem, datas, milhar), com separadores do Brasil (`1.234,56`) ou dos EUA.
- Opções: A4/Carta, orientação (automática escolhe paisagem para planilhas largas), **ajustar à largura**
  (reduz até 50%; abaixo disso divide em faixas de colunas) e **linhas de grade**.
- Fórmulas mostram o resultado; texto rico, hiperlinks (texto), erros e booleanos são exibidos.
- Saída: `<nome>.pdf`.

### 2.10 PowerPoint para PDF
- Converte `.pptx` em PDF vetorial, um slide por página, no tamanho do slide (ex.: 16:9).
- Respeita a **herança de estilos** do PowerPoint (tema, mestre, layout): posição e formatação dos títulos e
  do corpo, tamanhos por nível, **marcadores e numeração automática**, alinhamentos (inclusive justificado),
  recuos, espaçamentos, ancoragem vertical, sublinhado/tachado e fontes serifada/monoespaçada.
- Desenha **formas** (retângulo, arredondado, elipse, triângulo, losango, setas, divisa, hexágono, cruz...
  e formas livres), preenchimento, contorno, **rotação**, conectores, **imagens (com recorte)**, **grupos** e
  **tabelas** (com o estilo embutido do PowerPoint). Fundo sólido ou com imagem.
- Slides ocultos são ignorados. Saída: `<nome>.pdf`.

### 2.11 HTML para PDF
- Duas origens: **colar o código** ou **enviar um arquivo** `.html`/`.htm`; pré-visualização na tela.
- Opções: A4/Carta, retrato/paisagem, margem (nenhuma, pequena, normal).
- **Seguro por padrão:** o HTML roda numa área isolada **sem scripts** e **sem acesso à rede**; o aviso mostra
  quantas imagens/estilos externos foram bloqueados.
- **Converter em PDF:** baixa na hora, com a aparência do navegador (diferença média de ~3/255 em relação ao
  PDF que o próprio Chrome gera); quebra de página entre linhas de texto e linhas de tabela, e respeita
  `page-break-before: always`. O texto fica como imagem.
- **Imprimir / salvar como PDF:** abre a impressão do navegador para gerar um PDF com texto selecionável.

### 2.12 PDF para Word
- Extrai texto com **posição e estilo** e reconstrói: títulos (Heading 1-3) pelo tamanho da fonte, parágrafos
  (junta linhas), listas com marcadores reais, **tabelas** (mesmo sem linhas desenhadas), negrito/itálico,
  tamanhos e família (sem serifa/serifada/monoespaçada), tamanho da página e orientação.
- Opções: manter a quebra de página do PDF; remover cabeçalhos e rodapés repetidos.
- Saída: `<nome>.docx`. PDFs digitalizados (sem texto) recebem um aviso claro sobre OCR.

### 2.13 PDF para PowerPoint
- **Editável:** cada página vira um slide com caixas de texto (posição, tamanho, negrito/itálico, marcadores)
  e tabelas nas posições originais.
- **Fiel:** cada página vira uma imagem JPEG em tela cheia (idêntica ao PDF, não editável); funciona também
  para PDFs digitalizados.
- Saída: `<nome>.pptx`, no tamanho da página do PDF.

### 2.14 PDF para Excel
- Detecta tabelas pelo alinhamento do texto e as coloca em células; cabeçalhos em negrito; larguras de coluna
  ajustadas ao conteúdo.
- **Converte números** como `1.234,56`, `R$ 98,50`, `+12%`, `(1.250,00)` em valores numéricos com o formato
  de célula correspondente (formato do Brasil ou dos EUA); CEPs, códigos com zero à esquerda e datas ficam
  como texto.
- Opções: uma planilha por página ou todas em uma; incluir ou não o texto fora das tabelas; remover
  cabeçalhos/rodapés repetidos.
- Saída: `<nome>.xlsx`.

## 3. Funcionalidades transversais

- **Privacidade verificada:** nos testes de navegador não houve requisição externa, POST/PUT nem corpo
  enviado; arquivos viram `ArrayBuffer`/`Blob` locais e o download usa `URL.createObjectURL`.
- **Web Workers:** a manipulação com `pdf-lib` e o ZIP rodam em worker; buffers são transferidos sem
  cópia; cada tarefa usa um worker novo (memória liberada ao fim) e **pode ser cancelada**
  (sair da página aborta o worker).
- **Progresso e estados:** barra de progresso, botão "Processando...", mensagens de sucesso com o nome do
  arquivo baixado, mensagens de erro específicas. Editar uma opção limpa o resultado anterior.
- **Miniaturas** de primeira página (e de todas as páginas no Organizar) com `pdf.js`.
- **Navegação:** Home com os 14 cards em três grupos (Organizar e editar, Converter para PDF, Converter de PDF) e menu "Ferramentas" na barra superior (fecha com Esc, clique fora ou ao navegar).
- **Metadados por página** (título e descrição), `lang="pt-BR"`.
- **Acessibilidade:** rótulos e `aria-*` nos controles, mensagens `role="status"/"alert"`, anéis de
  foco, arrastar por teclado com anúncios em português. (Não houve auditoria com leitor de tela real.)
- **Dropzone:** arrastar e soltar ou clicar; feedback visual ao arrastar; aceita escolher o mesmo
  arquivo de novo.

## 4. Restrições e limitações

### PDFs
| Limitação | Detalhe |
| --- | --- |
| **PDFs protegidos por senha/criptografados** | Não são abertos (`pdf-lib` não suporta). A UI diz que "pode estar corrompido ou protegido por senha". Não há campo para digitar senha. |
| **Perda de recursos ao remontar** | Juntar, Dividir e Organizar criam documentos novos: **marcadores (outline), campos de formulário (AcroForm), anexos e metadados do documento não são preservados**. Links/anotações da página tendem a ser mantidos, mas isso não foi testado. |
| **Assinaturas digitais** | Qualquer reescrita as invalida. |
| **PDF/A, PDF tagged (acessível)** | Não são preservados nas operações que recriam o documento. |
| **Texto não é editado** | Não há edição de conteúdo, OCR ou extração de texto. |

### Compressão
- Só recodifica imagens 8 bits em RGB, cinza ou ICC (1 ou 3 canais), em JPEG ou Flate, **sem `/Decode`
  nem `/Mask`** e com pelo menos 30 KB. Imagens CMYK, indexadas, 1 bit (scans em JBIG2/CCITT), JPEG 2000
  etc. **não são tocadas**; um PDF feito só delas pode não encolher.
- Só troca a imagem se a nova ficar pelo menos 10% menor.
- "Leve" tem pouco efeito em PDFs gerados por bibliotecas que já comprimem (inclusive `pdf-lib`).
- Imagens recodificadas viram RGB (perdem o perfil de cor ICC); em geral imperceptível, mas possível.
- Depende de `OffscreenCanvas` e `createImageBitmap` dentro do worker; se faltarem, as imagens ficam
  como estão (só a compressão sem perdas é aplicada).

### Marca d'água
- Apenas **texto**, uma só fonte (Helvetica Bold), alfabeto latino (WinAnsi).
- Orientações fixas (45°, 0°, 90°); sem posição livre, sem pré-visualização ao vivo, sem marca de imagem.
- No mosaico, no máximo 5000 repetições por página.
- A marca fica por cima (não existe modo "atrás do conteúdo").

### PDF para Imagem
- Renderiza na **main thread** (pdf.js); PDFs muito longos em alta resolução podem deixar a página mais
  lenta e consomem muita memória (todas as imagens ficam na memória antes de virar ZIP).
- Qualidade do JPEG fixa em 92%; resoluções fixas (72/150/300).

### Conversões de Office e HTML para PDF (aproximadas)
- **Word:** só `.docx` (não `.doc`, `.odt`, `.rtf`); as fontes do Office são trocadas por equivalentes
  (Liberation), notas de rodapé e de fim não são desenhadas, controle de alterações e tabelas muito
  aninhadas podem falhar; alfabetos fora do latino/grego/cirílico (ex.: chinês) não aparecem.
- **Excel:** só `.xlsx`/`.xlsm` (não `.xls`/`.csv`); **gráficos, imagens e formatação condicional não são
  desenhados**; a fonte vira Arial-equivalente e só o alfabeto latino é suportado (outros viram `?`);
  planilhas com mais de 10.000 linhas são recusadas; cores de tema usam a paleta padrão do Office.
- **PowerPoint:** só `.pptx`/`.ppsx` (não `.ppt`); **gráficos, SmartArt, vídeos, animações e transições não
  são reproduzidos** (gráfico e diagrama aparecem como uma caixa cinza com o nome); degradês viram cor
  sólida; sombras e efeitos são ignorados; imagens EMF/WMF/SVG/TIFF não aparecem; fontes substituídas
  (Calibri → Arial-equivalente reduzida em 8%); só o alfabeto latino.
- **HTML:** scripts nunca executam e recursos externos (imagens, CSS e fontes da internet) são bloqueados de
  propósito; use imagens em `data:` e CSS dentro de `<style>`. No modo "Converter em PDF" o texto vira imagem
  (não selecionável) e `<canvas>`, vídeo e formulários não são capturados; só fontes do sistema. O modo de
  impressão depende do diálogo do navegador (não dá para testá-lo/automatizá-lo por completo).
- **Nenhuma** dessas conversões foi aberta no Microsoft Office/LibreOffice reais (só em leitores
  independentes) e todas dependem do tipo de arquivo: documentos muito complexos podem sair diferentes.

### Conversões de PDF para Office (aproximadas)
- A estrutura é **deduzida da posição do texto**: layouts em várias colunas (jornal) saem misturados, células
  com várias linhas viram várias linhas, e títulos são detectados pelo tamanho da fonte.
- **Imagens, gráficos, desenhos e cores de texto não são extraídos** (exceto no PowerPoint "fiel", que usa a
  página como imagem). Formulários, anotações e links não são levados.
- **PDFs digitalizados** (só imagem) não podem virar Word/Excel/PowerPoint editável sem OCR, que ainda não
  existe aqui.
- A qualidade do Excel depende de a tabela ter colunas bem alinhadas; tabelas muito irregulares ou com
  células mescladas viram dados deslocados.
- Texto vertical ou girado é ignorado.

### Imagem para PDF
- Formatos que o navegador não decodifica (HEIC/HEIF, TIFF, SVG, RAW) são recusados ou falham citando o
  arquivo; CMYK e perfis de cor ICC não são tratados de forma especial.

### Desempenho e navegador
- **Tudo em memória:** o arquivo inteiro é lido para a RAM (sem streaming). Não há limite artificial de
  tamanho; o limite real é a memória do dispositivo. Não foram testados PDFs de centenas de MB nem de
  milhares de páginas.
- **Aba em segundo plano:** o `pdf.js` avança a renderização com `requestAnimationFrame`, que o
  navegador pausa em abas ocultas. Miniaturas e PDF para Imagem **pausam** se a aba perder o foco
  (observado no pdf.js durante os testes; não foi medido especificamente na conversão).
- **Organizar** renderiza as miniaturas de todas as páginas, uma por vez, sem virtualização: PDFs com
  centenas de páginas demoram a preencher a grade.
- **Navegadores:** testado apenas em **Chrome 152 (headless, Linux)**. Exige navegador moderno (Web
  Workers de módulo, `OffscreenCanvas`, `createImageBitmap`). Firefox, Safari, celulares e tablets
  **não foram testados**. O layout é responsivo por CSS, mas sem verificação visual em telas pequenas.
- **"Offline":** o processamento é local, mas **não há service worker**: depois que a página carregou
  funciona sem rede, porém recarregar sem internet falha. O rodapé diz "Offline" no sentido de "não envia
  nada", não de "funciona sem conexão desde o início".
- **Persistência:** nada é salvo; recarregar a página perde a lista de arquivos e as edições.
- **Sem tema escuro** (os tokens existem, mas nada ativa a classe `dark`).
- **Sem internacionalização:** só português.

## 5. Requisitos e hospedagem

- **Desenvolvimento:** Node 20.9+ (desenvolvido no 20.20; build verificado no 22 e no 24), npm.
- **Build:** `npm run build` gera `out/` (site estático). Não há servidor em produção.
- **Hospedagem:** qualquer host estático. No ar em **Render (Static Site)**:
  <https://conpdf.onrender.com/>. O repositório tem `render.yaml` e `.node-version` (22).
  - Verificado no site real: as 15 suítes de navegador (388 verificações, as 14 ferramentas) passam; `/rota`
    sem barra final funciona; o worker do `pdf.js` é servido como JavaScript; a página 404 do app é exibida.
  - Desempenho real: cada tarefa abre um worker novo; um Juntar baixa ~1 MB (~300 KB comprimidos) e o alerta de
    PDF corrompido aparece ~4,6 s após o clique (localmente ~1,5 s). O motor do Word (~2,3 MB de wasm) e o
    `exceljs` só são baixados nas ferramentas que os usam.
  - Verificado antes: build nos Node 20/22/24 e as suítes contra `out/` em servidor estático estrito.
  - **Não verificado:** cota de banda do plano gratuito e comportamento sob carga.
- `output: "export"` impede recursos de servidor (rotas dinâmicas, cookies, Server Actions, rewrites,
  headers do Next); `cacheComponents` precisou ficar desligado.

## 6. Qualidade e testes

- `tsc --noEmit` e ESLint sem avisos.
- **15 suítes de navegador (Chrome real), 388 verificações**, em `next dev`, `next build` e no site estático:
  upload, arrastar e soltar (mouse e teclado), downloads reais e **inspeção do resultado com leitores
  independentes**: PDFs e imagens renderizados no `pdf.js` (pixels, posições e texto), `python-docx`,
  `openpyxl` e `python-pptx` para os arquivos de Office gerados, e o **próprio Chrome como referência** na
  conversão de HTML. Também: PDFs/arquivos corrompidos, entradas inválidas e privacidade de rede (nenhuma
  requisição externa, POST ou corpo enviado; recursos bloqueados por CSP não recebem resposta).
- Os testes **não estão no repositório** (ficaram numa pasta temporária); migrá-los para Playwright é a
  primeira melhoria sugerida.
- **Não verificado:** abrir os .docx/.xlsx/.pptx gerados no Office real, Firefox, Safari e celulares.

## 7. Possíveis implementações e melhorias

### Novas ferramentas
- **Proteger/desproteger com senha:** exige uma biblioteca com criptografia (ex.: qpdf/mupdf em
  WebAssembly), pois o `pdf-lib` não criptografa.
- **Numerar páginas** (cabeçalho/rodapé), **cortar margens (crop)**, **redimensionar/N-up** (várias
  páginas por folha), **remover páginas em branco**, **tarjar/redigir** trechos.
- **Marca d'água de imagem** (logotipo), com posição livre, e modo "atrás do conteúdo".
- **Editar metadados** (título, autor, palavras-chave) e **extrair texto/imagens**.
- **OCR** (tesseract.js em WebAssembly): tornar scans pesquisáveis e **destravar PDF para Word/Excel/PowerPoint
  em documentos digitalizados** (hoje recusados).
- **Assinar** (desenhar/enviar assinatura e posicioná-la) e **comparar dois PDFs**.
- **PDF para PDF/A:** só com Ghostscript em WebAssembly (AGPL-3.0); exige decidir pela licença do projeto e
  validar o resultado com o veraPDF. `pdf-lib` sozinho não garante conformidade.
- **Reparar PDF**, **CSV ↔ Excel**, **Markdown/TXT → PDF**, **PDF para texto simples** e **PDF para HTML**.

### Conversões: onde mais há ganho
- **Fidelidade de Word/Excel/PowerPoint → PDF:** LibreOffice em WebAssembly (ZetaOffice) daria resultado quase
  idêntico ao Office, ao custo de um download de centenas de MB, carregamento de CDN externo, cabeçalhos
  COOP/COEP e lentidão; poderia ser um modo opcional "alta fidelidade".
- **PowerPoint → PDF:** gráficos (hoje caixa cinza), degradês reais, sombras, estilos de tabela personalizados,
  EMF/WMF, mais formas predefinidas e fontes não latinas (embutir Noto por alfabeto).
- **Excel → PDF:** gráficos e imagens da planilha, formatação condicional, área de impressão e cabeçalhos
  repetidos, CSV.
- **Word → PDF:** notas de rodapé, cabeçalho/rodapé do documento, `.doc`/`.odt`/`.rtf`.
- **HTML → PDF:** texto vetorial automático (um desenhista próprio a partir do DOM, sem o diálogo de
  impressão), URL como entrada (esbarra em CORS), fontes da web embutidas, `@page` por seção.
- **PDF → Word/Excel/PowerPoint:** extrair imagens e cores de texto, detectar colunas de jornal, mesclar
  células, reconhecer linhas desenhadas das tabelas (operadores do PDF) e usar OCR em scans.
- **Imagem → PDF:** HEIC (via biblioteca em WebAssembly), compressão opcional, recorte/rotação por imagem.

### Melhorias nas ferramentas atuais
- **Juntar:** escolher páginas de cada arquivo, inserir páginas em branco, nomear o arquivo de saída,
  preservar marcadores.
- **Organizar:** duplicar e inserir páginas, desfazer/refazer, selecionar várias páginas, virtualizar a
  grade e carregar miniaturas sob demanda para PDFs longos.
- **Comprimir:** estimativa de tamanho antes de aplicar, nível personalizado (qualidade/resolução),
  suporte a mais tipos de imagem (CMYK, indexadas, JPEG 2000), remoção de metadados e objetos órfãos,
  processar vários arquivos de uma vez.
- **Marca d'água:** pré-visualização ao vivo, ângulo e posição livres, fontes com Unicode (o `fontkit` e as
  fontes Arimo/Tinos/Cousine já estão no projeto para as conversões; falta usá-los aqui), margens e
  espaçamento no mosaico.
- **PDF para Imagem:** DPI personalizado, escolher qualidade do JPEG, renderizar fora da main thread
  (OffscreenCanvas em worker) para não pausar com a aba em segundo plano e não travar a interface.
- **Dividir:** dividir por tamanho (MB), por marcadores ou por páginas em branco.

### Plataforma e experiência
- **PWA/offline de verdade:** service worker + manifest (instalável e utilizável sem conexão), alinhado
  à promessa "Offline" do rodapé.
- **Tema escuro** (alternância e `prefers-color-scheme`) e **internacionalização** (EN/ES).
- **Colar** arquivos (Ctrl+V), soltar em qualquer parte da janela e botão "usar o resultado em outra
  ferramenta" (encadear operações sem baixar e reenviar).
- **Avisos de memória** e limites sugeridos para arquivos grandes; pool de workers para paralelizar lotes.
- **Persistência opcional** da lista (IndexedDB).
- **Acessibilidade:** auditoria com leitor de tela e verificação de contraste.
- **SEO e compartilhamento:** `sitemap.xml`, `robots.txt`, imagens Open Graph, páginas de aterrissagem
  por ferramenta com texto explicativo.
- **Segurança:** cabeçalhos (CSP com `connect-src 'self'`, `Referrer-Policy`) para reforçar a regra de
  ouro no próprio navegador, configurados no host (no Render, pelo painel).

### Engenharia
- **Testes automatizados no repositório** (Playwright) e **CI** no GitHub Actions: `tsc`, ESLint, build e
  testes de navegador a cada push.
- Dependabot/Renovate, hooks de commit (Husky/lint-staged), `error.tsx`/`not-found.tsx` personalizados.
- Testes unitários para `parsePageRanges`/`chunkRanges` e para a geometria da marca d'água
  (`computePlacements`), que são funções puras.
- Testar em **Firefox, Safari e dispositivos móveis**; ajustar o que falhar.
- Monitorar o `pdf.js` e o `pdf-lib`: a versão mais recente do `pdf-lib` (1.17.1) é de novembro de 2021, então vale acompanhar forks mantidos ou alternativas.
