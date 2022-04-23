import * as nodes from "./nodes";
import * as tokens from "./tokens";
import * as lexer from "./lexer";
import * as constants from "./constants";
import assert from "assert";
import { unreachable, Scope, ScopeTable } from "./utils";

export type ParserConfig = Partial<{
  documentName: string;
  readonly allowMissingNamespaces: boolean;
  readonly showWarnings: boolean;
  readonly allowDefaultNamespaceBindings: boolean;
  readonly ensureUniqueNamespacedAttributes: boolean;
}>;

export class NamespaceScopeTable
  implements ScopeTable<string, nodes.NamespaceNode>
{
  public table: Scope<string, nodes.NamespaceNode> = {
    symbols: new Map<string, nodes.NamespaceNode>(),
    enclosingScope: null,
  };
  public disabled!: boolean;

  public disable(): void {
    this.disabled = true;
  }

  public insert(key: string, node: nodes.NamespaceNode): boolean {
    if (this.table.symbols.has(key)) {
      return false;
    }
    this.table.symbols.set(key, node);
    return true;
  }

  public lookup(key: string): nodes.NamespaceNode | undefined {
    let current = this.table;
    while (current) {
      const val = current.symbols.get(key);
      if (val === undefined) {
        current = current.enclosingScope!;
      } else {
        return val;
      }
    }
    return undefined;
  }

  public newScope(): undefined {
    if (this.disabled) return;
    this.table = {
      symbols: new Map<string, nodes.NamespaceNode>(),
      enclosingScope: this.table,
    };
  }

  public backtrackScope(): undefined {
    if (this.disabled) return;
    if (!this.table.enclosingScope) return;
    this.table = this.table.enclosingScope;
  }
}

export class XmlParser {
  protected previousToken!: tokens.Token;
  protected currentToken!: tokens.Token;
  protected stack: Array<nodes.RNodeT> = [];
  protected rootNode!: nodes.RootNode;
  protected pos = 0;
  protected config: ParserConfig;
  protected isRootElementClosed = false;
  protected currentScope = new NamespaceScopeTable();
  private warnings = 0;
  private uniqueNames = new Map<string, null>();
  private namespacedAttributes: Array<nodes.AttributeNode> = []; // namespaced attributes

  constructor(protected lexer: lexer.Lexer, config?: ParserConfig) {
    this.config = {
      documentName: "Document",
      showWarnings: true,
      allowMissingNamespaces: false,
      allowDefaultNamespaceBindings: true,
      ensureUniqueNamespacedAttributes: true,
      ...(config || {}),
    };
  }

  protected push(node: nodes.RNodeT): void {
    this.stack.push(node);
  }

  protected pop(): nodes.RNodeT {
    return <nodes.RNodeT>this.stack.pop();
  }

  protected warn(token?: tokens.Token, msg?: string): undefined {
    this.warnings++;
    if (!this.config.showWarnings) return;
    assert(token || msg, "Expected token or msg params");
    if (token) {
      const tab = "    ";
      console.warn(
        `${token.line.toString().padStart(4, "0")} | ${
          token.msg || "[Warning]"
        } at column ${token.col}`
      );
      console.warn(`${tab} | ${token.value}`);
      console.warn(
        `${tab} | ${token.value
          .split("")
          .map(() => "^")
          .join("")}`
      );
      console.warn(
        `${tab} | ${msg ? msg : "A warning was issued while parsing."}`
      );
    } else if (msg) {
      console.warn(`Warning: ${msg}`);
    }
    console.warn();
  }

  protected error(token?: tokens.Token, msg?: string): never {
    /*
      line | error message
           | token...
           | ^^^^^^^^^
     */
    assert(token || msg, "Expected token or msg params");
    if (token) {
      const tab = "    ";
      console.error(
        `${token.line.toString().padStart(4, "0")} | ${
          token.msg || "[Error]"
        } at column ${token.col}`
      );
      console.error(`${tab} | ${token.value}`);
      console.error(
        `${tab} | ${token.value
          .split("")
          .map(() => "^")
          .join("")}`
      );
      console.error(
        `${tab} | ${msg ? msg : "A problem occurred while parsing."}`
      );
    } else if (msg) {
      console.error(`Error occurred while parsing: ${msg}`);
    }
    console.error();
    throw new Error();
  }

