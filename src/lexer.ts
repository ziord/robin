import { Token, TokenType } from "./tokens";

export type LexerConfigItem =
  | "preserveSpace"
  | "preserveComment"
  | "preserveCdata"
  | "preserveDtdStructure";

export type LexerConfig = Partial<Record<LexerConfigItem, boolean>>;

export abstract class Lexer {
  private line = 1;
  private column = 1;
  private startIndex = 0;
  private currentIndex = 0;
  private atError = false;
  private errors: Array<Token> = [];
  private vFlag = ""; // value flag
  private readonly config: LexerConfig;

  constructor(public source: string, config?: LexerConfig) {
    this.config = {
      preserveSpace: true,
      preserveCdata: true,
      preserveComment: true,
      preserveDtdStructure: false,
      ...(config || {}),
    };
  }

  public newToken(type: TokenType, errorMsg?: string, end?: number): Token {
    if (type === TokenType.TokenError) {
      this.atError = true;
      if (this.errors.length) {
        return this.errors[this.errors.length - 1];
      }
    }
    const tok = new Token(
      this.source.slice(
        this.startIndex,
        end !== undefined ? end : this.currentIndex
      ),
      type,
      this.line,
      this.column,
      errorMsg
    );
    this.atError ? this.errors.push(tok) : void 0;
    return tok;
  }

  private errorToken(errorMsg?: string): Token {
    return this.newToken(TokenType.TokenError, errorMsg);
  }

