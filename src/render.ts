import * as nodes from "./nodes";
import * as constants from "./constants";

export type RenderConfig = Partial<{
  indentSize: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  showToplevelDocument: boolean;
  transposeText: boolean;
  strictTranspose: boolean;
  cleanupEmptyElement: boolean;
  toFile: boolean;
  quoteStyle: "single" | "double";
}>;

export class Render {
  private readonly config!: RenderConfig;
  private depth = 0;
  constructor(config?: RenderConfig) {
    this.config = {
      indentSize: 2,
      showToplevelDocument: false,
      transposeText: true,
      strictTranspose: false,
      cleanupEmptyElement: true,
      toFile: false,
      quoteStyle: "double",
      ...(config || {}),
    };
  }

  private error(msg: string): never {
    console.error(`An error occurred while rendering: ${msg}`);
    throw new Error();
  }

  private static isDigit(ch: string): boolean {
    return ch >= "0" && ch <= "9";
  }

  private static isXDigit(ch: string): boolean {
    return (
      Render.isDigit(ch) || (ch >= "A" && ch <= "F") || (ch >= "a" && ch <= "f")
    );
  }

  private static isAlpha(ch: string): boolean {
    return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z");
  }

  private static isValidCharReference(
    str: string,
    startIndex: number
  ): boolean {
    // char reference: &#[0-9]+; | &#x[0-9a-fA-F]+;
    // startIndex is after '#'
    let index = startIndex;
    if (str[index] === "x") {
      index++;
      while (index < str.length && Render.isXDigit(str[index])) {
        index++;
      }
    } else {
      while (index < str.length && Render.isDigit(str[index])) {
        index++;
      }
    }
    return str[index] === ";";
  }

  private static isValidEntityReference(str: string, index: number): boolean {
    //  '&' Name ';'
    // startIndex is after '&'
    while (Render.isAlpha(str[index])) {
      index++;
    }
    return str[index] === ";";
  }

  private transposeEntities(
    node: nodes.TextNode | nodes.AttributeNode
  ): string | never {
    /*
     * transpose str containing or not containing predefined
     * entities into their recommended formats.
     * transpose forward:
     *  & -> &amp;
     *  < -> &lt; ..etc
     * transpose backward:
     *  &amp; -> &
     *  &lt;  -> < ..etc
     */

    if (!this.config.transposeText) return node.value;
    // only transpose forward when rendering in order to write to file
    const transposeForward = this.config.toFile;
    const transposer = (idx: number) => constants.XmlPredefinedEntitiesT[idx];
    const text: string = node.value;
    const len = node.value.length;
    let ch: string,
      index: number,
      transposed = "";
    if (transposeForward) {
      for (let i = 0; i < len; i++) {
        ch = text[i];
        // prettier-ignore
        if (this.config.strictTranspose) {
          switch (ch) {
            case "<": index = 0x00; break;
            case ">": index = 0x01; break;
            case "&": index = 0x02; break;
            case '"': index = 0x03; break;
            case "'": index = 0x04; break;
            default:  index = -1;   break;
          }
        } else {
          switch (ch) {
            case "<": index = 0x00; break;
            case ">": index = 0x01; break;
            case "&": index = 0x02; break;
            default:  index = -1;   break;
          }
        }
        if (index === -1) {
          transposed += ch;
          continue;
        }
        if (nodes.isText(node) && node.isCData) {
          transposed += transposer(index);
          continue;
        }
        if (index !== 0x02) {
          transposed += transposer(index);
          continue;
        }
        // Here, index === 0x02
        // ensure we don't mistake any of the &amp;, &quot;,..etc for a '&'
        // since we're only matching first letters
        if (i + 1 === len) {
          // bail fast if we're at the end of the string since '&' would be stand alone
          transposed += transposer(index);
          continue;
        }
        if (text[i + 1] === "#") {
          if (i + 2 >= len || !Render.isValidCharReference(text, i + 2)) {
            if (this.config.strictTranspose) {
              this.error("invalid character reference found");
            } else {
              // in non-strict transpose, escape the character found
              // since it's invalid/deformed
              transposed += transposer(index);
            }
          } else {
            transposed += ch;
          }
        } else if (Render.isAlpha(text[i + 1])) {
          if (!Render.isValidEntityReference(text, i + 1)) {
            if (this.config.strictTranspose) {
              this.error("invalid entity reference found");
            } else {
              // in non-strict transpose, escape the character found
              // since it's invalid/deformed
              transposed += transposer(index);
            }
          } else {
            // valid entity reference
            transposed += ch;
          }
        } else {
          // regular &, transpose
          transposed += transposer(index);
        }
      }
    } else {
      transposed = Render.transposeEntities(text);
      if (this.config.strictTranspose) {
        for (let i = 0; i < transposed.length; i++) {
          // i + 1 === transposed.length? -> undefined === "#"
          if (transposed[i] === "&" && transposed[i + 1] === "#") {
            if (i + 2 < transposed.length) {
              const ch = transposed[i + 2];
              if (ch === "x" || Render.isAlpha(ch) || Render.isDigit(ch)) {
                this.error("invalid character reference found");
              }
            }
          }
        }
      }
    }
    return transposed;
  }

  private indent(str: string): string {
    return str.padStart(this.config.indentSize! * this.depth + str.length, " ");
  }

  private getQuote(value: string) {
    let quote: string;
    if (value.includes("'")) {
      quote = '"';
    } else if (value.includes('"')) {
      quote = "'";
    } else {
      quote = this.config.quoteStyle === "single" ? "'" : '"';
    }
    return quote;
  }