  protected advance(failOnError = true): void | never {
    this.previousToken = this.currentToken;
    const token: tokens.Token = this.lexer.getToken();
    if (token.type === tokens.TokenType.TokenError) {
      failOnError ? this.error(token) : void 0;
    } else if (token.type === tokens.TokenType.TokenUnknown) {
      this.error(token);
    }
    this.currentToken = token;
  }

  protected consume(tokenType: tokens.TokenType): void | never {
    if (this.currentToken.type === tokenType) {
      this.advance();
    } else {
      this.error(this.currentToken, `Expected token of type ${tokenType}`);
    }
  }

  protected check(tokenType: tokens.TokenType): boolean {
    return this.currentToken.type === tokenType;
  }

  protected match(tokenType: tokens.TokenType): boolean {
    if (this.check(tokenType)) {
      this.advance();
      return true;
    }
    return false;
  }

  protected createRoot(): void {
    // create root node
    this.rootNode = new nodes.RootNode(this.config.documentName!);
    this.push(this.rootNode);
    // create global namespace
    for (let i = 0; i < constants.ReservedXmlPrefixes.length; ++i) {
      const ns = new nodes.NamespaceNode(
        constants.ReservedXmlPrefixes[i],
        constants.ReservedXmlUris[i]
      );
      ns.isGlobal = true;
      this.currentScope.insert(ns.prefix, ns);
      this.rootNode.namespaces.push(ns);
    }
  }

  protected getParent(): nodes.ElementNode | nodes.RootNode {
    return <nodes.ElementNode | nodes.RootNode>(
      this.stack[this.stack.length - 1]
    );
  }

  protected setParent(node: nodes.RNodeT): void {
    const parent: nodes.RParentNodeT = this.getParent();
    node.index = parent.children.push(node) - 1;
    node.parent = parent;
  }

  protected resolveNamespaces(
    elem: nodes.ElementNode,
    token: tokens.Token
  ): void | never {
    /* Constraints
     * (2) Prefix Declared
     *     The namespace prefix, unless it is xml or xmlns, MUST have been
     *     declared in a namespace declaration attribute in either the start-tag
     *     of the element where the prefix is used or in an ancestor element
     *     (i.e., an element in whose content the prefixed markup occurs).
     *
     * (4) Attributes Unique
     *     No element must have two attributes with the same expanded name.
     */

    // first, resolve element's namespace
    let ns: nodes.NamespaceNode | undefined;
    let prefix: string = elem.name.pname;
    if (prefix) {
      ns = this.currentScope.lookup(prefix);
      if (!ns) {
        if (this.config.allowMissingNamespaces) return;
        // Constraint 2.
        this.error(
          token,
          `Could not resolve namespace with prefix '${prefix}' for element '${elem.name}'`
        );
      }
      elem.namespace = ns;
      elem.isNamespaced = true;
    } else if (this.config.allowDefaultNamespaceBindings) {
      ns = this.currentScope.lookup(constants.XmlnsPrefix);
      // only attach default or non-global namespace to `elem`
      if (ns && ns.isDefault) {
        elem.namespace = ns;
        elem.isNamespaced = true;
      }
    }

    // next, resolve attributes' namespaces
    for (const attr of this.namespacedAttributes) {
      prefix = attr.name.pname;
      ns = this.currentScope.lookup(attr.name.pname);
      if (!ns) {
        if (this.config.allowMissingNamespaces) return;
        // Constraint 2.
        this.error(
          token,
          `Could not resolve namespace with prefix '${prefix}' for attribute '${attr.name}'`
        );
      }
      attr.namespace = ns;
      if (this.config.ensureUniqueNamespacedAttributes) {
        // obtain attribute's expanded name, and check for uniqueness
        // expanded name => namespace name (uri) + local name
        const expandedName = `${ns.uri.trim()}:${attr.name.lname}`;
        const size = this.uniqueNames.size;
        // Constraint 3.
        if (this.uniqueNames.set(expandedName, null).size === size) {
          this.error(
            token,
            "Duplicate attributes found in element declaration"
          );
        }
      }
    }
    this.namespacedAttributes = [];
    this.uniqueNames.clear();
  }

