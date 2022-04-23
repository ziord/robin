import * as config from "./config";
import * as nodes from "./nodes";
import { XmlParser, HtmlParser } from "./parser";
import { XmlLexer, HtmlLexer } from "./lexer";
import { RenderConfig, Render } from "./render";
import { XPath } from "./xpath";
import { DOM } from "./dom";

export type ParseMode = "XML" | "HTML";

export class Robin {
  public mode!: ParseMode;
  public dom = new DOM().dom;
  public path = new XPath().path;
  private parser!: XmlParser | HtmlParser;
  private rootNode!: nodes.RootNode;
  constructor(
    markup?: string,
    mode?: ParseMode,
    public config?: config.RConfig
  ) {
    if (markup) {
      this.setupParser(markup, mode, this.config);
      this.rootNode = this.parser.parse();
    }
  }

  private setupMode(mode?: ParseMode): undefined | never {
    if (mode === undefined) {
      this.mode = "XML";
      return;
    }
    if (mode !== "XML" && mode !== "HTML") {
      throw new Error(
        "Unrecognized parse mode. Parse mode should either be 'XML' or 'HTML'"
      );
    }
    this.mode = mode;
  }

  private setupParser(
    markup: string,
    mode?: ParseMode,
    config?: config.RConfig
  ): void | never {
    this.setupMode(mode);
    const markupHandlers: {
      XML: [typeof XmlLexer, typeof XmlParser];
      HTML: [typeof HtmlLexer, typeof HtmlParser];
    } = {
      XML: [XmlLexer, XmlParser],
      HTML: [HtmlLexer, HtmlParser],
    };
    const conf = markupHandlers[this.mode];
    // config can be undefined.
    const lexer = new conf[0](markup, config as config.LexerConfig);
    this.parser = new conf[1](lexer, config as config.ParserConfig);
  }

  toString(): string {
    return this.prettify();
  }

  /** api **/

  parse(
    markup: string,
    mode?: ParseMode,
    config?: config.RConfig
  ): nodes.RootNode | never {
    this.setupParser(markup, mode || this.mode, config || this.config);
    return (this.rootNode = this.parser.parse());
  }

  getRoot(): nodes.RootNode {
    return this.rootNode;
  }

  prettify(config?: RenderConfig): string | never {
    // pretty-print the internal node
    return this.prettyPrint(this.rootNode, config);
  }

  prettyPrint(node: nodes.RNodeT, config?: RenderConfig): string | never {
    // pretty-print a given node
    if (!node) return "";
    const r = new Render(config);
    return r.render(node);
  }
}
