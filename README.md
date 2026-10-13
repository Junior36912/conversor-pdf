# PDFLocal

Ferramentas de PDF **gratuitas e privadas** que rodam inteiramente no navegador. Nenhum arquivo é
enviado a servidores: não existe backend, e todo o processamento acontece no seu computador, em
Web Workers, sem travar a interface.

| Ferramenta | Rota | O que faz |
| --- | --- | --- |
| Juntar PDF | `/merge-pdf` | Combina vários PDFs em um, com ordem por arrastar e soltar |
| Dividir PDF | `/split-pdf` | Separa por intervalos (`1-3, 5, 8-`) ou a cada N páginas; vários arquivos saem em ZIP |
| Organizar PDF | `/organize-pdf` | Gira, reordena e exclui páginas numa grade de miniaturas |
| Comprimir PDF | `/compress-pdf` | Reduz o tamanho em 3 níveis; texto e vetores nunca são alterados |
| Marca d'água | `/watermark-pdf` | Aplica um texto (centralizado ou em mosaico) nas páginas escolhidas |
| Imagem para PDF | `/image-to-pdf` | JPG, PNG, WebP... em um PDF (EXIF corrigido, JPEG sem recompressão) |
| Word para PDF | `/word-to-pdf` | Converte `.docx` em PDF com texto selecionável |
| PowerPoint para PDF | `/powerpoint-to-pdf` | Converte `.pptx` em PDF, um slide por página |
| Excel para PDF | `/excel-to-pdf` | Converte `.xlsx` em PDF com cores, bordas e formatos de número |
| HTML para PDF | `/html-to-pdf` | Converte código ou arquivo HTML em PDF (sem scripts e sem rede) |
| PDF para Imagem | `/pdf-to-image` | Converte páginas em PNG ou JPG (72, 150 ou 300 DPI) |
| PDF para Word | `/pdf-to-word` | Extrai texto, títulos, listas e tabelas para `.docx` |
| PDF para PowerPoint | `/pdf-to-powerpoint` | Slides editáveis (texto) ou fiéis (imagens) |
| PDF para Excel | `/pdf-to-excel` | Extrai tabelas para `.xlsx`, convertendo números |

As conversões de Office e HTML são **aproximadas** (rodam inteiramente no navegador, sem servidor): veja os
limites em [`INFO.md`](INFO.md).

**Demo:** <https://conpdf.onrender.com/>

Documentação do projeto:

- [`INFO.md`](INFO.md): tudo o que o projeto faz, restrições e ideias de melhoria.
- [`CLAUDE.md`](CLAUDE.md): arquitetura, convenções e decisões, para quem for continuar o desenvolvimento.

## Desenvolvimento

Requer Node 20.9 ou superior (testado no 20, 22 e 24).

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint
npm run build    # gera o site estático em out/
npm start        # serve out/ localmente (usa `npx serve`)
```

## Publicação

O site é 100% estático (`output: "export"`): basta publicar a pasta `out/`.

**Render (Static Site):** use o `render.yaml` deste repositório (New → Blueprint), ou crie um
Static Site manualmente com *Build Command* `npm install && npm run build` e *Publish Directory* `out`.
A versão do Node é fixada em `.node-version`.

Qualquer outro host estático (Netlify, Cloudflare Pages, GitHub Pages, Nginx...) também serve.
