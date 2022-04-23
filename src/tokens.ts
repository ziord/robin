export enum TokenType {
  TokenGThan = "TOKEN_G_THAN",
  TokenLThan = "TOKEN_L_THAN",
  TokenQMark = "TOKEN_Q_MARK",
  TokenEqual = "TOKEN_EQUAL",
  TokenText = "TOKEN_TEXT",
  TokenFSlash = "TOKEN_F_SLASH",
  TokenColon = "TOKEN_COLON",
  // compound tokens
  TokenString = "TOKEN_STRING",
  TokenName = "TOKEN_NAME", // could be ELEMENT NAME, ATTRIBUTE IDENTIFIER NAME
  TokenNumber = "TOKEN_NUMBER",
  TokenComment = "TOKEN_COMMENT",
  TokenDoctype = "TOKEN_DOCTYPE",
  TokenCdata = "TOKEN_CDATA",
  // eof, errors,
  TokenEof = "TOKEN_EOF",
  TokenError = "TOKEN_ERROR",
  TokenUnknown = "TOKEN_UNKNOWN",
}

export class Token {
  constructor(
    public value: string,
    public type: TokenType,
    public line: number,
    public col: number,
    public msg?: string | undefined
  ) {}

  toString() {
    return (
      `Token(type=${this.type}, value='${this.value}', ` +
      `line=${this.line}, col=${this.col}, msg='${this.msg || ""}')`
    );
  }
}
