// Parser XML mínimo para arquivos do Office (OOXML). O Web Worker não tem DOMParser, e esses
// arquivos são bem-comportados: sem DTD, entidades só as cinco básicas e numéricas.
// Os prefixos de namespace dos *elementos* são descartados ("a:solidFill" -> "solidFill"); nos
// documentos que nos interessam os nomes locais não colidem. Os *atributos* mantêm o prefixo
// ("r:embed", "r:id"), porque sem ele colidiriam com atributos próprios (ex.: `id` e `r:id`).

export interface XNode {
  name: string;
  attrs: Record<string, string>;
  children: XNode[];
  /** Texto direto do elemento (já sem entidades); espaços são preservados. */
  text: string;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[entity] ?? match;
  });
}

const localName = (name: string) => name.slice(name.indexOf(":") + 1);

export function parseXml(source: string): XNode {
  const root: XNode = { name: "#root", attrs: {}, children: [], text: "" };
  const stack: XNode[] = [root];
  const tag = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[\s\S]*?\?>|<(\/?)([^\s/>]+)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  const attribute = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

  let match: RegExpExecArray | null;
  while ((match = tag.exec(source))) {
    const [, cdata, closing, rawName, rawAttrs, selfClosing, text] = match;
    const top = stack[stack.length - 1];
    if (cdata !== undefined) {
      top.text += cdata;
    } else if (text !== undefined) {
      top.text += decode(text);
    } else if (rawName) {
      if (closing) {
        if (stack.length > 1) stack.pop();
        continue;
      }
      const attrs: Record<string, string> = {};
      let a: RegExpExecArray | null;
      attribute.lastIndex = 0;
      while ((a = attribute.exec(rawAttrs ?? ""))) {
        if (a[1] !== "xmlns" && !a[1].startsWith("xmlns:")) attrs[a[1]] = decode(a[2] ?? a[3] ?? "");
      }
      const node: XNode = { name: localName(rawName), attrs, children: [], text: "" };
      top.children.push(node);
      if (!selfClosing) stack.push(node);
    }
  }
  return root.children[0] ?? root;
}

/** Primeiro filho com o nome dado. */
export const child = (node: XNode | undefined, name: string): XNode | undefined =>
  node?.children.find((c) => c.name === name);

/** Todos os filhos com o nome dado (ou todos, sem nome). */
export const kids = (node: XNode | undefined, name?: string): XNode[] =>
  node ? (name ? node.children.filter((c) => c.name === name) : node.children) : [];

/** Desce por uma sequência de nomes ("a", "b", "c"). */
export function path(node: XNode | undefined, ...names: string[]): XNode | undefined {
  let current = node;
  for (const name of names) current = child(current, name);
  return current;
}

export const attr = (node: XNode | undefined, name: string): string | undefined => node?.attrs[name];

export function num(node: XNode | undefined, name: string): number | undefined {
  const value = node?.attrs[name];
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