  /* parsing */

  protected parseName(isElementName?: boolean): nodes.RName | never {
    // qname -> pname : lname
    // qname -> lname
    const name = new nodes.RName("", "", "");
    const prefixToken = this.currentToken;
    if (this.match(tokens.TokenType.TokenName)) {
      const first = this.previousToken.value;
      name.qname += first;
      if (this.match(tokens.TokenType.TokenColon)) {
        this.consume(tokens.TokenType.TokenName);
        name.pname = first;
        name.lname = this.previousToken.value;
        name.qname += ":" + name.lname;
      } else {
        name.lname = name.qname;
      }
      // All other prefixes beginning with the three-letter sequence x, m, l, in any
      // case combination, are reserved. users SHOULD NOT use them except as defined by
      // later specifications
      if (
        name.pname &&
        name.pname !== constants.XmlnsName && // exclude xmlns
        name.pname.length > constants.XmlPrefix.length && // exclude xml
        name.pname.toLowerCase().startsWith(constants.XmlPrefix)
      ) {
        this.warn(this.previousToken, "prefix should not contain xml");
      }
      // it is inadvisable to use prefixed names whose LocalPart begins with the letters x, m, l,
      // in any case combination, as these names would be reserved if used without a prefix
      if (
        name.pname &&
        name.lname.length > constants.XmlPrefix.length &&
        name.lname.toLowerCase().startsWith(constants.XmlPrefix)
      ) {
        this.warn(this.previousToken, "local name should not contain xml");
      }
      // Constraint 1.(d) Element names MUST NOT have the prefix xmlns.
      if (isElementName && name.pname === constants.XmlnsPrefix) {
        this.error(
          prefixToken,
          "Element names must not have the prefix 'xmlns'"
        );
      }
      return name;
    } else {
      // unreachable
      unreachable(`Expected attribute name - ${this.currentToken}`);
    }
  }

  protected parseXmlDecl(): void {
    if (!this.check(tokens.TokenType.TokenLThan)) {
      return;
    }
    // possibly PI | xml decl | element
    this.advance();
    if (!this.check(tokens.TokenType.TokenQMark)) {
      return;
    }
    this.advance();
    if (!this.check(tokens.TokenType.TokenName)) {
      return;
    }
    const token = this.currentToken;
    if (token.value.toLowerCase() !== constants.XmlPrefix) {
      this.parsePI(true);
      return;
    }
    this.advance();
    // <?xml attr='value'?>
    const node = new nodes.XMLDeclNode();
    node.setPosition(this.pos++);
    if (!this.check(tokens.TokenType.TokenQMark)) {
      do {
        const attr = <nodes.AttributeNode>this.parseAttribute(node);
        node.attributes.set(attr.name.qname, attr);
      } while (!this.check(tokens.TokenType.TokenQMark));
    }
    this.consume(tokens.TokenType.TokenQMark);
    this.consume(tokens.TokenType.TokenGThan);
    node.parent = this.rootNode;
    this.rootNode.xmlDecl = { node, pos: this.rootNode.children.length };
    // skip trailing newlines
    if (
      this.check(tokens.TokenType.TokenText) &&
      this.currentToken.value === "\n"
    )
      this.advance();
  }

  protected parseDoctype(): void {
    const value = this.currentToken.value;
    this.advance();
    const node = new nodes.DTDNode(value);
    node.setPosition(this.pos++);
    node.parent = this.rootNode;
    const pos =
      this.rootNode.xmlDecl !== null
        ? this.rootNode.xmlDecl.pos + 1
        : this.rootNode.children.length;
    this.rootNode.dtdDecl = { node, pos };
    // skip trailing newlines
    if (
      this.check(tokens.TokenType.TokenText) &&
      this.currentToken.value === "\n"
    )
      this.advance();
  }