  protected move(): string {
    if (this.source[this.currentIndex] === "\n") {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return this.source[this.currentIndex++];
  }

  private moveN(n: number): void {
    while (n--) this.move();
  }

  public getCurrentIndex(): number {
    return this.currentIndex;
  }

  public getPILexeme(index: number): string {
    // slice from after target to before '?' as in <?target' data...'?>
    return this.source.slice(index, this.currentIndex - 1);
  }

  public createSyntheticToken(str: string, type: TokenType): Token {
    const len = str.length;
    while (
      !this.atEnd() &&
      this.source.slice(this.currentIndex, this.currentIndex + len) !== str
    ) {
      this.move();
    }
    if (this.atEnd()) return this.errorToken("Could not create token");
    this.moveN(len);
    this.vFlag = "";
    const token = this.newToken(
      type,
      undefined,
      this.currentIndex - str.length
    );
    if (token.value.trim().startsWith(">")) {
      token.value = token.value.slice(token.value.indexOf(">") + 1);
    }
    return token;
  }

  protected atEnd(): boolean {
    return this.currentIndex >= this.source.length;
  }

  protected peek(n = 0): string {
    return this.source.charAt(this.currentIndex + n);
  }

  protected expect(sub: string) {
    if (this.atEnd()) return false;
    return (
      this.source.slice(this.currentIndex, this.currentIndex + sub.length) ===
      sub
    );
  }

  protected isDigit(ch: string): boolean {
    return ch >= "0" && ch <= "9";
  }

  protected isAlpha(ch: string): boolean {
    return (ch >= "A" && ch <= "Z") || (ch >= "a" && ch <= "z") || ch === "_";
  }

  private isCommentStart(): boolean {
    // currently at '!', check if we have '!--'
    // return this.peek() === "!" && this.peek(1) === "-" && this.peek(2) === "-";
    return this.expect("!--");
  }

  private isCommentEnd(): boolean {
    // return this.peek() === "-" && this.peek(1) === "-" && this.peek(2) === ">";
    return this.expect("-->");
  }

  private isCdataStart(): boolean {
    // currently at '!', check if we have ![CDATA[
    return this.expect("![CDATA[");
  }

  private isDtdStart(): boolean {
    // currently at '!', check if we have !DOCTYPE
    const dtd = this.source.slice(this.currentIndex, this.currentIndex + 8);
    return dtd.toLowerCase() === "!doctype";
  }

  private isTextStart(current: string): boolean {
    return current !== "<" && current !== ">" && this.vFlag === ">";
  }

  private isNameStart(ch: string): boolean {
    // ":" also a nameStart
    return ch === ":" || this.isAlpha(ch);
  }

  protected abstract isNameChar(ch: string): boolean;

  private skipWhitespace(): undefined {
    if (this.vFlag === ">" && this.config.preserveSpace) return;
    for (;;) {
      switch (this.peek()) {
        case " ":
        case "\r":
        case "\n":
        case "\t":
          this.move();
          break;
        default:
          return;
      }
    }
  }

  protected lexMarkupStart(char: string): Token {
    if (this.isCommentStart()) {
      const token = this.lexComment();
      if (this.atError || this.config.preserveComment) {
        return token;
      }
      return this.getToken();
    } else if (this.isCdataStart()) {
      const token = this.lexCdata();
      if (this.atError || this.config.preserveCdata) {
        return token;
      }
      return this.getToken();
    } else if (this.isDtdStart()) {
      return this.lexDtd();
    } else {
      this.vFlag = char;
      return this.newToken(TokenType.TokenLThan);
    }
  }

  private lexIdentifier(): Token {
    // void current;
    while (this.isNameChar(this.peek())) {
      this.move();
    }
    return this.newToken(TokenType.TokenName);
  }

  private lexNumber(): Token {
    while (this.isDigit(this.peek())) {
      this.move();
      if (this.peek() === ".") this.move();
    }
    // use name?
    return this.newToken(TokenType.TokenNumber);
  }

  private lexComment(): Token {
    // <!--comment-->
    // currently at '<',
    // so skip '!--' (guaranteed because of isCommentStart check)
    this.moveN(3);
    while (!this.atEnd()) {
      if (this.peek() === "-" && this.isCommentEnd()) {
        this.moveN(3);
        return this.newToken(TokenType.TokenComment);
      }
      this.move();
    }
    return this.errorToken("Comment not properly closed");
  }

  private scanString(start?: string): void {
    //! the starting quote may/not have __already__ been consumed
    // when `start` is provided, then the starting quote must have been consumed already
    start = start || this.move();
    while (!this.atEnd() && start !== this.move()) {
      void 0;
    }
  }

  private lexString(start?: string): Token {
    //! the starting quote may/not have __already__ been consumed
    // when `start` is provided, then the starting quote must have been consumed already
    start = start || this.move();
    while (!this.atEnd() && start !== this.move()) {
      void 0;
    }
    return this.atEnd()
      ? this.errorToken("String not properly closed")
      : this.newToken(TokenType.TokenString);
  }

  private lexCdata(): Token {
    // ![CDATA[...]]>
    this.moveN(8);
    while (!this.atEnd()) {
      if (this.peek() === "]" && this.expect("]]>")) {
        this.moveN(3);
        return this.newToken(TokenType.TokenCdata);
      }
      this.move();
    }
    return this.errorToken("CDATA sect not properly closed");
  }

  /** DTD lexing utilities **/
  private skip(char: string, errMsg?: string): Token | null {
    this.space();
    if (this.peek() !== char) {
      return this.errorToken(errMsg);
    }
    this.move();
    return null;
  }

  private space(): void {
    while (!this.atEnd() && /\s/.test(this.peek())) this.move();
  }

  private externalId(isPublic: boolean): void {
    // ExternalID ::=  'SYSTEM' S SystemLiteral
    //              |  'PUBLIC' S PubidLiteral S SystemLiteral

    // skip 'SYSTEM' or 'PUBLIC'
    this.moveN(6);
    this.space();
    if (this.peek() === '"' || this.peek() === "'") {
      this.lexString();
      if (isPublic) {
        this.space();
        if (this.peek() === '"' || this.peek() === "'") {
          this.lexString();
        } else {
          this.errorToken("Expected string literal");
        }
      }
    } else {
      this.errorToken("Expected string literal");
    }
  }

  private peReference(): void {
    // PEReference  ::=  '%' Name ';
    this.move(); // skip '%'

    const start = this.peek();
    if (this.isNameStart(start)) {
      this.lexIdentifier(); // start
      // skip ';'
      this.skip(";", "Invalid PEReference in DTD");
    } else {
      this.errorToken("Expected identifier");
    }
  }

  private pi(): void {
    // skip '<?'
    this.moveN(2);
    while (!this.atEnd() && this.peek() !== "?") {
      this.move();
    }
    if (this.peek() !== "?" || this.peek(1) !== ">") {
      this.errorToken("Invalid processing instruction");
    } else {
      // escape '?>'
      this.moveN(2);
    }
  }

  private mixed(): void {
    // Mixed  ::=  '(' S? '#PCDATA' (S? '|' S? Name)* S? ')*'
    //          |  '(' S? '#PCDATA' S? ')'

    this.move();
    while (this.peek() !== ")" && !this.atEnd()) {
      this.space();
      this.peek() === "|" ? this.move() : void 0;
      this.space();
      this.lexIdentifier();
    }
    if (this.atEnd()) return;
    // skip ')'
    this.skip(")", "Expected ')'");
    if (this.peek() === "*") this.move();
  }

  private cp(): void {
    /*
     * cp           ::=  (Name | choice | seq) ('?' | '*' | '+')?
     * choice       ::=  '(' S? cp ( S? '|' S? cp )+ S? ')'
     * seq          ::=  '(' S? cp ( S? ',' S? cp )* S? ')'
     */
    this.lexIdentifier();
    if (this.peek() === "(") {
      this.choice();
    }
    switch (this.peek()) {
      case "?":
      case "*":
      case "+":
        this.move();
    }
  }

  private choice(): void {
    /*
     * cp           ::=  (Name | choice | seq) ('?' | '*' | '+')?
     * choice       ::=  '(' S? cp ( S? '|' S? cp )+ S? ')'
     * seq          ::=  '(' S? cp ( S? ',' S? cp )* S? ')'
     */
    if (this.peek() === "(") {
      this.move();
      this.space();
    }
    this.cp();
    this.space();
    if (this.peek() === ",") {
      this.seq();
      this.space();
      if (this.peek() !== "|") return;
    }
    while (this.peek() === "|") {
      this.move();
      this.space();
      this.cp();
    }
    // S? is handled in skip()
    this.skip(")", "Expected ')'");
  }

  private seq(): void {
    /*
     * cp           ::=  (Name | choice | seq) ('?' | '*' | '+')?
     * choice       ::=  '(' S? cp ( S? '|' S? cp )+ S? ')'
     * seq          ::=  '(' S? cp ( S? ',' S? cp )* S? ')'
     */
    if (this.peek() === "(") {
      this.move();
      this.space();
      this.cp();
    }
    while (this.peek() === ",") {
      this.move();
      this.space();
      this.cp();
    }
    // S? is handled in skip()
    this.skip(")", "Expected ')'");
  }

  private children(): void {
    /*
     * children     ::=  (choice | seq) ('?' | '*' | '+')?
     * cp           ::=  (Name | choice | seq) ('?' | '*' | '+')?
     * choice       ::=  '(' S? cp ( S? '|' S? cp )+ S? ')'
     * seq          ::=  '(' S? cp ( S? ',' S? cp )* S? ')'
     */
    // we already consumed '(' S? in contentSpec() - so we call these functions directly
    this.choice();
    switch (this.peek()) {
      case "?":
      case "*":
      case "+":
        this.move();
    }
  }

  private contentSpec(): undefined {
    /*
     * contentspec  ::=  'EMPTY' | 'ANY' | Mixed | children
     * children     ::=  (choice | seq) ('?' | '*' | '+')?
     * cp           ::=  (Name | choice | seq) ('?' | '*' | '+')?
     * choice       ::=  '(' S? cp ( S? '|' S? cp )+ S? ')'
     * seq          ::=  '(' S? cp ( S? ',' S? cp )* S? ')'
     * Mixed        ::=  '(' S? '#PCDATA' (S? '|' S? Name)* S? ')*'
     *               |  '(' S? '#PCDATA' S? ')'
     */
    // skip '('
    this.move();
    this.space();
    // Mixed
    if (this.peek() === "#") {
      this.mixed();
      return;
    }
    // children
    this.children();
  }

  private elementDecl(): undefined {
    // elementdecl -> '<!ELEMENT' S Name S contentspec S? '>'
    if (this.expect("ELEMENT")) {
      this.moveN(7);
      this.space();
      this.lexIdentifier();
      this.space();
      // contentspec -> 'EMPTY' | 'ANY' | Mixed | children
      switch (this.peek()) {
        case "E":
          this.moveN(5);
          break;
        case "A":
          this.moveN(3);
          break;
        case "(":
          this.contentSpec();
          break;
        default:
          this.errorToken("Invalid DTD content specification");
          return;
      }
      this.skip(">", "Expected '>' in element decl");
    } else {
      this.errorToken("Unknown DTD markup declaration");
    }
  }

  private defaultDecl(): undefined {
    // DefaultDecl ->  '#REQUIRED' | '#IMPLIED' | (('#FIXED' S)? AttValue)
    this.space();
    const char = this.peek();
    if (char !== "#" && char !== "'" && char !== '"') {
      this.errorToken("Expected DTD default declaration");
      return;
    }
    if (this.peek() == "#") {
      this.move();
      switch (this.peek()) {
        case "R": // #REQUIRED
          this.moveN(8);
          break;
        case "I": // #IMPLIED
          this.moveN(7);
          break;
        case "F": // #FIXED ? optional
          this.moveN(5);
          this.space();
          break;
        default:
          this.errorToken("Unknown DTD default declaration");
          return;
      }
      this.space();
    }
    // AttValue -> '...' | "..."
    if (this.peek() === "'" || this.peek() === '"') {
      this.lexString();
      this.space();
    }
  }

  private enumeration(): void {
    // Enumeration  ::= '(' S? Name (S? '|' S? Name)* S? ')'
    // skip '('
    this.move();
    this.space(); // S?
    this.lexIdentifier(); // Name
    while (this.peek() != ")" && !this.atEnd()) {
      this.space();
      if (this.peek() == "|") this.move();
      this.space();
      this.lexIdentifier();
    }
    // skip ')'
    this.skip(")", "Expected ')'");
  }

  private attType(): undefined {
    /*
     * AttType  ::= 'CDATA' | 'ID' | 'IDREF' | 'IDREFS' | 'ENTITY'
     *          |  'ENTITIES' | 'NMTOKEN' | 'NMTOKENS'
     *          |   ('NOTATION' S) ? '(' S? Name (S? '|' S? Name)* S? ')'
     *          |  '(' S? Nmtoken (S? '|' S? Nmtoken)* S? ')'
     */
    if (this.peek() == "C") {
      this.moveN(5);
    } else if (this.peek() == "N" && this.peek(1) == "O") {
      // ('NOTATION' S) ? '(' S? Name (S? '|' S? Name)* S? ')'
      if (this.expect("NOTATION")) {
        this.moveN(8);
        this.space();
        if (this.peek() == "(") {
          this.enumeration();
        } else {
          this.errorToken("Expected '('");
          return;
        }
      } else {
        this.errorToken("Expected 'NOTATION'");
        return;
      }
    } else if (this.peek() == "(") {
      // '(' S? Nmtoken (S? '|' S? Nmtoken)* S? ')'
      this.enumeration();
    } else if (this.peek() == "I") {
      // ID
      this.moveN(2);
      if (this.peek() == "R") {
        // REF
        this.moveN(3);
        if (this.peek() == "S") this.move();
      }
    } else if (this.peek() == "E") {
      // ENTIT
      this.moveN(5);
      if (this.peek() == "Y") this.move();
      // Y
      else this.moveN(3); // IES
    } else if (this.peek() == "N") {
      // 'NMTOKEN' | 'NMTOKENS'
      this.moveN(7);
      if (this.peek() == "S") this.move();
    }
  }

  private attlistDecl(): void {
    // AttlistDecl -> '<!ATTLIST' S Name AttDef* S? '>'
    if (this.expect("ATTLIST")) {
      this.moveN(7);
      this.space();
      this.lexIdentifier();
      // AttDef ->  S Name S AttType S DefaultDecl
      do {
        this.space();
        this.lexIdentifier();
        this.space();
        /*
         * AttType  ::=  'CDATA' | 'ID' | 'IDREF' | 'IDREFS' | 'ENTITY'
         *              |  'ENTITIES' | 'NMTOKEN' | 'NMTOKENS'
         *              | ('NOTATION' S) ? '(' S? Name (S? '|' S? Name)* S? ')'
         *              | '(' S? Nmtoken (S? '|' S? Nmtoken)* S? ')'
         */
        this.attType();
        this.defaultDecl();
      } while (this.peek() !== ">" && !this.atEnd() && !this.atError);
      this.skip(">", "Expected '>'");
    } else {
      this.errorToken("Unknown DTD markup declaration");
    }
  }

  private entityDecl(): undefined {
    // GEDecl -> '<!ENTITY' S Name S EntityDef S? '>'
    // PEDecl ->  '<!ENTITY' S '%' S Name S PEDef S? '>'
    if (this.expect("ENTITY")) {
      this.moveN(6);
      this.space();
      if (this.peek() == "%") {
        this.move();
        this.space();
      }
      this.lexIdentifier();
      this.space();
      // EntityDef ->  EntityValue | (ExternalID NDataDecl?)
      // 'SYSTEM' S SystemLiteral |  'PUBLIC' S PubidLiteral S SystemLiteral (S 'NDATA' S Name)?
      if (this.expect("SYSTEM")) {
        this.externalId(false);
      } else if (this.expect("PUBLIC")) {
        this.externalId(true);
        this.space();
        // (S 'NDATA' S Name)?
        if (this.peek() == "N") {
          this.moveN(4);
          this.space();
          this.lexIdentifier();
        }
      } else if (this.peek() == "'" || this.peek() == '"') {
        this.lexString();
        this.space();
      } else {
        this.errorToken("Expected EntityDef");
        return;
      }
      this.skip(">", "Expected '>'");
    } else {
      this.errorToken("Unknown DTD markup declaration");
    }
  }

  private notationDecl(): undefined {
    /*
     * NotationDecl  ::=  '<!NOTATION' S Name S (ExternalID | PublicID) S? '>'
     * ExternalID    ::=  'SYSTEM' S SystemLiteral |  'PUBLIC' S PubidLiteral S SystemLiteral
     * PublicID      ::=  'PUBLIC' S PubidLiteral
     */
    if (this.expect("NOTATION")) {
      this.moveN(8);
      this.space();
      this.lexIdentifier();
      this.space();
      if (this.expect("SYSTEM")) {
        this.externalId(false);
      } else if (this.expect("PUBLIC")) {
        this.externalId(false); // 'PUBLIC' S PubidLiteral
        this.space();
        // S SystemLiteral
        if (this.peek() == "'" || this.peek() == '"') {
          this.lexString();
          this.space();
        }
      } else {
        this.errorToken("Expected ExternalID or PublicID");
        return;
      }
      // S? '>'
      this.skip(">", "Expected '>'");
    } else {
      this.errorToken("Unknown DTD markup declaration");
    }
  }

  private markupDecl(): void {
    // markupdecl -> elementdecl | AttlistDecl | EntityDecl
    //             | NotationDecl |  PI | Comment

    let nextChar = this.peek(1);
    if (nextChar === "?") {
      // processing-instruction
      this.pi();
    } else if (
      nextChar === "!" &&
      this.peek(2) === "-" &&
      this.peek(3) === "-"
    ) {
      this.move();
      this.lexComment();
    } else {
      // escape '<!'
      this.moveN(2);
      nextChar = this.peek(1);
      switch (nextChar) {
        case "L": // ELEMENT (elementdecl)
          this.elementDecl();
          break;
        case "T": // ATTLIST (AttlistDecl)
          this.attlistDecl();
          break;
        case "N": // ENTITY (EntityDecl)
          this.entityDecl();
          break;
        case "O": // NOTATION (NotationDecl)
          this.notationDecl();
          break;
        default:
          this.errorToken("Unknown markup declaration");
      }
    }
  }

  private intSubset(): void {
    // intSubset   ::= (markupdecl | PEReference | S)*
    this.space();
    while (!this.atEnd() && (this.peek() === "%" || this.peek() === "<")) {
      if (this.peek() === "%") {
        this.peReference();
      } else {
        this.markupDecl();
      }
      this.space();
      if (this.atError) return;
    }
  }

  private lexDtd(): Token {
    // lexing the dtd utilizes the same logic as done in ziord/cxml
    // doctypedecl -> '<!DOCTYPE' S Name (S ExternalID)? S? ('[' intSubset* ']' S?)? '>'
    // start is '<', current is '!', skip '!DOCTYPE'
    this.moveN(8);
    this.space();
    let errTok: Token | null;
    if (this.isNameStart(this.peek())) {
      // reset start to the beginning of the dtd name.
      // this is done because the beginning '<!DOCTYPE' would be added by the parser.
      this.startIndex = this.currentIndex;
      const dtdNameToken = this.lexIdentifier(); // this.peek()
      //! (S ExternalID)? S?
      // ExternalID -> 'SYSTEM' S SystemLiteral | 'PUBLIC' S PubidLiteral S SystemLiteral
      this.space();
      if (this.expect("SYSTEM")) {
        this.externalId(false);
      } else if (this.expect("PUBLIC")) {
        this.externalId(true);
      }
      // check for errors
      if (this.atError) {
        return this.errorToken();
      }
      //! ('[' intSubset* ']' S?)?
      if (this.peek() === "[") {
        this.move(); // skip "["
        this.intSubset();
        if (this.atError) {
          // reuses the last error token created
          return this.errorToken();
        }
        if ((errTok = this.skip("]", "Expected ']' at intSubset end"))) {
          return errTok;
        }
      }
      // S? '>'
      this.space();
      if ((errTok = this.skip(">", "Expected '>' at end of DTD"))) {
        return errTok;
      }
      if (!this.config.preserveDtdStructure) {
        dtdNameToken.type = TokenType.TokenDoctype;
        return dtdNameToken;
      } else {
        return this.newToken(TokenType.TokenDoctype, "", this.currentIndex - 1);
      }
    }
    return this.errorToken();
  }

  protected lexText() {
    while (!this.atEnd() && this.peek() !== "<") {
      this.move();
    }
    return this.newToken(TokenType.TokenText);
  }

  public getToken(): Token {
    this.skipWhitespace();
    if (this.atError) return this.newToken(TokenType.TokenError);
    this.startIndex = this.currentIndex;
    if (this.atEnd()) return this.newToken(TokenType.TokenEof);
    const char = this.move();
    if (this.isTextStart(char)) {
      return this.lexText();
    } else if (this.isAlpha(char)) {
      return this.lexIdentifier();
    } else if (this.isDigit(char)) {
      return this.lexNumber();
    }
    switch (char) {
      case "<": {
        return this.lexMarkupStart(char);
      }
      case ":": {
        return this.newToken(TokenType.TokenColon);
      }
      case ">": {
        // handle false positives
        if (this.vFlag === ">") {
          return this.lexText();
        }
        this.vFlag = char;
        return this.newToken(TokenType.TokenGThan);
      }
      case "'":
      case '"': {
        const start = this.currentIndex;
        this.scanString(char);
        const current = this.currentIndex;
        if (this.atEnd()) {
          return this.errorToken("String not properly closed");
        }
        this.startIndex = start;
        this.currentIndex = current - 1;
        const token = this.newToken(TokenType.TokenString);
        this.currentIndex = current;
        return token;
      }
      case "=":
        return this.newToken(TokenType.TokenEqual);
      case "/":
        return this.newToken(TokenType.TokenFSlash);
      case "?":
        return this.newToken(TokenType.TokenQMark);
      default:
        return this.newToken(TokenType.TokenUnknown, "Unknown token");
    }
  }
}

export class XmlLexer extends Lexer {
  protected isNameChar(ch: string): boolean {
    return ch === "." || ch === "-" || this.isAlpha(ch) || this.isDigit(ch);
  }
}

export class HtmlLexer extends Lexer {
  protected isNameChar(ch: string): boolean {
    return (
      ch === "." ||
      ch === "-" ||
      ch === ":" ||
      this.isAlpha(ch) ||
      this.isDigit(ch)
    );
  }

  protected lexText(): Token {
    while (!this.atEnd()) {
      if (this.peek() === "<") {
        const next = this.peek(1);
        if (
          next === "/" || // </
          next === "?" || // <?
          this.isAlpha(next) ||
          this.expect("<!--") ||
          this.expect("<![CDATA[")
        ) {
          break;
        }
      }
      this.move();
    }
    return this.newToken(TokenType.TokenText);
  }
}
