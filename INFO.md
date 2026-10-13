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
| 6 | PDF para Imagem | `/pdf-to-image` | Páginas em PNG ou JPG |

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

## 3. Funcionalidades transversais

- **Privacidade verificada:** nos testes de navegador não houve requisição externa, POST/PUT nem corpo
  enviado; arquivos viram `ArrayBuffer`/`Blob` locais e o download usa `URL.createObjectURL`.
- **Web Workers:** a manipulação com `pdf-lib` e o ZIP rodam em worker; buffers são transferidos sem
  cópia; cada tarefa usa um worker novo (memória liberada ao fim) e **pode ser cancelada**
  (sair da página aborta o worker).
- **Progresso e estados:** barra de progresso, botão "Processando...", mensagens de sucesso com o nome do
  arquivo baixado, mensagens de erro específicas. Editar uma opção limpa o resultado anterior.
- **Miniaturas** de primeira página (e de todas as páginas no Organizar) com `pdf.js`.
- **Navegação:** Home com cards das 6 ferramentas; Navbar com links para todas (a lista rola na horizontal quando falta espaço; não verificado em telas pequenas).
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
  - Verificado no site real: as 7 suítes de navegador (175 verificações) passam; `/rota` sem barra final
    funciona; o worker do `pdf.js` é servido como JavaScript; a página 404 do app é exibida.
  - Verificado antes: build nos Node 20/22/24 e as suítes contra `out/` em servidor estático estrito.
  - **Não verificado:** cota de banda do plano gratuito e comportamento sob carga.
- `output: "export"` impede recursos de servidor (rotas dinâmicas, cookies, Server Actions, rewrites,
  headers do Next); `cacheComponents` precisou ficar desligado.

## 6. Qualidade e testes

- `tsc --noEmit` e ESLint sem avisos.
- 7 suítes de navegador (Chrome real), **175 verificações**, rodadas em `next dev`, `next build` e no
  site estático: upload, arrastar e soltar (mouse e teclado), downloads reais e **inspeção do resultado**
  (ordem/rotação de páginas, dimensões e pixels de imagens, renderização dos PDFs gerados em um
  verificador independente, tamanhos antes/depois). Também: PDF corrompido, entradas inválidas e
  privacidade de rede.
- Os testes **não estão no repositório** (ficaram numa pasta temporária); migrá-los para Playwright é a
  primeira melhoria sugerida.

## 7. Possíveis implementações e melhorias

### Novas ferramentas
- **Imagem para PDF** (JPG/PNG → PDF): fácil com `pdf-lib`, muito pedida.
- **Proteger/desproteger com senha:** exige uma biblioteca com criptografia (ex.: qpdf/mupdf em
  WebAssembly), pois o `pdf-lib` não criptografa.
- **Numerar páginas** (cabeçalho/rodapé), **cortar margens (crop)**, **redimensionar/N-up** (várias
  páginas por folha), **remover páginas em branco**, **tarjar/redigir** trechos.
- **Marca d'água de imagem** (logotipo), com posição livre, e modo "atrás do conteúdo".
- **Editar metadados** (título, autor, palavras-chave) e **extrair texto/imagens**.
- **OCR** (tesseract.js em WebAssembly) para tornar scans pesquisáveis.
- **Assinar** (desenhar/enviar assinatura e posicioná-la) e **comparar dois PDFs**.
- **Reparar PDF** e **PDF/A** (viáveis só parcialmente no navegador).
- Fora do alcance 100% client-side: Word/Excel/PowerPoint ↔ PDF e HTML → PDF fiéis.

### Melhorias nas ferramentas atuais
- **Juntar:** escolher páginas de cada arquivo, inserir páginas em branco, nomear o arquivo de saída,
  preservar marcadores.
- **Organizar:** duplicar e inserir páginas, desfazer/refazer, selecionar várias páginas, virtualizar a
  grade e carregar miniaturas sob demanda para PDFs longos.
- **Comprimir:** estimativa de tamanho antes de aplicar, nível personalizado (qualidade/resolução),
  suporte a mais tipos de imagem (CMYK, indexadas, JPEG 2000), remoção de metadados e objetos órfãos,
  processar vários arquivos de uma vez.
- **Marca d'água:** pré-visualização ao vivo, ângulo e posição livres, fontes com Unicode (embutir TTF
  com `fontkit`), margens e espaçamento no mosaico.
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