  private static transposeNamedEntities(text: string): string {
    return text.replace(/(&(\w+);)/g, (match: string) => {
      const code = constants.entityMap[match];
      if (code === undefined) return match;
      return String.fromCharCode(code);
    });
  }

  private static transposeCodeEntities(text: string): string {
    // &#\d+; | &#x(\d|[a-fA-F])+;
    return text
      .replace(/(&#(\d+);)/g, (match: string, capture: string, code: number) =>
        String.fromCharCode(code)
      )
      .replace(
        /(&#x((\d|[a-fA-F])+);)/g,
        (match: string, capture: string, code: string) =>
          String.fromCharCode(+("0x" + code))
      );
  }

  public static transposeEntities(text: string) {
    return Render.transposeNamedEntities(Render.transposeCodeEntities(text));
  }

  /** Rendering **/

  updateConfig(config: RenderConfig): void {
    for (const k in config) {
      // eslint-disable-next-line  @typescript-eslint/ban-types
      const key = k as keyof {}; // shut ts up
      if (config[key] !== undefined && key in this.config) {
        this.config[key] = config[key];
      }
    }
  }

  render(node: nodes.RNodeT): string {
    const method = `render${node.constructor.name}`;
    // eslint-disable-next-line  @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return this[method].call(this, node);
  }

  renderRootNode(node: nodes.RootNode): string {
    const children = node.children.slice();
    if (node.xmlDecl) {
      children.splice(node.xmlDecl.pos, 0, node.xmlDecl.node);
    }
    if (node.dtdDecl) {
      children.splice(node.dtdDecl.pos, 0, node.dtdDecl.node);
    }
    if (this.config.showToplevelDocument) {
      const elem = new nodes.ElementNode(
        new nodes.RName(node.name, node.name, "")
      );
      elem.children = children;
      elem.hasChild = true;
      return this.renderElementNode(elem);
    }
    let content = "",
      tmp: string;
    for (const child of children) {
      if ((tmp = this.render(child))) {
        content += tmp + "\n";
      }
    }
    return content.trimEnd(); // remove extra new line
  }

  renderElementNode(node: nodes.ElementNode): string {
    // opening
    let tag = this.indent(`<${node.name.qname}`);
    if (node.hasAttribute || node.namespaces.length) {
      const items: (nodes.NamespaceNode | nodes.AttributeNode)[] =
        node.namespaces.slice();
      items.push(...Array.from(node.attributes.values()));
      items.sort(
        (a: nodes.RNodeT, b: nodes.RNodeT) => a.position() - b.position()
      );
      tag += " ";
      for (const item of items) {
        tag += this.render(item) + " ";
      }
      tag = tag.trimEnd();
    }
    if (node.isVoid) {
      tag += ">";
      return tag;
    } else if (
      node.isSelfEnclosing ||
      (!node.hasChild && this.config.cleanupEmptyElement)
    ) {
      tag += "/>";
      return tag;
    } else {
      tag += ">";
      // empty tag should render as <tag/> if cleanupEmptyElement is set to true,
      // if it's not, it should render as <tag></tag> instead of <tag>\n</tag>
      if (!node.hasChild && !this.config.cleanupEmptyElement) {
        tag += `</${node.name.qname}>`;
        return tag;
      }
    }
    // content
    this.depth++;
    tag += "\n";
    let content: string;
    for (const child of node.children) {
      if ((content = this.render(child))) {
        tag += content + "\n";
      }
    }
    // closing
    this.depth--;
    tag += this.indent(`</${node.name.qname}>`);
    return tag;
  }

  renderCommentNode(node: nodes.CommentNode): string {
    const str = `<!--${node.value}-->`;
    return this.indent(str);
  }

  renderPINode(node: nodes.PINode): string {
    const str = `<?${node.target}${node.value}?>`;
    return this.indent(str);
  }

  renderTextNode(node: nodes.TextNode): string | never {
    let text: string;
    if (node.hasEntity || node.isCData) {
      text = this.transposeEntities(node);
    } else {
      text = node.value;
    }
    // for now, we remove all beginning and ending spaces surrounding the text
    text = text.trim();
    node.isCData ? (text = `<![CDATA[${text}]]>`) : void 0;
    if (!text) return text; // empty texts shouldn't be indented
    return this.indent(text);
  }

  renderAttributeNode(node: nodes.AttributeNode): string {
    const value = this.config.strictTranspose
      ? this.transposeEntities(node)
      : node.value;
    const quote: string = this.getQuote(value);
    return `${node.name.qname}=${quote}${value}${quote}`;
  }

  renderNamespaceNode(node: nodes.NamespaceNode): string {
    const quote = this.getQuote(node.uri);
    const prefix = node.prefix ? ":" + node.prefix : "";
    return `xmlns${prefix}=${quote}${node.uri}${quote}`;
  }

  renderDTDNode(node: nodes.DTDNode): string {
    return this.indent(`<!DOCTYPE ${node.value}>`);
  }

  renderXMLDeclNode(node: nodes.XMLDeclNode): string {
    const start = `<?xml`;
    let i = 0;
    let attributes = "";
    // eslint-disable-next-line  @typescript-eslint/no-unused-vars
    for (const [_, attr] of node.attributes) {
      attributes += this.renderAttributeNode(attr);
      if (i < node.attributes.size - 1) {
        attributes += " ";
      }
      i++;
    }
    if (attributes) {
      return this.indent(start + " " + attributes + "?>");
    }
    return this.indent(start + "?>");
  }
}
