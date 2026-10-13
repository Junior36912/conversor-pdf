// As fontes padrão do PDF usam a codificação WinAnsi (CP1252): letras latinas com
// acento, pontuação comum e alguns símbolos. Outros alfabetos não podem ser desenhados.
const WIN_ANSI_TEXT =
  /^[ -~ -ÿ€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]+$/;

export const isWinAnsiText = (text: string): boolean => WIN_ANSI_TEXT.test(text);