  protected parseProlog() {
    // prolog ::= XMLDecl? Misc*(doctypedecl Misc*)?
    this.parseXmlDecl();
    this.miscS();
    if (this.check(tokens.TokenType.TokenDoctype)) {
      this.parseDoctype();
      this.miscS();
    }
  }

  protected parseNamespace(
    parent: nodes.ElementNode
  ): nodes.NamespaceNode | never {
    /*
     * Constraints:
     * (1) Reserved Prefixes and Namespace Names
     *     (a) The prefix xml is by definition bound to the namespace name
     *         http://www.w3.org/XML/1998/namespace. It MAY, but need not, be declared,
     *         and MUST NOT be bound to any other namespace name. Other prefixes MUST NOT
     *         be bound to this namespace name, and it MUST NOT be declared as the default namespace.
     *     (b) The prefix xmlns is used only to declare namespace bindings and is by definition bound
     *         to the namespace name http://www.w3.org/2000/xmlns/. It MUST NOT be declared.
     *     (c) Other prefixes MUST NOT be bound to this namespace name, and it MUST NOT be declared
     *         as the default namespace.
     *     (d) Element names MUST NOT have the prefix xmlns.
     *
     * (2) Prefix Declared
     *     The namespace prefix, unless it is xml or xmlns, MUST have been
     *     declared in a namespace declaration attribute in either the start-tag
     *     of the element where the prefix is used or in an ancestor element
     *     (i.e., an element in whose content the prefixed markup occurs).
     *
     * (3) No Prefix Undeclaring
     *     In a namespace declaration for a prefix (i.e., where the NSAttName is a PrefixedAttName),
     *     the attribute value MUST NOT be empty.
     *
     * (4) Attributes Unique
     *     No element must have two attributes with the same expanded name.
     */

    // name -> xmlns:someName, pname -> 'xmlns', lname -> actual namespace prefix
    const startToken = this.currentToken;
    const name: nodes.RName = this.parseName();
    this.consume(tokens.TokenType.TokenEqual);
    this.consume(tokens.TokenType.TokenString);
    const uri: string = this.previousToken.value.trim();
    const hasXmlPrefix = name.lname === constants.XmlPrefix;
    const hasXmlnsPrefix =
      name.lname === constants.XmlnsPrefix && name.lname !== name.qname;
    // Constraints 1a. 'xml' prefix
    if (hasXmlPrefix) {
      if (uri !== constants.XmlUri) {
        this.error(
          this.previousToken,
          "The xml prefix must not be bound to any other namespace name (uri)"
        );
      }
    } else if (!name.pname) {
      if (uri === constants.XmlUri) {
        this.error(
          this.previousToken,
          "The xml namespace name (uri) must not be declared as a default namespace"
        );
      }
    } else if (uri === constants.XmlUri) {
      this.error(
        this.previousToken,
        "Prefixes other than 'xml' must not be bound to this namespace name (uri)"
      );
    }
    // Constraints 1b-c. 'xmlns' prefix
    if (hasXmlnsPrefix) {
      this.error(
        startToken,
        "The prefix 'xmlns' must not be declared (as a namespace prefix)"
      );
    } else if (!name.pname) {
      if (uri === constants.XmlnsUri) {
        this.error(
          this.previousToken,
          "The xmlns namespace name (uri) must not be declared as a default namespace"
        );
      }
    } else if (uri === constants.XmlnsUri) {
      this.error(
        this.previousToken,
        "Prefixes other than 'xmlns' must not be bound to this namespace name (uri)"
      );
    }
    // Constraints 3.
    if (name.lname && !uri) {
      this.error(
        this.previousToken,
        "Attribute value cannot be empty for a namespace with a prefix"
      );
    }
    const isDefault = name.lname === constants.XmlnsName;
    const node = new nodes.NamespaceNode(isDefault ? "" : name.lname, uri);
    node.parent = parent;
    node.isDefault = isDefault;
    node.setPosition(this.pos++);
    if (!this.currentScope.insert(node.prefix, node)) {
      this.error(
        startToken,
        "Duplicate namespace declaration found in element"
      );
    }
    // insert the namespace into the current scope, if it has no prefix, use 'xmlns'
    this.currentScope.insert(node.prefix || constants.XmlnsName, node);
    return node;
  }

