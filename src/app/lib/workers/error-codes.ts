// Códigos de erro "de conteúdo" que o worker devolve em `message` (a interface os traduz em texto).
// Ficam num módulo sem dependências para a página poder importá-los sem carregar as bibliotecas
// pesadas (exceljs, pdf-lib...) que só o worker precisa.

/** PDF → Excel: nenhuma tabela encontrada e o texto solto não foi incluído. */
export const NO_TABLES = "NO_TABLES";
/** Excel → PDF: todas as planilhas estão vazias ou ocultas. */
export const EMPTY_WORKBOOK = "EMPTY_WORKBOOK";
/** Excel → PDF: planilha com linhas demais para gerar um PDF razoável. */
export const WORKBOOK_TOO_LARGE = "WORKBOOK_TOO_LARGE";
/** PowerPoint → PDF: todos os slides estão ocultos. */
export const NO_SLIDES = "NO_SLIDES";