  protected parseAttribute(
    parent: nodes.XMLDeclNode | nodes.ElementNode
  ): nodes.AttributeNode | nodes.NamespaceNode | never {
    if (this.currentToken.value === constants.XmlnsPrefix) {
      if (!nodes.isElement(parent)) {
        this.error(
          this.currentToken,
          "Xml declaration cannot contain namespaces"
        );
      }
      return this.parseNamespace(parent);
    }
    const name: nodes.RName = this.parseName();
    this.consume(tokens.TokenType.TokenEqual);
    this.consume(tokens.TokenType.TokenString);
    const node = new nodes.AttributeNode(name, this.previousToken.value);
    node.parent = parent;
    node.setPosition(this.pos++);
    if (node.name.pname) {
      this.namespacedAttributes.push(node);
    }
    return node;
  }

  protected handleContent(node: nodes.ElementNode, name: nodes.RName) {
    if (this.check(tokens.TokenType.TokenFSlash)) {
      this.advance();
      this.consume(tokens.TokenType.TokenGThan);
      node.isSelfEnclosing = true;
    } else {
      // >....</end>
      this.push(node);
      this.consume(tokens.TokenType.TokenGThan);
      // content: (element  |  CharData  |  Reference  |  CDSect  |  PI  |  Comment)*
      do {
        this.misc(false);
      } while (
        !this.check(tokens.TokenType.TokenFSlash) &&
        !this.check(tokens.TokenType.TokenEof)
      );
      // closing tag
      this.consume(tokens.TokenType.TokenFSlash);
      const endName: nodes.RName = this.parseName();
      if (endName.qname !== name.qname) {
        this.error(
          this.previousToken,
          `Closing tag mismatch. Do you mean '${name.qname}'?`
        );
      }
      this.consume(tokens.TokenType.TokenGThan);
      this.pop();
    }
  }

  protected parseElement(): void | never {
    // for each element, create a new namespace scope
    this.currentScope.newScope();
    const startToken: tokens.Token = this.currentToken;
    const name: nodes.RName = this.parseName(true);
    const node = new nodes.ElementNode(name);
    if (!this.rootNode.rootElement) this.rootNode.rootElement = node;
    this.setParent(node);
    node.setPosition(this.pos++);

    let attr: nodes.AttributeNode | nodes.NamespaceNode;
    while (this.check(tokens.TokenType.TokenName)) {
      attr = this.parseAttribute(node);
      if (nodes.isAttribute(attr)) {
        node.attributes.set(attr.name.qname, attr);
      } else {
        node.namespaces.push(attr);
      }
    }
    // resolve namespaces
    this.resolveNamespaces(node, startToken);

    // handle content
    this.handleContent(node, name);

    node.attributes.size ? (node.hasAttribute = true) : void 0;
    node.hasChild = !node.isSelfEnclosing && !!node.children.length;
    node.hasParent = !!node.parent;
    node.hasAttribute = node.attributes.size > 0;

    if (this.rootNode.rootElement === node) {
      this.isRootElementClosed = true;
    } else if (this.isRootElementClosed) {
      this.error(startToken, "Multiple root elements are prohibited");
    }
    // backtrack current scope
    this.currentScope.backtrackScope();
  }

  protected parseComment(): void {
    // exclude '<!--' and '-->'
    const node = new nodes.CommentNode(this.currentToken.value.slice(4, -3));
    node.setPosition(this.pos++);
    this.setParent(node);
    this.advance();
    if (nodes.isElement(node.parent)) {
      node.parent.hasComment = true;
    }
  }

  protected parsePI(ignoreQmark?: boolean): void | never {
    // skip '?'
    ignoreQmark ? void 0 : this.advance();
    let target: string;
    const index = this.lexer.getCurrentIndex();
    if (this.match(tokens.TokenType.TokenName)) {
      target = this.previousToken.value;
    } else {
      this.error(this.currentToken, "Expected processing instruction target");
    }
    while (!this.check(tokens.TokenType.TokenQMark)) {
      this.advance();
      if (this.check(tokens.TokenType.TokenEof)) {
        this.error(
          this.currentToken,
          "Unexpected end of processing instruction"
        );
      }
    }
    const value = this.lexer.getPILexeme(index);
    this.consume(tokens.TokenType.TokenQMark);
    this.consume(tokens.TokenType.TokenGThan);
    const node = new nodes.PINode(target, value);
    node.setPosition(this.pos++);
    this.setParent(node);
  }

  protected parseText(expectsWhitespaceOnly?: boolean): void {
    let value = this.currentToken.value;
    const isCdata = this.check(tokens.TokenType.TokenCdata);
    if (isCdata) {
      // '<![CDATA['...']]>'
      value = value.slice(9, -3);
    }
    this.advance();
    if (expectsWhitespaceOnly && value.trim()) {
      this.warn(
        this.previousToken,
        "Text at this part should be whitespace only."
      );
    }
    const node = new nodes.TextNode(value);
    node.isCData = isCdata;
    node.hasEntity = constants.XmlPredefinedEntities.some((p) =>
      value.includes(p)
    );
    node.setPosition(this.pos++);
    this.setParent(node);
    if (nodes.isElement(node.parent)) {
      node.parent.hasText = true;
    }
  }

  protected misc(whitespaceText = true): void | never {
    // Misc ::= Comment | PI |  S
    if (this.check(tokens.TokenType.TokenLThan)) {
      this.advance();
    }
    switch (this.currentToken.type) {
      case tokens.TokenType.TokenName:
        this.parseElement();
        break;
      case tokens.TokenType.TokenQMark: // PI
        this.parsePI();
        break;
      case tokens.TokenType.TokenComment: // Comment
        this.parseComment();
        break;
      case tokens.TokenType.TokenText: // whitespace text?
      case tokens.TokenType.TokenCdata:
        this.parseText(whitespaceText);
        break;
      case tokens.TokenType.TokenFSlash: // elem closing tag
        break;
      default:
        unreachable(
          `Token found at an unexpected position - ${this.currentToken}`
        );
    }
  }

  protected miscS(): void | never {
    const expected: tokens.TokenType[] = [
      tokens.TokenType.TokenLThan,
      tokens.TokenType.TokenComment,
      tokens.TokenType.TokenText,
      tokens.TokenType.TokenCdata,
    ];
    while (expected.includes(this.currentToken.type)) {
      this.misc();
    }
  }

  protected parseDocument(): void | never {
    // document ::= prolog element Misc*
    this.advance();
    this.parseProlog();
    if (
      this.match(tokens.TokenType.TokenLThan) ||
      this.check(tokens.TokenType.TokenName)
    ) {
      this.parseElement();
    }
    this.miscS();
    this.consume(tokens.TokenType.TokenEof);
    this.rootNode.hasChild = !!this.rootNode.children.length;
    this.rootNode.isWellFormed = !this.warnings;
  }

  parse(): nodes.RootNode | never {
    this.createRoot();
    this.parseDocument();
    return this.rootNode;
  }
}

export class HtmlParser extends XmlParser {
  constructor(protected lexer: lexer.Lexer, config?: ParserConfig) {
    super(lexer, config);
    this.currentScope.disable();
  }

  private isVoidElement(name: nodes.RName): boolean {
    return constants.HtmlVoidElementNames.includes(name.qname);
  }

  protected resolveNamespaces(
    elem: nodes.ElementNode,
    token: tokens.Token
  ): undefined {
    void elem;
    void token;
    return;
  }

  protected createRoot() {
    this.rootNode = new nodes.RootNode(this.config.documentName!);
    this.push(this.rootNode);
  }

  protected handleContent(node: nodes.ElementNode, name: nodes.RName) {
    node.mode = "HTML";
    if (this.check(tokens.TokenType.TokenFSlash)) {
      this.advance();
      node.isVoid = this.isVoidElement(name);
      node.isSelfEnclosing = !node.isVoid;
      this.consume(tokens.TokenType.TokenGThan);
    } else {
      if (!this.isVoidElement(name)) {
        this.push(node);
        const scriptTag = "script";
        const isScriptTag = name.qname === scriptTag;
        let skipFSlash = false;
        if (!isScriptTag) {
          // >....</end>
          this.consume(tokens.TokenType.TokenGThan);
          // content: (element  |  CharData  |  Reference  |  CDSect  |  PI  |  Comment)*
          do {
            this.misc(false);
          } while (
            !this.check(tokens.TokenType.TokenFSlash) &&
            !this.check(tokens.TokenType.TokenEof)
          );
        } else {
          // we do not consume '>' of the script element's opening tag, since
          // this could accidentally move the lexer's current index beyond the point where
          // the "</" lexeme can be found.
          let token: tokens.Token;
          do {
            token = this.lexer.createSyntheticToken(
              "</",
              tokens.TokenType.TokenFSlash
            );
            if (token.type === tokens.TokenType.TokenFSlash) {
              this.advance();
              if (
                this.check(tokens.TokenType.TokenName) &&
                this.currentToken.value === scriptTag
              ) {
                // create synthetic text node
                if (token.value.trim()) {
                  const child = new nodes.TextNode(token.value);
                  child.parent = node;
                  node.children.push(child);
                }
                skipFSlash = true;
                break;
              }
            }
          } while (
            isScriptTag &&
            !this.check(tokens.TokenType.TokenEof) &&
            token.type !== tokens.TokenType.TokenError
          );
        }
        skipFSlash ? void 0 : this.consume(tokens.TokenType.TokenFSlash);
        const endName: nodes.RName = this.parseName();
        if (endName.qname !== name.qname) {
          this.error(
            this.previousToken,
            `Closing tag mismatch. Do you mean '${name.qname}'?`
          );
        }
        this.consume(tokens.TokenType.TokenGThan);
        this.pop();
      } else {
        node.isVoid = true;
        this.consume(tokens.TokenType.TokenGThan);
      }
    }
  }

  protected parseNamespace(parent: nodes.ElementNode): nodes.NamespaceNode {
    // only default namespaces get here
    const startToken = this.currentToken;
    this.parseName();
    this.consume(tokens.TokenType.TokenEqual);
    this.consume(tokens.TokenType.TokenString);
    const uri: string = this.previousToken.value.trim();
    // check if xmlns="xhtml uri"
    // ensures appropriate uri is used
    if (uri !== constants.XhtmlUri) {
      this.error(
        startToken,
        "The namespace name (uri) must only be used in a default namespace declaration"
      );
    }
    const node = new nodes.NamespaceNode("", uri);
    node.parent = parent;
    node.isDefault = true;
    node.setPosition(this.pos++);
    return node;
  }

  protected parseAttribute(
    parent: nodes.ElementNode
  ): nodes.AttributeNode | nodes.NamespaceNode | never {
    if (this.currentToken.value === constants.XmlnsPrefix) {
      return this.parseNamespace(parent);
    }
    const name: nodes.RName = this.parseName();
    let value: string;
    if (this.check(tokens.TokenType.TokenEqual)) {
      this.consume(tokens.TokenType.TokenEqual);
      if (this.check(tokens.TokenType.TokenString)) {
        this.consume(tokens.TokenType.TokenString);
        value = this.previousToken.value;
      } else {
        // this.consume(tokens.TokenType.TokenName);
        this.advance(); // tolerate errors
        value = this.previousToken.value;
      }
    } else {
      value = "";
    }
    const node = new nodes.AttributeNode(name, value);
    node.parent = parent;
    node.setPosition(this.pos++);
    return node;
  }

  protected parseProlog() {
    // refine parseProlog() - by excluding parseXmlDecl()
    this.miscS();
    if (this.check(tokens.TokenType.TokenDoctype)) {
      this.parseDoctype();
      this.miscS();
    }
  }
}
