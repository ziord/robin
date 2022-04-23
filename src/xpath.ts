import assert from "assert";
import { unreachable } from "./utils";
import * as nodes from "./nodes";

export enum XTokenType {
  TokenName = "TOKEN_NAME", // id
  TokenFSlash = "TOKEN_F_SLASH", // /
  TokenDFSlash = "TOKEN_DF_SLASH", // //
  TokenAt = "TOKEN_AT", // @
  TokenDot = "TOKEN_DOT", // .
  TokenDotDot = "TOKEN_DOT_DOT", // ..
  TokenRBracket = "TOKEN_R_BRACKET", // (
  TokenLBracket = "TOKEN_L_BRACKET", // )
  TokenNumber = "TOKEN_NUMBER",
  TokenLSqrBracket = "TOKEN_L_SQR_BRACKET", // [
  TokenRSqrBracket = "TOKEN_R_SQR_BRACKET", // ]
  TokenPipe = "TOKEN_PIPE", // |
  TokenString = "TOKEN_STRING", // "..."
  TokenComma = "TOKEN_COMMA", // ,
  TokenColon = "TOKEN_COLON", // :
  TokenDColon = "TOKEN_D_COLON", // ::

  // relative binary operators
  TokenLThan = "TOKEN_L_THAN", // <
  TokenGThan = "TOKEN_G_THAN", // >
  TokenEq = "TOKEN_EQ", // =
  TokenLThanEq = "TOKEN_L_THAN_EQ", // <=
  TokenGThanEq = "TOKEN_G_THAN_EQ", // >=
  TokenNotEq = "TOKEN_NOT_EQ", // !=

  // binary and unary operators
  TokenPlus = "TOKEN_PLUS", // +
  TokenMinus = "TOKEN_MINUS", // -
  TokenStar = "TOKEN_STAR", // *

  // named operators
  TokenAnd = "TOKEN_AND", // and
  TokenOr = "TOKEN_OR", // or
  TokenMod = "TOKEN_MOD", // mod
  TokenDiv = "TOKEN_DIV", // div

  // node type
  TokenTextFn = "TOKEN_TEXT_FN", // text()
  TokenCommentFn = "TOKEN_COMMENT_FN", // comment()
  TokenPIFn = "TOKEN_PI_FN", // processing-instruction()
  TokenNodeFn = "TOKEN_NODE_FN", // node()

  // eof
  TokenEnd = "TOKEN_END",
}

class XToken {
  public kType!: XTokenType;
  constructor(
    public type: XTokenType,
    public value: string,
    public column: number,
    public line: number
  ) {
    this.kType = type;
  }
}

export class XLexer {
  private keywords!: Map<string, XTokenType>;
  private currentIndex!: number;
  private startIndex!: number;
  private column!: number;
  private line!: number;
  private coreFns = ["text", "comment", "processing-instruction", "node"];

  constructor(public expr: string) {
    this.keywords = new Map(this.getKeywords());
    this.currentIndex = 0;
    this.startIndex = 0;
    this.column = 0;
    this.line = 1;
  }

  private getKeywords(): [string, XTokenType][] {
    return [
      ["and", XTokenType.TokenAnd],
      ["or", XTokenType.TokenOr],
      ["div", XTokenType.TokenDiv],
      ["mod", XTokenType.TokenMod],
      ["text", XTokenType.TokenTextFn],
      ["node", XTokenType.TokenNodeFn],
      ["processing-instruction", XTokenType.TokenPIFn],
      ["comment", XTokenType.TokenCommentFn],
    ];
  }

  private createToken(type: XTokenType): XToken {
    const value = this.expr.slice(this.startIndex, this.currentIndex);
    return new XToken(type, value, this.column, this.line);
  }

  private errorToken(msg: string): never {
    // const value = this.expr.slice(this.startIndex, this.currentIndex);
    // return new XToken(type, value, this.column, this.line);
    msg = `${msg}\nLine ${this.line} Column ${this.column}`;
    throw new Error(msg);
  }

  private move(): string {
    if (this.expr[this.currentIndex] === "\n") {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return this.expr[this.currentIndex++];
  }

  private moveN(n: number): void {
    while (n--) this.move();
  }

  private peek(n = 0): string {
    return this.expr.charAt(this.currentIndex + n);
  }

  private atEnd(): boolean {
    return this.peek() === "";
  }

  private isDigit(ch: string): boolean {
    return ch >= "0" && ch <= "9";
  }

  private isXDigit(ch: string): boolean {
    return ch.toLowerCase() >= "a" && ch.toLowerCase() <= "f";
  }

  private isAlpha(ch: string): boolean {
    return (ch >= "A" && ch <= "Z") || (ch >= "a" && ch <= "z") || ch === "_";
  }

  private isNameChar(ch: string): boolean {
    return ch === "." || ch === "-" || this.isAlpha(ch) || this.isDigit(ch);
  }

  private skipWhitespace(): void {
    for (;;) {
      const ch = this.peek();
      if (/\s/.test(ch)) {
        this.move();
      } else if (ch === "(" && this.peek(1) === ":") {
        this.skipComment();
      } else {
        break;
      }
    }
  }

  private skipComment(): undefined {
    // comment: (: ... :)
    // skip (:
    this.moveN(2);
    let inNested = 0;
    if (this.peek() === ":") {
      if (this.peek(1) === ")") {
        this.moveN(2);
        return;
      }
      this.move();
    }
    while (!this.atEnd()) {
      if (this.peek() === "(" && this.peek(1) === ":") {
        this.moveN(2);
        inNested++;
        continue;
      } else if (this.peek() === ":" && this.peek(1) === ")") {
        if (inNested) {
          inNested--;
        } else {
          break;
        }
      }
      this.move();
    }
    if (this.atEnd()) {
      this.errorToken("Unterminated comment");
    }
    this.moveN(2); // escape :)
    this.skipWhitespace();
  }

  private lexString(start: string): XToken | never {
    this.startIndex = this.currentIndex;
    while (!this.atEnd() && this.peek() !== start) {
      this.move();
    }
    if (this.atEnd()) {
      this.errorToken("Unclosed string literal");
    }
    const token = this.createToken(XTokenType.TokenString);
    this.move(); // escape closing quote
    return token;
  }

  private lexNumber(): XToken | never {
    const c = this.peek();
    if (this.peek(-1) === "0" && c.toLowerCase() === "x") {
      this.move();
    } else if (c === ".") {
      this.move();
    }
    while (
      !this.atEnd() &&
      (this.isDigit(this.peek()) || this.isXDigit(this.peek()))
    ) {
      this.move();
      if (this.peek() === ".") {
        this.move();
      } else if (this.peek().toLowerCase() === "e") {
        this.move();
        if (this.peek() === "-" || this.peek() === "+") {
          this.move();
        }
      }
    }
    const token = this.createToken(XTokenType.TokenNumber);
    if (Number.isNaN(+token.value)) {
      this.errorToken("Invalid number literal");
    }
    return token;
  }

  private lexIdentifier(): XToken | never {
    while (!this.atEnd() && this.isNameChar(this.peek())) {
      this.move();
    }
    const token: XToken = this.createToken(XTokenType.TokenName);
    const type = this.keywords.get(token.value);
    if (type !== undefined) {
      if (this.coreFns.includes(token.value)) {
        this.skipWhitespace();
        if (this.peek() === "(") {
          token.type = type;
          token.kType = type;
        }
        return token;
      }
      // necessary for keywords used in name context
      token.type = XTokenType.TokenName;
      token.kType = type;
    }
    return token;
  }

  check(char: string) {
    if (this.peek() === char) {
      this.move();
      return true;
    }
    return false;
  }

  getToken(): XToken | never {
    this.skipWhitespace();
    this.startIndex = this.currentIndex;
    if (this.atEnd()) return this.createToken(XTokenType.TokenEnd);
    const char = this.move();
    if (this.isAlpha(char)) {
      return this.lexIdentifier();
    } else if (
      this.isDigit(char) ||
      (char === "." && this.isDigit(this.peek()))
    ) {
      return this.lexNumber();
    }
    switch (char) {
      case "@":
        return this.createToken(XTokenType.TokenAt);
      case "/":
        return this.createToken(
          this.check("/") ? XTokenType.TokenDFSlash : XTokenType.TokenFSlash
        );
      case ":":
        return this.createToken(
          this.check(":") ? XTokenType.TokenDColon : XTokenType.TokenColon
        );
      case ",":
        return this.createToken(XTokenType.TokenComma);
      case '"':
      case "'":
        return this.lexString(char);
      case ".":
        return this.createToken(
          this.check(".") ? XTokenType.TokenDotDot : XTokenType.TokenDot
        );
      case "+":
        return this.createToken(XTokenType.TokenPlus);
      case "-":
        return this.createToken(XTokenType.TokenMinus);
      case "*":
        return this.createToken(XTokenType.TokenStar);
      case "(":
        return this.createToken(XTokenType.TokenLBracket);
      case ")":
        return this.createToken(XTokenType.TokenRBracket);
      case "=":
        return this.createToken(XTokenType.TokenEq);
      case "[":
        return this.createToken(XTokenType.TokenLSqrBracket);
      case "]":
        return this.createToken(XTokenType.TokenRSqrBracket);
      case "|":
        return this.createToken(XTokenType.TokenPipe);
      case "<":
        return this.createToken(
          this.check("=") ? XTokenType.TokenLThanEq : XTokenType.TokenLThan
        );
      case ">":
        return this.createToken(
          this.check("=") ? XTokenType.TokenGThanEq : XTokenType.TokenGThan
        );
      case "!":
        if (this.check("=")) {
          return this.createToken(XTokenType.TokenNotEq);
        }
      // allowed-fallthrough
      default:
        this.errorToken("Unknown token type");
    }
  }

  checkNextToken() {
    const lexer = new XLexer(this.expr);
    lexer.currentIndex = this.currentIndex;
    lexer.startIndex = this.startIndex;
    return lexer.getToken();
  }
}

enum XNodeType {
  UnaryOp = "UNARY_OP_NODE",
  BinaryOp = "BINARY_OP_NODE",
  Predicate = "PREDICATE_NODE",
  Call = "FUNCTION_CALL_NODE",
  Number = "NUMBER_NODE",
  String = "STRING_NODE",
  Step = "STEP_NODE",
  NodeTest = "NODE_TEST_NODE",
  Path = "PATH_NODE",
}

enum OpType {
  OpPlus = "OP_PLUS", // '+'
  OpMinus = "OP_MINUS", // '-'
  OpMul = "OP_MUL", // '*'
  OpDiv = "OP_DIV", // 'div'
  OpMod = "OP_MOD", // 'mod'
  OpEq = "OP_EQ", // '=' (conditional)
  OpNeq = "OP_NEQ", // !=
  OpLt = "OP_LT", // '<'
  OpLeq = "OP_LEQ", // <=
  OpGt = "OP_GT", // '>'
  OpGeq = "OP_GEQ", // >=
  OpAnd = "OP_AND", // 'and'
  OpOr = "OP_OR", // 'or'
  OpPipe = "OP_PIPE", // '|'
}

enum KindTestType {
  Comment = "KIND_TEST_COMMENT", // comment()
  Text = "KIND_TEST_TEXT", // text()
  Node = "KIND_TEST_NODE", // node()
  Pi = "KIND_TEST_PI", // processing-instruction()
}

enum NameTestType {
  Name = "NAME_TEST_NAME", // 'nm'
  Wildcard = "NAME_TEST_WILDCARD", // '*'
  WildcardLocal = "NAME_TEST_WILDCARD_LNAME", // '*:nm'  todo (from xpath 2.0)
  PrefixWildcard = "NAME_TEST_PNAME_WILDCARD", // 'nm:*'
  PrefixLocal = "NAME_TEST_PNAME_LNAME", // 'pf:nm'
}

enum NodeTestType {
  NameTest = "NAME_TEST",
  KindTest = "KIND_TEST",
}

enum Axis {
  Ancestor = "ANCESTOR_AXIS",
  AncestorOrSelf = "ANCESTOR_OR_SELF_AXIS",
  Attribute = "ATTRIBUTE_AXIS",
  Child = "CHILD_AXIS",
  Descendant = "DESCENDANT_AXIS",
  DescendantOrSelf = "DESCENDANT_OR_SELF_AXIS",
  Following = "FOLLOWING_AXIS",
  FollowingSibling = "FOLLOWING_SIBLING_AXIS",
  Namespace = "NAMESPACE_AXIS",
  Parent = "PARENT_AXIS",
  Preceding = "PRECEDING_AXIS",
  PrecedingSibling = "PRECEDING_SIBLING_AXIS",
  Self = "SELF_AXIS",
}

enum DocumentOrder {
  Forward = "FORWARD",
  Reverse = "REVERSE",
}

enum PathSpec {
  Nil,
  Single, // '/' (/foo)
  Double, // '//' (//foo)
}

enum StepSpec {
  Nil,
  Self, // '.' - selects the context node
  Parent, // '..' - selects the context node's parent
}

type KindTest = {
  type: NodeTestType;
  testType: KindTestType;
  target?: string;
};

type NameTest = {
  type: NodeTestType;
  testType: NameTestType;
  name?: nodes.RName;
};

type NodeTest = NameTest | KindTest;

type XNodeT =
  | NumberNode
  | StringNode
  | StepNode
  | CallNode
  | UnaryOpNode
  | BinaryOpNode
  | NodeTestNode
  | PredicateNode
  | PathNode;

class NumberNode {
  public type!: XNodeType;
  public value!: number;

  constructor(value: string) {
    this.type = XNodeType.Number;
    this.value = +value;
  }
}

class StringNode {
  public type!: XNodeType;

  constructor(public value: string) {
    this.type = XNodeType.String;
  }
}

class CallNode {
  public type!: XNodeType;
  public args: XNodeT[] = [];

  constructor(public name: string) {
    this.type = XNodeType.Call;
  }
}

class UnaryOpNode {
  public type!: XNodeType;

  constructor(public node: XNodeT, public op: OpType) {}
}

class BinaryOpNode {
  public type!: XNodeType;

  constructor(
    public leftNode: XNodeT,
    public rightNode: XNodeT,
    public op: OpType
  ) {}
}

class NodeTestNode {
  public type!: XNodeType;

  constructor(public test: NodeTest, public axis: Axis) {
    this.type = XNodeType.NodeTest;
  }
}

class StepNode {
  public type!: XNodeType;
  public step: StepSpec = StepSpec.Nil;
  public axis!: Axis;
  public nodeTest: NodeTestNode | null = null;
  public predicates: PredicateNode[] = [];
  public pos = -1;

  constructor(public path: PathSpec) {
    this.type = XNodeType.Step;
  }
}

class PredicateNode {
  public type!: XNodeType;
  public leftExpr?: XNodeT;

  constructor(public expr: XNodeT, public order: DocumentOrder) {
    this.type = XNodeType.Predicate;
  }
}

class PathNode {
  public type!: XNodeType;
  public steps: XNodeT[] = [];

  constructor() {
    this.type = XNodeType.Path;
  }
}

export class XParser {
  private lexer!: XLexer;
  private previousToken!: XToken;
  private currentToken!: XToken;
  constructor(query: string) {
    this.lexer = new XLexer(query);
  }

  protected error(msg: string, token?: XToken): never {
    /*
      line | error message | column
           | token...
           | ^^^^^^^^^
     */
    const tab = "    ";
    token = token || this.currentToken;
    const value: string = token.value || " ";
    const col: number = token.value.length ? token.column - 1 : token.column;
    const src: string = this.lexer.expr.split("\n")[token.line - 1];
    console.error(
      `  ${token.line.toString().padStart(2, "0")} | Error at column ${
        token.column
      }`
    );
    console.error(`${tab} | ${src}`);
    console.error(
      `${tab} | ${"".padStart(col, " ")}${value
        .split("")
        .map(() => "^")
        .join("")}`
    );
    console.error(`${tab} | Reason: ${msg}`);
    console.error();
    throw new Error();
  }

  private advance() {
    this.previousToken = this.currentToken;
    this.currentToken = this.lexer.getToken();
  }

  private consume(type: XTokenType): void | never {
    if (!this.check(type)) {
      this.error("Token found at unexpected position");
    } else {
      this.advance();
    }
  }

  private check(type: XTokenType): boolean {
    return this.currentToken.type === type;
  }

  private checkK(type: XTokenType): boolean {
    return this.currentToken.kType === type;
  }

  private match(type: XTokenType): boolean {
    if (this.check(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  private matchK(type: XTokenType): boolean {
    if (this.checkK(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  private getOp(token: XToken) {
    // use the kType (keyword Type) for the sake of keywords like and/or/...
    switch (token.kType) {
      case XTokenType.TokenAnd:
        return OpType.OpAnd;
      case XTokenType.TokenOr:
        return OpType.OpOr;
      case XTokenType.TokenMinus:
        return OpType.OpMinus;
      case XTokenType.TokenPlus:
        return OpType.OpPlus;
      case XTokenType.TokenDiv:
        return OpType.OpDiv;
      case XTokenType.TokenMod:
        return OpType.OpMod;
      case XTokenType.TokenStar:
        return OpType.OpMul;
      case XTokenType.TokenPipe:
        return OpType.OpPipe;
      case XTokenType.TokenGThan:
        return OpType.OpGt;
      case XTokenType.TokenGThanEq:
        return OpType.OpGeq;
      case XTokenType.TokenLThan:
        return OpType.OpLt;
      case XTokenType.TokenLThanEq:
        return OpType.OpLeq;
      case XTokenType.TokenEq:
        return OpType.OpEq;
      case XTokenType.TokenNotEq:
        return OpType.OpNeq;
      default:
        this.error("Unrecognized operator");
    }
  }

  private getAxis(value: string): Axis {
    let axis: Axis;
    switch (value) {
      case "ancestor":
        axis = Axis.Ancestor;
        break;
      case "ancestor-or-self":
        axis = Axis.AncestorOrSelf;
        break;
      case "attribute":
        axis = Axis.Attribute;
        break;
      case "child":
        axis = Axis.Child;
        break;
      case "descendant":
        axis = Axis.Descendant;
        break;
      case "descendant-or-self":
        axis = Axis.DescendantOrSelf;
        break;
      case "following":
        axis = Axis.Following;
        break;
      case "following-sibling":
        axis = Axis.FollowingSibling;
        break;
      case "namespace":
        axis = Axis.Namespace;
        break;
      case "parent":
        axis = Axis.Parent;
        break;
      case "preceding":
        axis = Axis.Preceding;
        break;
      case "preceding-sibling":
        axis = Axis.PrecedingSibling;
        break;
      case "self":
        axis = Axis.Self;
        break;
      case "@":
        this.advance();
        axis = Axis.Attribute;
        return axis;
      default:
        return Axis.Child;
    }
    this.advance();
    this.consume(XTokenType.TokenDColon);
    return axis;
  }

  private getOrder(axis: Axis): DocumentOrder {
    switch (axis) {
      case Axis.Parent:
      case Axis.Ancestor:
      case Axis.AncestorOrSelf:
      case Axis.Preceding:
      case Axis.PrecedingSibling:
        return DocumentOrder.Reverse;
      default:
        return DocumentOrder.Forward;
    }
  }

  /**..Parsing..**/

  transformStepNode(node: StepNode): StepNode[] {
    if (node.path !== PathSpec.Double) return [node];
    // turn //xyz -> /descendant-or-self::node()/xyz
    // transform '//' to '/descendant-or-self::node()'
    const n = new StepNode(PathSpec.Single);
    n.nodeTest = new NodeTestNode(
      { type: NodeTestType.KindTest, testType: KindTestType.Node },
      Axis.DescendantOrSelf
    );
    n.axis = Axis.DescendantOrSelf;
    node.path = PathSpec.Single; // transform '//' to '/'
    return [n, node];
  }

  private functionCall(): CallNode {
    // QName "(" ( ExprSingle ( "," ExprSingle )* )? ')'
    this.advance(); // skip function name
    const fn = new CallNode(this.previousToken.value);
    // skip left bracket
    this.advance();
    while (
      !this.check(XTokenType.TokenEnd) &&
      !this.check(XTokenType.TokenRBracket)
    ) {
      fn.args.push(this.exprSingle());
      if (!this.check(XTokenType.TokenRBracket)) {
        this.consume(XTokenType.TokenComma);
        if (this.check(XTokenType.TokenRBracket)) {
          this.error(
            "Trailing comma not supported in function call expression"
          );
        }
      }
    }
    if (!this.match(XTokenType.TokenRBracket)) {
      this.error("Unexpected end of query. Expected token right bracket");
    }
    return fn;
  }

  private primaryExpr(pathSpec: PathSpec): XNodeT | null {
    // 	Literal \| VarRef \| ParenthesizedExpr \| ContextItemExpr \| FunctionCall
    // todo: VarRef
    // ContextItemExpr
    if (this.match(XTokenType.TokenDot)) {
      const node = new StepNode(pathSpec);
      node.axis = Axis.Self;
      node.step = StepSpec.Self;
      return node;
    }
    // literal
    else if (this.match(XTokenType.TokenString)) {
      return new StringNode(this.previousToken.value);
    } else if (this.match(XTokenType.TokenNumber)) {
      return new NumberNode(this.previousToken.value);
    }
    // FunctionCall
    else if (this.check(XTokenType.TokenName)) {
      if (
        !["text", "node", "comment", "processing-instruction"].includes(
          this.currentToken.value
        )
      ) {
        const nextToken = this.lexer.checkNextToken();
        if (nextToken.type === XTokenType.TokenLBracket) {
          // FunctionName '(' ( Argument ( ',' Argument )* )? ')'
          return this.functionCall();
        }
      }
    }
    // ParenthesizedExpr
    else if (this.match(XTokenType.TokenLBracket)) {
      const node: XNodeT = this.expr();
      this.consume(XTokenType.TokenRBracket);
      return node;
    }
    return null;
  }

  private predicate(order: DocumentOrder): PredicateNode | never {
    const expr: XNodeT = this.expr();
    this.consume(XTokenType.TokenRSqrBracket);
    return new PredicateNode(expr, order);
  }

  private filterExpr(
    pathSpec: PathSpec,
    stepCount?: number
  ): XNodeT | null | never {
    // PrimaryExpr PredicateList
    // filterExpr is only acceptable at the first step in xpath 1.0
    // however, if the expr is a dot '.' it's acceptable at any step
    if (stepCount && !this.check(XTokenType.TokenDot)) {
      return null;
    }
    let node = this.primaryExpr(pathSpec);
    // ContextItemExpr (.) does not precede predicate-list
    if (!node || node instanceof StepNode) {
      return node;
    }
    // PredicateList -> Predicate* -> "[" Expr "]"
    while (this.match(XTokenType.TokenLSqrBracket)) {
      const pred = this.predicate(DocumentOrder.Forward);
      pred.leftExpr = node;
      node = pred;
    }
    return node;
  }

  private parseNodeTest(): NodeTest | never {
    /*
    NodeTest                    ::=     NameTest
                                        | NodeType '(' ')'
                                        | 'processing-instruction' '(' Literal ')'
    NameTest                    ::=     '*'
                                        | NCName ':' '*'
                                        | QName
    */

    let testType: NameTestType | KindTestType | undefined;
    switch (this.currentToken.type) {
      case XTokenType.TokenPIFn: {
        this.advance();
        testType = KindTestType.Pi;
        this.consume(XTokenType.TokenLBracket);
        let target: string | undefined;
        if (this.match(XTokenType.TokenString)) {
          target = this.previousToken.value;
          if (!target) {
            target = "#"; // todo: err?
          }
        }
        this.consume(XTokenType.TokenRBracket);
        return { type: NodeTestType.KindTest, testType, target };
      }
      default: {
        switch (this.currentToken.type) {
          case XTokenType.TokenNodeFn: {
            testType = KindTestType.Node;
            break;
          }
          case XTokenType.TokenCommentFn: {
            testType = KindTestType.Comment;
            break;
          }
          case XTokenType.TokenTextFn: {
            testType = KindTestType.Text;
            break;
          }
        }
        if (testType !== undefined) {
          this.advance();
          this.consume(XTokenType.TokenLBracket);
          this.consume(XTokenType.TokenRBracket);
          return { type: NodeTestType.KindTest, testType };
        }
        break;
      }
    }
    if (this.match(XTokenType.TokenName)) {
      const name = this.previousToken.value;
      if (this.match(XTokenType.TokenColon)) {
        let local: string, testType: NameTestType;
        if (this.match(XTokenType.TokenName)) {
          local = this.previousToken.value;
          testType = NameTestType.PrefixLocal;
        } else {
          this.consume(XTokenType.TokenStar);
          local = "";
          testType = NameTestType.PrefixWildcard;
        }
        const rname = new nodes.RName(
          local ? `${name}:${local}` : "",
          local,
          name
        );
        return {
          type: NodeTestType.NameTest,
          testType,
          name: rname,
        };
      } else {
        const rname = new nodes.RName(name, name, "");
        return {
          type: NodeTestType.NameTest,
          testType: NameTestType.Name,
          name: rname,
        };
      }
    }
    this.consume(XTokenType.TokenStar);
    return { type: NodeTestType.NameTest, testType: NameTestType.Wildcard };
  }

  private nodeTest(axis: Axis): NodeTestNode | never {
    const test: NodeTest = this.parseNodeTest();
    return new NodeTestNode(test, axis);
  }

  private axisStep(pathSpec: PathSpec): StepNode {
    // (ReverseStep \| ForwardStep) PredicateList
    const node = new StepNode(pathSpec);
    if (this.match(XTokenType.TokenDotDot)) {
      node.axis = Axis.Parent;
      node.step = StepSpec.Parent;
      return node;
    }
    // AxisSpecifier -> ancestor | parent | self | ...
    node.axis = this.getAxis(this.currentToken.value);
    node.nodeTest = this.nodeTest(node.axis);
    const order: DocumentOrder = this.getOrder(node.axis);
    while (this.match(XTokenType.TokenLSqrBracket)) {
      const pred = this.predicate(order);
      node.predicates.push(pred);
    }
    return node;
  }

  private stepExpr(pathSpec: PathSpec, stepCount: number): XNodeT {
    // FilterExpr \| AxisStep
    const node = this.filterExpr(pathSpec, stepCount);
    if (node) {
      return node;
    }
    // AxisStep
    return this.axisStep(pathSpec);
  }

  private relativePathExpr(pathSpec: PathSpec): XNodeT | never {
    // StepExpr (("/" \| "//") StepExpr)*
    let step = this.stepExpr(pathSpec, 0);
    if (
      !this.check(XTokenType.TokenFSlash) &&
      !this.check(XTokenType.TokenDFSlash)
    ) {
      // return step as a PathNode
      if (step instanceof StepNode) {
        const node = new PathNode();
        node.steps.push(...this.transformStepNode(step));
        return node;
      }
      return step;
    }
    const node = new PathNode();
    if (step instanceof StepNode) {
      node.steps.push(...this.transformStepNode(step));
    } else if (step instanceof PathNode) {
      // merge steps
      node.steps.push(...step.steps);
    } else {
      node.steps.push(step);
    }
    while (
      this.match(XTokenType.TokenFSlash) ||
      this.match(XTokenType.TokenDFSlash)
    ) {
      pathSpec =
        this.previousToken.type === XTokenType.TokenFSlash
          ? PathSpec.Single
          : PathSpec.Double;
      step = this.stepExpr(pathSpec, node.steps.length);
      assert(step instanceof StepNode, "Expected StepNode after first step");
      node.steps.push(...this.transformStepNode(step));
    }
    return node;
  }

  private pathExpr(): XNodeT {
    // ("/" RelativePathExpr?) \| ("//" RelativePathExpr) \| RelativePathExpr
    let pathSpec: PathSpec;
    if (this.match(XTokenType.TokenFSlash)) {
      pathSpec = PathSpec.Single;
      // RelativePathExpr?
      const continuations = [
        XTokenType.TokenAt,
        XTokenType.TokenDot,
        XTokenType.TokenDotDot,
        XTokenType.TokenStar,
        XTokenType.TokenName,
        XTokenType.TokenNodeFn,
        XTokenType.TokenTextFn,
        XTokenType.TokenPIFn,
        XTokenType.TokenCommentFn,
      ];
      if (!continuations.includes(this.currentToken.type)) {
        // return a PathNode on behalf of relativePathExpr()
        const step = new StepNode(pathSpec);
        step.step = StepSpec.Self;
        const node = new PathNode();
        node.steps.push(step);
        return node;
      }
    } else if (this.match(XTokenType.TokenDFSlash)) {
      pathSpec = PathSpec.Double;
    } else {
      pathSpec = PathSpec.Nil;
    }
    return this.relativePathExpr(pathSpec);
  }

  private unionExpr(): XNodeT {
    // PathExpr ( "|" PathExpr )*
    let left: XNodeT = this.pathExpr();
    while (this.match(XTokenType.TokenPipe)) {
      left = new BinaryOpNode(left, this.pathExpr(), OpType.OpPipe);
    }
    return left;
  }

  private unaryExpr(): XNodeT {
    // UnionExpr | '-' UnaryExpr
    if (this.match(XTokenType.TokenMinus)) {
      return new UnaryOpNode(this.unaryExpr(), OpType.OpMinus);
    }
    // xpath 1.0 does not support `'+' UnaryExpr`, but we'll add it for robustness
    else if (this.match(XTokenType.TokenPlus)) {
      return new UnaryOpNode(this.unaryExpr(), OpType.OpPlus);
    }
    return this.unionExpr();
  }

  private multiplicativeExpr(): XNodeT {
    // UnaryExpr ( ( "*" \| "div" \| "mod") UnaryExpr )*
    let left: XNodeT = this.unaryExpr();
    while (
      this.match(XTokenType.TokenStar) ||
      this.matchK(XTokenType.TokenDiv) ||
      this.matchK(XTokenType.TokenMod)
    ) {
      const op = this.getOp(this.previousToken);
      left = new BinaryOpNode(left, this.unaryExpr(), op);
    }
    return left;
  }

  private additiveExpr(): XNodeT {
    // MultiplicativeExpr ( ("+" \| "-") MultiplicativeExpr )*
    let left: XNodeT = this.multiplicativeExpr();
    while (
      this.match(XTokenType.TokenPlus) ||
      this.match(XTokenType.TokenMinus)
    ) {
      const op = this.getOp(this.previousToken);
      left = new BinaryOpNode(left, this.multiplicativeExpr(), op);
    }
    return left;
  }

  private relationalExpr(): XNodeT {
    // AdditiveExpr ( ("<" \| ">" \| "<=" \| ">=") AdditiveExpr )*
    let left: XNodeT = this.additiveExpr();
    while (
      this.match(XTokenType.TokenLThan) ||
      this.match(XTokenType.TokenGThan) ||
      this.match(XTokenType.TokenLThanEq) ||
      this.match(XTokenType.TokenGThanEq)
    ) {
      const op = this.getOp(this.previousToken);
      left = new BinaryOpNode(left, this.additiveExpr(), op);
    }
    return left;
  }

  private equalityExpr(): XNodeT {
    // RelationalExpr ( ("=" \| "!=") RelationalExpr )*
    let left: XNodeT = this.relationalExpr();
    while (
      this.match(XTokenType.TokenEq) ||
      this.match(XTokenType.TokenNotEq)
    ) {
      const op = this.getOp(this.previousToken);
      left = new BinaryOpNode(left, this.relationalExpr(), op);
    }
    return left;
  }

  private andExpr(): XNodeT {
    // EqualityExpr ( "and" EqualityExpr )*
    let left: XNodeT = this.equalityExpr();
    while (this.matchK(XTokenType.TokenAnd)) {
      const op = this.getOp(this.previousToken);
      left = new BinaryOpNode(left, this.equalityExpr(), op);
    }
    return left;
  }

  private orExpr(): XNodeT {
    // AndExpr ( "or" AndExpr )*
    let left: XNodeT = this.andExpr();
    while (this.matchK(XTokenType.TokenOr)) {
      const op = this.getOp(this.previousToken);
      left = new BinaryOpNode(left, this.andExpr(), op);
    }
    return left;
  }

  private exprSingle(): XNodeT {
    // OrExpr
    return this.orExpr();
  }

  private expr(): XNodeT {
    // ExprSingle
    return this.exprSingle();
  }

  public parse(): XNodeT {
    this.advance();
    const node: XNodeT = this.expr();
    this.consume(XTokenType.TokenEnd);
    return node;
  }
}

/**
 * Data & Context
 */
export type XNodeSet = Set<nodes.RNodeT>;
export type XDataCType = number | string | boolean | XNodeSet;
export type XReturnType = number | string | boolean | nodes.RNodeT;
enum XDataType {
  Number = "XNumber",
  String = "XString",
  Boolean = "XBoolean",
  Nodeset = "XNodeset",
}
type XData = {
  cType: XDataType;
  value: XDataCType;
  nodesetArray?: XNodeSet[];
};

interface XContext {
  pos: number;
  size: number;
  node: nodes.RNodeT;
}

export class XDataEval {
  /**
   * Converters
   */
  static toString(data: XData) {
    switch (data.cType) {
      case XDataType.String:
        return data.value as string;
      case XDataType.Boolean:
        return (data.value as boolean).toString();
      case XDataType.Number:
        return (data.value as number).toString();
      case XDataType.Nodeset: {
        // obtain the string value of the first node in the
        // nodeset (in document order)
        const nodes = Array.from<nodes.RNodeT>(<XNodeSet>data.value);
        return nodes.length ? nodes[0].stringValue() : "";
      }
      default:
        unreachable("XDataEval::toString");
    }
  }

  static toBoolean(data: XData): boolean {
    switch (data.cType) {
      case XDataType.Boolean:
        return data.value as boolean;
      case XDataType.Nodeset:
        return !!(<XNodeSet>data.value).size;
      case XDataType.Number:
        return !!(data.value as number);
      case XDataType.String:
        return !!(data.value as string).length;
      default:
        unreachable("XDataEval::toBoolean");
    }
  }

  static toNumber(data: XData): number {
    switch (data.cType) {
      case XDataType.Number:
        return data.value as number;
      case XDataType.Boolean:
        return (data.value as boolean) ? 1.0 : 0.0;
      case XDataType.Nodeset: {
        // obtain the number value of the first node in the
        // nodeset (in document order)
        const nodes = Array.from(<XNodeSet>data.value);
        return nodes.length ? nodes[0].numberValue() : NaN;
      }
      case XDataType.String: {
        const str = data.value as string;
        return str.length ? +(data.value as string) : NaN;
      }
      default:
        unreachable("XDataEval::toNumeric");
    }
  }

  /**
   * Type checkers
   */
  static isNodeset(data: XData): boolean {
    return data.cType === XDataType.Nodeset;
  }

  static isBoolean(data: XData): boolean {
    return data.cType === XDataType.Boolean;
  }

  static isString(data: XData): boolean {
    return data.cType === XDataType.String;
  }

  static isNumber(data: XData): boolean {
    return data.cType === XDataType.Number;
  }
}

/**
 * States & Steps
 */
class PathState implements nodes.Traversable<nodes.RNodeT> {
  private nodesetArray!: Array<XNodeSet>;
  private nodeset!: XNodeSet;
  private node!: nodes.RNodeT;
  private root!: nodes.RootNode;

  construct(nodeset: XNodeSet, node: nodes.RNodeT, root: nodes.RootNode) {
    this.nodeset = nodeset;
    this.node = node;
    this.root = root;
    this.nodesetArray = [];
  }

  result(): Array<XNodeSet> {
    return this.nodesetArray;
  }

  public traverseAllLinear(
    node: nodes.RNodeT,
    test: nodes.FilterFn,
    result: XNodeSet
  ) {
    if (nodes.isParent(node)) {
      for (const child of node.children) {
        if (test(child)) {
          result.add(child);
        }
      }
    }
  }

  /* istanbul ignore next */
  public traverseAllRecursive(
    node: nodes.RNodeT,
    test: nodes.FilterFn,
    result: XNodeSet
  ) {
    if (nodes.isParent(node)) {
      for (const child of node.children) {
        if (test(child)) {
          result.add(child);
        }
        this.traverseAllRecursive(child, test, result);
      }
    }
  }

  private findAncestors(
    node: nodes.RNodeT,
    test: nodes.FilterFn,
    nodeset: XNodeSet
  ) {
    let parent: nodes.RParentNodeT = <nodes.RParentNodeT>node.parent;
    while (parent) {
      if (test(parent)) {
        nodeset.add(parent);
      }
      parent = <nodes.RParentNodeT>parent.parent;
    }
  }

  private findDescendants(
    node: nodes.RNodeT,
    test: nodes.FilterFn,
    nodeset: XNodeSet
  ) {
    if (!nodes.isParent(node)) {
      return;
    }
    for (const child of node.children) {
      if (test(child)) {
        nodeset.add(child);
      }
      if (nodes.isParent(child)) {
        this.findDescendants(child, test, nodeset);
      }
    }
  }

  private findAttribute(
    node: nodes.ElementNode,
    test: NodeTest,
    nodeset: XNodeSet
  ) {
    if (!node.hasAttribute) return;
    // eslint-disable-next-line  @typescript-eslint/no-unused-vars
    for (const [_, attr] of node.attributes) {
      if (test.type === NodeTestType.KindTest) {
        if (test.testType === KindTestType.Node) {
          nodeset.add(attr);
        }
      } else if (this.isNameTestPassed(attr, <NameTest>test)) {
        nodeset.add(attr);
      }
    }
  }

  /* istanbul ignore next */
  private findNamespace(
    node: nodes.ElementNode,
    test: NodeTest,
    nodeset: XNodeSet
  ) {
    const namespaces: nodes.NamespaceNode[] = node.namespaces.slice();
    node.namespace ? namespaces.push(node.namespace) : void 0;
    for (const ns of namespaces) {
      if (test.type === NodeTestType.KindTest) {
        if (test.testType === KindTestType.Node) {
          nodeset.add(ns);
        }
      } else if (this.isNSNameTestPassed(ns, <NameTest>test)) {
        nodeset.add(ns);
      }
    }
  }

  private findFollowing(
    node: nodes.RNodeT,
    test: nodes.FilterFn,
    nodeset: XNodeSet
  ) {
    let parent: nodes.RParentNodeT;
    let index: number;
    if (nodes.isAttribute(node) || nodes.isNamespace(node)) {
      parent = node.parent as nodes.RParentNodeT;
      // starts from the actual first child of parent
      // since attribute isn't a true child
      index = 0;
    } else {
      parent = node.parent!;
      index = node.index + 1;
    }
    if (!parent) return;
    let children: nodes.RNodeT[] = parent.children;
    do {
      for (let i = index; i < children.length; i++) {
        if (test(children[i])) {
          nodeset.add(children[i]);
        }
        this.findDescendants(children[i], test, nodeset);
      }
      index = parent.index + 1; // climb up-down, next child after parent
      parent = parent.parent!;
      if (!parent) return;
      children = parent.children;
    } while (!nodes.isRoot(parent));
  }

  private findPreceding(
    node: nodes.RNodeT,
    test: nodes.FilterFn,
    nodeset: XNodeSet
  ) {
    let parent: nodes.RParentNodeT;
    let index: number;
    if (nodes.isAttribute(node) || nodes.isNamespace(node)) {
      // parent should be the parent of the element housing the attribute node
      parent = node.parent.parent as nodes.RParentNodeT;
      // starts from the node before the parent/element housing the attribute
      index = (node.parent as nodes.RParentNodeT).index - 1;
    } else {
      parent = node.parent!;
      index = node.index - 1;
    }
    if (!parent || index < 0) return;
    let children: nodes.RNodeT[] = parent.children;
    do {
      for (let i = index; i < children.length && i >= 0; i--) {
        if (test(children[i])) {
          nodeset.add(children[i]);
        }
        this.findDescendants(children[i], test, nodeset);
      }
      index = parent.index - 1; // climb up-down, next child after parent
      parent = parent.parent!;
      if (!parent || index < 0) return;
      children = parent.children;
    } while (!nodes.isRoot(parent));
  }

  private findFollowingSibling(
    node: nodes.RNodeT,
    test: nodes.FilterFn,
    nodeset: XNodeSet
  ) {
    if (
      nodes.isAttribute(node) ||
      nodes.isNamespace(node) ||
      nodes.isRoot(node)
    ) {
      return;
    }
    const children: nodes.RNodeT[] = node.parent.children;
    for (let index = node.index + 1; index < children.length; index++) {
      if (test(children[index])) {
        nodeset.add(children[index]);
      }
    }
  }

  private findPrecedingSibling(
    node: nodes.RNodeT,
    test: nodes.FilterFn,
    nodeset: XNodeSet
  ) {
    if (
      nodes.isAttribute(node) ||
      nodes.isNamespace(node) ||
      nodes.isRoot(node)
    ) {
      return;
    }
    const children: nodes.RNodeT[] = node.parent.children;
    for (let index = node.index - 1; index >= 0; index--) {
      if (test(children[index])) {
        nodeset.add(children[index]);
      }
    }
  }

  private static getAxis(axis: Axis): string | never {
    switch (axis) {
      case Axis.Ancestor:
        return "Ancestor";
      case Axis.AncestorOrSelf:
        return "AncestorOrSelf";
      case Axis.Attribute:
        return "Attribute";
      case Axis.Child:
        return "Child";
      case Axis.Descendant:
        return "Descendant";
      case Axis.DescendantOrSelf:
        return "DescendantOrSelf";
      case Axis.Following:
        return "Following";
      case Axis.FollowingSibling:
        return "FollowingSibling";
      case Axis.Namespace:
        return "Namespace";
      case Axis.Parent:
        return "Parent";
      case Axis.Preceding:
        return "Preceding";
      case Axis.PrecedingSibling:
        return "PrecedingSibling";
      case Axis.Self:
        return "Self";
      default:
        throw new Error("Unknown axis type");
    }
  }

  private compareName(
    node: nodes.ElementNode | nodes.AttributeNode,
    test: NameTest
  ): boolean {
    const name: nodes.RName = node.name;
    const ownNS: nodes.NamespaceNode = node.namespace!;
    // for now, only non-default prefixed namespaces are supported
    if (!ownNS || ownNS.isDefault) return false;
    // obtain the actual namespace bound to the name test starting from the current
    let curr: nodes.RParentNodeT;
    if (nodes.isAttribute(node)) {
      curr = <nodes.RParentNodeT>node.parent;
    } else {
      curr = node; // start from the element
    }
    let testNS: nodes.NamespaceNode | undefined;
    do {
      for (const n of curr.namespaces) {
        if (n.prefix === test.name!.pname) {
          testNS = n;
          break;
        }
      }
      curr = curr.parent!;
    } while (curr);

    if (!testNS) return false;

    if (test.testType === NameTestType.PrefixLocal) {
      // p:l -> compare expanded-name & local-name
      return testNS.uri === ownNS.uri && name.lname === test.name!.lname;
    } else if (test.testType === NameTestType.PrefixWildcard) {
      // p:*
      return testNS === ownNS || testNS.uri === ownNS.uri;
    }
    return false;
  }

  private isNameTestPassed(
    node: nodes.ElementNode | nodes.AttributeNode,
    nt: NameTest
  ): boolean {
    switch (nt.testType) {
      case NameTestType.Wildcard:
        return true;
      case NameTestType.Name:
        return node.name.qname === nt.name!.qname;
      case NameTestType.PrefixLocal:
      case NameTestType.PrefixWildcard:
        return this.compareName(node, nt);
      default:
        unreachable("PathState::isNameTestPassed");
    }
  }

  /* istanbul ignore next */
  private isNSNameTestPassed(node: nodes.NamespaceNode, nt: NameTest): boolean {
    switch (nt.testType) {
      case NameTestType.Wildcard:
        return true;
      case NameTestType.Name:
        return node.prefix === nt.name!.qname;
      case NameTestType.PrefixLocal:
      case NameTestType.PrefixWildcard:
        return false;
      default:
        unreachable("PathState::isNSNameTestPassed");
    }
  }

  private isKindTestPassed(node: nodes.RNodeT, kt: KindTest): boolean {
    switch (kt.testType) {
      case KindTestType.Text:
        return nodes.isText(node);
      case KindTestType.Comment:
        return nodes.isComment(node);
      case KindTestType.Node:
        return true;
      case KindTestType.Pi: {
        if (kt.target) {
          if (nodes.isPI(node)) {
            return kt.target === node.target;
          }
          return false;
        }
        return nodes.isPI(node);
      }
      default:
        unreachable("PathState::isKindTestPassed");
    }
  }

  private addNodeset(nodeset: XNodeSet) {
    if (nodeset.size) {
      this.nodesetArray.push(nodeset);
    }
  }

  public step(node: StepNode): PathState {
    // path-spec -> / | //
    // step -> . | .. | nil
    // axis -> child | parent ,,,
    // nodeTest
    // s1AxisNodetest | s2AxisNodetest | s1Parent | s2Parent | s1Self | s2Self

    // determine the node's resolution path
    let path = `${node.path === PathSpec.Single ? "s1" : "s0"}`;
    if (node.step !== StepSpec.Nil) {
      path += `${node.step === StepSpec.Self ? "Self" : "Parent"}`;
    } else {
      path +=
        PathState.getAxis(node.axis) +
        `${
          node.nodeTest?.test.type === NodeTestType.NameTest
            ? "NameTest"
            : "KindTest"
        }`;
    }
    // eslint-disable-next-line  @typescript-eslint/ban-ts-comment
    //@ts-ignore
    this[path].call(this, node);
    return this;
  }

  /*******************************
   ** s0 -> path-spec-0 -> nil ***
   *******************************/
  private s0Self(node: StepNode) {
    // .
    void node;
    this.nodesetArray.push(new Set<nodes.RNodeT>([this.node]));
  }

  s0Parent(node: StepNode) {
    // ..
    void node;
    const parent = <nodes.RParentNodeT>this.node.parent;
    if (parent) {
      this.nodesetArray.push(new Set<nodes.RNodeT>([parent]));
    }
  }

  //** child axis **//
  private s0ChildNameTest(node: StepNode): void {
    //  child::p:l | child::p:*  | child::n | child::*
    if (nodes.isParent(this.node)) {
      const nodeset: XNodeSet = new Set();
      this.traverseAllLinear(
        this.node,
        (n: nodes.RNodeT) =>
          nodes.isElement(n) &&
          this.isNameTestPassed(n, <NameTest>node.nodeTest!.test),
        nodeset
      );
      this.addNodeset(nodeset);
    }
  }

  private s0ChildKindTest(node: StepNode): void {
    //  child::text() | child::node() | child::pi() | child::comment()
    if (nodes.isParent(this.node)) {
      const nodeset: XNodeSet = new Set();
      this.traverseAllLinear(
        this.node,
        (n: nodes.RNodeT) =>
          this.isKindTestPassed(n, <KindTest>node.nodeTest!.test),
        nodeset
      );
      this.addNodeset(nodeset);
    }
  }

  //** self axis **//
  private s0SelfNameTest(node: StepNode) {
    //  self::p:l | self::p:*  | self::n | self::*
    const test: NameTest = <NameTest>node.nodeTest!.test;
    if (nodes.isElement(this.node) && this.isNameTestPassed(this.node, test)) {
      this.nodesetArray.push(new Set<nodes.RNodeT>([this.node]));
    }
  }

  private s0SelfKindTest(node: StepNode) {
    //  self::text() | self::node() | self::pi() | self::comment()
    const test: KindTest = <KindTest>node.nodeTest!.test;
    if (this.isKindTestPassed(this.node, test)) {
      this.nodesetArray.push(new Set<nodes.RNodeT>([this.node]));
    }
  }

  //** ancestor axis **//
  private s0AncestorNameTest(node: StepNode) {
    //  ancestor::p:l | ancestor::p:*  | ancestor::n | ancestor::*
    const nodeset: XNodeSet = new Set();
    this.findAncestors(
      this.node,
      (n: nodes.RNodeT) =>
        nodes.isElement(n) &&
        this.isNameTestPassed(n, node.nodeTest!.test as NameTest),
      nodeset
    );
    this.addNodeset(nodeset);
  }

  private s0AncestorKindTest(node: StepNode) {
    //  ancestor::text() | ancestor::node() | ancestor::pi() | ancestor::comment()
    const nodeset: XNodeSet = new Set();
    this.findAncestors(
      this.node,
      (n: nodes.RNodeT) =>
        this.isKindTestPassed(n, node.nodeTest!.test as KindTest),
      nodeset
    );
    this.addNodeset(nodeset);
  }

  //** ancestor-or-self axis **//
  private s0AncestorOrSelfNameTest(node: StepNode) {
    //  ancestor-or-self::p:l | ancestor-or-self::p:*
    //  ancestor-or-self::n | ancestor-or-self::*
    const test = <NameTest>node.nodeTest!.test;
    const nodeset: XNodeSet = new Set();
    if (nodes.isElement(this.node) && this.isNameTestPassed(this.node, test)) {
      nodeset.add(this.node);
    }
    this.findAncestors(
      this.node,
      (n: nodes.RNodeT) => nodes.isElement(n) && this.isNameTestPassed(n, test),
      nodeset
    );
    this.addNodeset(nodeset);
  }

  private s0AncestorOrSelfKindTest(node: StepNode) {
    //  ancestor-or-self::text() | ancestor-or-self::node()
    //  ancestor-or-self::pi() | ancestor-or-self::comment()
    const test: KindTest = <KindTest>node.nodeTest!.test;
    const nodeset: XNodeSet = new Set();
    if (this.isKindTestPassed(this.node, test)) {
      nodeset.add(this.node);
    }
    this.findAncestors(
      this.node,
      (n: nodes.RNodeT) => this.isKindTestPassed(n, test),
      nodeset
    );
    this.addNodeset(nodeset);
  }

  //** attribute axis **//
  private s0AttributeNameTest(node: StepNode) {
    //  attribute::p:l | attribute::p:*  | attribute::n | attribute::*
    if (nodes.isElement(this.node)) {
      const nodeset: XNodeSet = new Set();
      this.findAttribute(this.node, <NameTest>node.nodeTest!.test, nodeset);
      this.addNodeset(nodeset);
    }
  }

  private s0AttributeKindTest(node: StepNode) {
    // attribute::text() | attribute::node() | attribute::pi() | attribute::comment()
    if (nodes.isElement(this.node)) {
      const nodeset: XNodeSet = new Set();
      this.findAttribute(this.node, <KindTest>node.nodeTest!.test, nodeset);
      this.addNodeset(nodeset);
    }
  }

  //** descendant axis **//
  private s0DescendantNameTest(node: StepNode) {
    //  descendant::p:l | descendant::p:*  | descendant::n | descendant::*
    const test = <NameTest>node.nodeTest!.test;
    const nodeset: XNodeSet = new Set();
    this.findDescendants(
      this.node,
      (n: nodes.RNodeT) => nodes.isElement(n) && this.isNameTestPassed(n, test),
      nodeset
    );
    this.addNodeset(nodeset);
  }

  private s0DescendantKindTest(node: StepNode) {
    //  descendant::text() | descendant::node() | descendant::pi() | descendant::comment()
    const test = <KindTest>node.nodeTest!.test;
    const nodeset: XNodeSet = new Set();
    this.findDescendants(
      this.node,
      (n: nodes.RNodeT) => this.isKindTestPassed(n, test),
      nodeset
    );
    this.addNodeset(nodeset);
  }

  //** descendant-or-self axis **//
  private s0DescendantOrSelfNameTest(node: StepNode) {
    // descendant-or-self::p:l | descendant-or-self::p:*
    // descendant-or-self::n | descendant-or-self::*
    const test = <NameTest>node.nodeTest!.test;
    const nodeset: XNodeSet = new Set();
    if (nodes.isElement(this.node) && this.isNameTestPassed(this.node, test)) {
      nodeset.add(this.node);
    }
    this.findDescendants(
      this.node,
      (n: nodes.RNodeT) => nodes.isElement(n) && this.isNameTestPassed(n, test),
      nodeset
    );
    this.addNodeset(nodeset);
  }

  private s0DescendantOrSelfKindTest(node: StepNode) {
    // descendant-or-self::text() | descendant-or-self::node()
    // descendant-or-self::pi() | descendant-or-self::comment()
    const test: KindTest = <KindTest>node.nodeTest!.test;
    const nodeset: XNodeSet = new Set();
    if (this.isKindTestPassed(this.node, test)) {
      nodeset.add(this.node);
    }
    this.findDescendants(
      this.node,
      (n: nodes.RNodeT) => this.isKindTestPassed(n, test),
      nodeset
    );
    this.addNodeset(nodeset);
  }

  //** following axis **//
  private s0FollowingNameTest(node: StepNode) {
    //  following::p:l | following::p:*  | following::n | following::*
    const nodeset: XNodeSet = new Set();
    this.findFollowing(
      this.node,
      (n: nodes.RNodeT) =>
        nodes.isElement(n) &&
        this.isNameTestPassed(n, node.nodeTest!.test as NameTest),
      nodeset
    );
    this.addNodeset(nodeset);
  }

  private s0FollowingKindTest(node: StepNode) {
    //  following::text() | following::node() | following::pi() | following::comment()
    const nodeset: XNodeSet = new Set();
    this.findFollowing(
      this.node,
      (n: nodes.RNodeT) =>
        this.isKindTestPassed(n, node.nodeTest!.test as KindTest),
      nodeset
    );
    this.addNodeset(nodeset);
  }

  //** following-sibling axis **//
  private s0FollowingSiblingNameTest(node: StepNode) {
    //  following-sibling::p:l | following-sibling::p:*
    //  | following-sibling::n | following-sibling::*
    const nodeset: XNodeSet = new Set();
    this.findFollowingSibling(
      this.node,
      (n: nodes.RNodeT) =>
        nodes.isElement(n) &&
        this.isNameTestPassed(n, node.nodeTest!.test as NameTest),
      nodeset
    );
    this.addNodeset(nodeset);
  }

  private s0FollowingSiblingKindTest(node: StepNode) {
    //  following-sibling::text() | following-sibling::node() |
    //  following-sibling::pi() | following-sibling::comment()
    const nodeset: XNodeSet = new Set();
    this.findFollowingSibling(
      this.node,
      (n: nodes.RNodeT) =>
        this.isKindTestPassed(n, node.nodeTest!.test as KindTest),
      nodeset
    );
    this.addNodeset(nodeset);
  }

  //** parent axis **//
  private s0ParentNameTest(node: StepNode) {
    // parent::p:l | parent::p:* | parent::n | parent::*
    if (
      this.node.parent &&
      !nodes.isRoot(this.node.parent) &&
      this.isNameTestPassed(
        <nodes.ElementNode>this.node.parent,
        node.nodeTest!.test as NameTest
      )
    ) {
      const nodeset: XNodeSet = new Set();
      nodeset.add(this.node.parent);
      this.addNodeset(nodeset);
    }
  }

  private s0ParentKindTest(node: StepNode) {
    // parent::text() | parent::node() | parent::pi() | parent::comment()
    if (
      this.node.parent &&
      this.isKindTestPassed(this.node.parent, node.nodeTest!.test as KindTest)
    ) {
      const nodeset: XNodeSet = new Set();
      nodeset.add(this.node.parent);
      this.addNodeset(nodeset);
    }
  }

  //** preceding axis **//
  private s0PrecedingNameTest(node: StepNode) {
    // preceding::p:l | preceding::p:* | preceding::n | preceding::*
    const nodeset: XNodeSet = new Set();
    this.findPreceding(
      this.node,
      (n: nodes.RNodeT) =>
        nodes.isElement(n) &&
        this.isNameTestPassed(n, <NameTest>node.nodeTest!.test),
      nodeset
    );
    this.addNodeset(nodeset);
  }

  private s0PrecedingKindTest(node: StepNode) {
    // preceding::text() | preceding::node() | preceding::pi() | preceding::comment()
    const nodeset: XNodeSet = new Set();
    this.findPreceding(
      this.node,
      (n: nodes.RNodeT) =>
        this.isKindTestPassed(n, node.nodeTest!.test as KindTest),
      nodeset
    );
    this.addNodeset(nodeset);
  }

  //** preceding-sibling axis **//
  private s0PrecedingSiblingNameTest(node: StepNode) {
    // preceding-sibling::p:l | preceding-sibling::p:*
    // | preceding-sibling::n | preceding-sibling::*
    const nodeset: XNodeSet = new Set();
    this.findPrecedingSibling(
      this.node,
      (n: nodes.RNodeT) =>
        nodes.isElement(n) &&
        this.isNameTestPassed(n, <NameTest>node.nodeTest!.test),
      nodeset
    );
    this.addNodeset(nodeset);
  }

  private s0PrecedingSiblingKindTest(node: StepNode) {
    // preceding-sibling::text() | preceding-sibling::node()
    // | preceding-sibling::pi() | preceding-sibling::comment()
    const nodeset: XNodeSet = new Set();
    this.findPrecedingSibling(
      this.node,
      (n: nodes.RNodeT) =>
        this.isKindTestPassed(n, node.nodeTest!.test as KindTest),
      nodeset
    );
    this.addNodeset(nodeset);
  }

  /******************************
   ** s1 -> path-spec-1 -> / ****
   ******************************/
  private s1Self(node: StepNode) {
    // /.
    void node;
    if (!this.nodeset.size) {
      this.nodesetArray.push(new Set<nodes.RNodeT>([this.root]));
    } else {
      this.addNodeset(new Set<nodes.RNodeT>(this.nodeset));
    }
  }

  private s1Parent(node: StepNode) {
    // /..
    void node;
    if (!this.nodeset.size) return;
    for (const n of this.nodeset) {
      if (n.parent) {
        const nodeset: XNodeSet = new Set();
        nodeset.add(n.parent);
        this.addNodeset(nodeset);
      }
    }
  }

  //** child axis **//
  private s1ChildNameTest(node: StepNode): void {
    // /child::p:l | /child::p:* | /child::n | /child::*
    const test: NameTest = <NameTest>node.nodeTest!.test;
    if (!this.nodeset.size) {
      const nodeset: XNodeSet = new Set();
      const rootElem: nodes.ElementNode = this.root.rootElement!;
      if (this.isNameTestPassed(rootElem, test)) {
        nodeset.add(rootElem);
      }
      this.addNodeset(nodeset);
    } else {
      for (const item of this.nodeset) {
        if (nodes.isParent(item)) {
          const nodeset: XNodeSet = new Set();
          this.traverseAllLinear(
            item,
            (n: nodes.RNodeT) =>
              nodes.isElement(n) && this.isNameTestPassed(n, test),
            nodeset
          );
          this.addNodeset(nodeset);
        }
      }
    }
  }

  private s1ChildKindTest(node: StepNode): void {
    // /child::text() | /child::node() | /child::pi() | /child::comment()
    const test: KindTest = <KindTest>node.nodeTest!.test;
    if (!this.nodeset.size) {
      // first step
      const nodeset: XNodeSet = new Set();
      const rootElem: nodes.ElementNode = this.root.rootElement!;
      if (this.isKindTestPassed(rootElem, test)) {
        nodeset.add(rootElem);
      }
      this.addNodeset(nodeset);
    } else {
      for (const item of this.nodeset) {
        if (nodes.isParent(item)) {
          const nodeset: XNodeSet = new Set();
          this.traverseAllLinear(
            item,
            (n: nodes.RNodeT) => this.isKindTestPassed(n, test),
            nodeset
          );
          this.addNodeset(nodeset);
        }
      }
    }
  }

  //** self axis **//
  private s1SelfNameTest(node: StepNode) {
    // /self::p:l | /self::p:* | /self::n | /self::*
    if (!this.nodeset.size) return;
    const test: NameTest = <NameTest>node.nodeTest!.test;
    for (const n of this.nodeset) {
      if (nodes.isElement(n) && this.isNameTestPassed(n, test)) {
        const nodeset: XNodeSet = new Set();
        nodeset.add(n);
        this.addNodeset(nodeset);
      }
    }
  }

  private s1SelfKindTest(node: StepNode) {
    // /self::text() | /self::node() | /self::pi() | /self::comment()
    const test: KindTest = <KindTest>node.nodeTest!.test;
    if (!this.nodeset.size) {
      if (test.testType !== KindTestType.Node) return;
      const nodeset: XNodeSet = new Set();
      nodeset.add(this.root);
      this.addNodeset(nodeset);
    } else {
      for (const n of this.nodeset) {
        if (this.isKindTestPassed(n, test)) {
          const nodeset: XNodeSet = new Set();
          nodeset.add(n);
          this.addNodeset(nodeset);
        }
      }
    }
  }

  //** ancestor axis **//
  private s1AncestorNameTest(node: StepNode) {
    // /ancestor::p:l | /ancestor::p:* | /ancestor::n | /ancestor::*
    if (!this.nodeset.size) return;
    const test = <NameTest>node.nodeTest!.test;
    for (const item of this.nodeset) {
      const nodeset: XNodeSet = new Set();
      this.findAncestors(
        item,
        (n: nodes.RNodeT) =>
          nodes.isElement(n) && this.isNameTestPassed(n, test),
        nodeset
      );
      this.addNodeset(nodeset);
    }
  }

  private s1AncestorKindTest(node: StepNode) {
    // /ancestor::text() | /ancestor::node() | /ancestor::pi() | /ancestor::comment()
    if (!this.nodeset.size) return;
    const test = <KindTest>node.nodeTest!.test;
    for (const item of this.nodeset) {
      const nodeset: XNodeSet = new Set();
      this.findAncestors(
        item,
        (n: nodes.RNodeT) => this.isKindTestPassed(n, test),
        nodeset
      );
      this.addNodeset(nodeset);
    }
  }

  //** ancestor-or-self axis **//
  private s1AncestorOrSelfNameTest(node: StepNode) {
    // /ancestor-or-self::p:l | /ancestor-or-self::p:*
    // /ancestor-or-self::n | /ancestor-or-self::*
    if (!this.nodeset.size) return;
    const test = <NameTest>node.nodeTest!.test;
    for (const item of this.nodeset) {
      const nodeset: XNodeSet = new Set();
      if (nodes.isElement(item) && this.isNameTestPassed(item, test)) {
        nodeset.add(item);
      }
      this.findAncestors(
        item,
        (n: nodes.RNodeT) =>
          nodes.isElement(n) && this.isNameTestPassed(n, test),
        nodeset
      );
      this.addNodeset(nodeset);
    }
  }

  private s1AncestorOrSelfKindTest(node: StepNode) {
    // /ancestor-or-self::text() | /ancestor-or-self::node()
    // /ancestor-or-self::pi() | /ancestor-or-self::comment()
    const test: KindTest = <KindTest>node.nodeTest!.test;
    if (!this.nodeset.size) {
      if (test.testType !== KindTestType.Node) return;
      const nodeset: XNodeSet = new Set();
      nodeset.add(this.root);
      this.addNodeset(nodeset);
      return;
    }
    for (const item of this.nodeset) {
      const nodeset: XNodeSet = new Set();
      if (this.isKindTestPassed(item, test)) {
        nodeset.add(item);
      }
      this.findAncestors(
        item,
        (n: nodes.RNodeT) => this.isKindTestPassed(n, test),
        nodeset
      );
      this.addNodeset(nodeset);
    }
  }

  //** attribute axis **//
  private s1AttributeNameTest(node: StepNode) {
    // /attribute::p:l | /attribute::p:* | /attribute::n | /attribute::*
    if (!this.nodeset.size) return;
    const test: NameTest = <NameTest>node.nodeTest!.test;
    for (const item of this.nodeset) {
      if (nodes.isElement(item)) {
        const nodeset: XNodeSet = new Set();
        this.findAttribute(item, test, nodeset);
        this.addNodeset(nodeset);
      }
    }
  }

  private s1AttributeKindTest(node: StepNode) {
    // /attribute::text() | /attribute::node() | /attribute::pi() | /attribute::comment()
    if (!this.nodeset.size) return;
    const test: KindTest = <KindTest>node.nodeTest!.test;
    for (const item of this.nodeset) {
      if (nodes.isElement(item)) {
        const nodeset: XNodeSet = new Set();
        this.findAttribute(item, test, nodeset);
        this.addNodeset(nodeset);
      }
    }
  }

  //** descendant axis **//
  private s1DescendantNameTest(node: StepNode) {
    // /descendant::p:l | /descendant::p:* | /descendant::n | /descendant::*
    const test = <NameTest>node.nodeTest!.test;
    if (!this.nodeset.size) {
      const nodeset: XNodeSet = new Set();
      this.findDescendants(
        this.root,
        (n: nodes.RNodeT) =>
          nodes.isElement(n) && this.isNameTestPassed(n, test),
        nodeset
      );
      this.addNodeset(nodeset);
    } else {
      for (const item of this.nodeset) {
        const nodeset: XNodeSet = new Set();
        this.findDescendants(
          item,
          (n: nodes.RNodeT) =>
            nodes.isElement(n) && this.isNameTestPassed(n, test),
          nodeset
        );
        this.addNodeset(nodeset);
      }
    }
  }

  private s1DescendantKindTest(node: StepNode) {
    // /descendant::text() | /descendant::node() | /descendant::pi() | /descendant::comment()
    const test = <KindTest>node.nodeTest!.test;
    if (!this.nodeset.size) {
      const nodeset: XNodeSet = new Set();
      this.findDescendants(
        this.root,
        (n: nodes.RNodeT) => this.isKindTestPassed(n, test),
        nodeset
      );
      this.addNodeset(nodeset);
    } else {
      for (const item of this.nodeset) {
        const nodeset: XNodeSet = new Set();
        this.findDescendants(
          item,
          (n: nodes.RNodeT) => this.isKindTestPassed(n, test),
          nodeset
        );
        this.addNodeset(nodeset);
      }
    }
  }

  //** descendant-or-self axis **//
  private s1DescendantOrSelfNameTest(node: StepNode) {
    // /descendant-or-self::p:l | /descendant-or-self::p:*
    // | /descendant-or-self::n | /descendant-or-self::*
    const test = <NameTest>node.nodeTest!.test;
    if (!this.nodeset.size) {
      // checking if this.node is an element is always false, since at the first step,
      // this.node is a RootNode not an element; hence we go ahead with the search
      // directly
      const nodeset: XNodeSet = new Set();
      this.findDescendants(
        this.root,
        (n: nodes.RNodeT) =>
          nodes.isElement(n) && this.isNameTestPassed(n, test),
        nodeset
      );
      this.addNodeset(nodeset);
    } else {
      for (const item of this.nodeset) {
        const nodeset: XNodeSet = new Set();
        if (nodes.isElement(item) && this.isNameTestPassed(item, test)) {
          nodeset.add(item);
        }
        this.findDescendants(
          item,
          (n: nodes.RNodeT) =>
            nodes.isElement(n) && this.isNameTestPassed(n, test),
          nodeset
        );
        this.addNodeset(nodeset);
      }
    }
  }

  private s1DescendantOrSelfKindTest(node: StepNode) {
    // /descendant-or-self::text() | /descendant-or-self::node()
    // | /descendant-or-self::pi() | /descendant-or-self::comment()
    const test: KindTest = <KindTest>node.nodeTest!.test;
    if (!this.nodeset.size) {
      const nodeset: XNodeSet = new Set();
      if (this.isKindTestPassed(this.root, test)) {
        nodeset.add(this.root);
      }
      this.findDescendants(
        this.root,
        (n: nodes.RNodeT) => this.isKindTestPassed(n, test),
        nodeset
      );
      this.addNodeset(nodeset);
    } else {
      for (const item of this.nodeset) {
        const nodeset: XNodeSet = new Set();
        if (this.isKindTestPassed(item, test)) {
          nodeset.add(item);
        }
        this.findDescendants(
          item,
          (n: nodes.RNodeT) => this.isKindTestPassed(n, test),
          nodeset
        );
        this.addNodeset(nodeset);
      }
    }
  }

  //** following axis **//
  private s1FollowingNameTest(node: StepNode) {
    // /following::p:l | /following::p:* | /following::n | /following::*
    if (!this.nodeset.size) return;
    const test = node.nodeTest!.test as NameTest;
    for (const item of this.nodeset) {
      const nodeset: XNodeSet = new Set();
      this.findFollowing(
        item,
        (n: nodes.RNodeT) =>
          nodes.isElement(n) && this.isNameTestPassed(n, test),
        nodeset
      );
      this.addNodeset(nodeset);
    }
  }

  private s1FollowingKindTest(node: StepNode) {
    // /following::text() | /following::node() | /following::pi() | /following::comment()
    if (!this.nodeset.size) return;
    const test = node.nodeTest!.test as KindTest;
    for (const item of this.nodeset) {
      const nodeset: XNodeSet = new Set();
      this.findFollowing(
        item,
        (n: nodes.RNodeT) => this.isKindTestPassed(n, test),
        nodeset
      );
      this.addNodeset(nodeset);
    }
  }

  //** following-sibling axis **//
  private s1FollowingSiblingNameTest(node: StepNode) {
    // /following-sibling::p:l | /following-sibling::p:*
    // | /following-sibling::n | /following-sibling::*
    if (!this.nodeset.size) return;
    const test = node.nodeTest!.test as NameTest;
    for (const item of this.nodeset) {
      const nodeset: XNodeSet = new Set();
      this.findFollowingSibling(
        item,
        (n: nodes.RNodeT) =>
          nodes.isElement(n) && this.isNameTestPassed(n, test),
        nodeset
      );
      this.addNodeset(nodeset);
    }
  }

  private s1FollowingSiblingKindTest(node: StepNode) {
    // /following-sibling::text() | /following-sibling::node()
    // | /following-sibling::pi() | /following-sibling::comment()
    if (!this.nodeset.size) return;
    const test = node.nodeTest!.test as KindTest;
    for (const item of this.nodeset) {
      const nodeset: XNodeSet = new Set();
      this.findFollowingSibling(
        item,
        (n: nodes.RNodeT) => this.isKindTestPassed(n, test),
        nodeset
      );
      this.addNodeset(nodeset);
    }
  }

  //** parent axis **//
  private s1ParentNameTest(node: StepNode) {
    // /parent::p:l | /parent::p:* | /parent::n | /parent::*
    if (!this.nodeset.size) return;
    const test = node.nodeTest!.test as NameTest;
    for (const item of this.nodeset) {
      if (
        item.parent &&
        !nodes.isRoot(item.parent) &&
        this.isNameTestPassed(<nodes.ElementNode>item.parent, test)
      ) {
        const nodeset: XNodeSet = new Set();
        nodeset.add(item.parent);
        this.addNodeset(nodeset);
      }
    }
  }

  private s1ParentKindTest(node: StepNode) {
    // /parent::text() | /parent::node() | /parent::pi() | /parent::comment()
    const test = node.nodeTest!.test as KindTest;
    for (const item of this.nodeset) {
      if (item.parent && this.isKindTestPassed(item.parent, test)) {
        const nodeset: XNodeSet = new Set();
        nodeset.add(item.parent);
        this.addNodeset(nodeset);
      }
    }
  }

  //** preceding axis **//
  private s1PrecedingNameTest(node: StepNode) {
    // /preceding::p:l | /preceding::p:* | /preceding::n | /preceding::*
    if (!this.nodeset.size) return;
    const test = <NameTest>node.nodeTest!.test;
    for (const item of this.nodeset) {
      const nodeset: XNodeSet = new Set();
      this.findPreceding(
        item,
        (n: nodes.RNodeT) =>
          nodes.isElement(n) && this.isNameTestPassed(n, test),
        nodeset
      );
      this.addNodeset(nodeset);
    }
  }

  private s1PrecedingKindTest(node: StepNode) {
    // /preceding::text() | /preceding::node() | /preceding::pi() | /preceding::comment()
    if (!this.nodeset.size) return;
    const test = node.nodeTest!.test as KindTest;
    for (const item of this.nodeset) {
      const nodeset: XNodeSet = new Set();
      this.findPreceding(
        item,
        (n: nodes.RNodeT) => this.isKindTestPassed(n, test),
        nodeset
      );
      this.addNodeset(nodeset);
    }
  }

  //** preceding-sibling axis **//
  private s1PrecedingSiblingNameTest(node: StepNode) {
    // /preceding-sibling::p:l | /preceding-sibling::p:*
    // | /preceding-sibling::n | /preceding-sibling::*
    if (!this.nodeset.size) return;
    const test = node.nodeTest!.test as NameTest;
    for (const item of this.nodeset) {
      const nodeset: XNodeSet = new Set();
      this.findPrecedingSibling(
        item,
        (n: nodes.RNodeT) =>
          nodes.isElement(n) && this.isNameTestPassed(n, test),
        nodeset
      );
      this.addNodeset(nodeset);
    }
  }

  private s1PrecedingSiblingKindTest(node: StepNode) {
    // /preceding-sibling::text() | /preceding-sibling::node()
    // | /preceding-sibling::pi() | /preceding-sibling::comment()
    if (!this.nodeset.size) return;
    const test = node.nodeTest!.test as KindTest;
    for (const item of this.nodeset) {
      const nodeset: XNodeSet = new Set();
      this.findPrecedingSibling(
        item,
        (n: nodes.RNodeT) => this.isKindTestPassed(n, test),
        nodeset
      );
      this.addNodeset(nodeset);
    }
  }
}

/**
 * Evaluation
 */
type CompareFn = (l: unknown, r: unknown) => boolean;
type RelativeOpType =
  | OpType.OpEq
  | OpType.OpNeq
  | OpType.OpLt
  | OpType.OpLeq
  | OpType.OpGt
  | OpType.OpGeq;

export class XPath {
  public root!: nodes.RootNode;
  public path!: (
    n: nodes.RParentNodeT,
    allowCopy?: NonNullable<boolean>
  ) => XPath;
  private ctxStack: XContext[] = [];
  private dataStack: XData[] = [];
  private ctx!: XContext;
  private state = new PathState();

  constructor() {
    this.path = this.construct.bind(this);
  }

  error(...msg: string[]): never {
    console.error(...msg);
    throw new Error();
  }

  construct(
    node: nodes.RParentNodeT,
    allowCopy?: NonNullable<boolean>
  ): XPath | never {
    if (nodes.isRoot(node)) {
      this.root = node;
    } else {
      if (allowCopy === undefined) {
        this.error(
          "allowCopy must be specified for element nodes provided as root"
        );
      }
      if (allowCopy) {
        this.root = new nodes.RootNode("Document");
        node = node.clone();
        this.root.rootElement = node;
        this.root.children.push(node);
        node.parent = this.root;
      } else {
        // find the document/root-node
        let parent: nodes.RParentNodeT;
        do {
          parent = node.parent!;
          node = parent;
        } while (parent && !nodes.isRoot(parent));
        if (!parent || !nodes.isRoot(parent)) {
          this.error("Could not locate document/root node");
        }
        this.root = parent;
      }
    }
    return this;
  }

  private pushContext(ctx: XContext): void {
    this.ctxStack.push(ctx);
    this.ctx = ctx;
  }

  private popContext(): void {
    this.ctxStack.pop();
    this.ctx = this.ctxStack[this.ctxStack.length - 1];
  }

  private pushData(data: XData): void {
    this.dataStack.push(data);
  }

  private popData(): XData {
    return <XData>this.dataStack.pop();
  }

  private endComputation(): void | never {
    // confirm that the dataStack is completely empty at the end of a query
    // expression evaluation/computation. If it isn't, then most likely, the
    // expression is a bad one.
    if (this.dataStack.length) {
      this.dataStack = [];
      this.error("Computation Error. Probable cause, bad query expression");
    }
  }

  private reorderNodesetArrayInPlace(
    nodesetArray: Array<XNodeSet>,
    order: DocumentOrder
  ): void {
    const compareFn =
      order === DocumentOrder.Forward
        ? (a: nodes.RNodeT, b: nodes.RNodeT) => a.position() - b.position()
        : (a: nodes.RNodeT, b: nodes.RNodeT) => b.position() - a.position();
    for (let i = 0; i < nodesetArray.length; i++) {
      const nodeset = nodesetArray[i];
      nodesetArray[i] = new Set<nodes.RNodeT>(
        Array.from<nodes.RNodeT>(nodeset).sort(compareFn)
      );
    }
  }

  private sortNodeset(nodeset: XNodeSet, nodeList?: nodes.RNodeT[]): XNodeSet {
    /**sort a nodeset/node-list in document order**/
    const compareFn = (a: nodes.RNodeT, b: nodes.RNodeT) =>
      a.position() - b.position();
    const arr = nodeList
      ? nodeList.sort(compareFn)
      : Array.from<nodes.RNodeT>(nodeset).sort(compareFn);
    return new Set<nodes.RNodeT>(arr);
  }

  /** Comparators **/

  private compare_Nodeset_Nodeset(
    left: XData,
    right: XData,
    op: RelativeOpType
  ) {
    const compareFn = (lData: XData, rData: XData, cmp: CompareFn) => {
      let ret = false;
      for (const i of lData.value as XNodeSet) {
        for (const j of rData.value as XNodeSet) {
          if (cmp(i, j)) {
            ret = true;
            break;
          }
        }
      }
      this.pushData({ cType: XDataType.Boolean, value: ret });
    };

    const comparators: { [key in RelativeOpType]: () => void } = {
      [OpType.OpEq]: () => {
        compareFn(left, right, (l: unknown, r: unknown) => {
          // l -> RNodeT r -> RNodeT
          return (
            (<nodes.RNodeT>l).stringValue() === (<nodes.RNodeT>r).stringValue()
          );
        });
      },
      [OpType.OpNeq]: () => {
        compareFn(left, right, (l: unknown, r: unknown) => {
          // l -> RNodeT r -> RNodeT
          return (
            (<nodes.RNodeT>l).stringValue() !== (<nodes.RNodeT>r).stringValue()
          );
        });
      },
      [OpType.OpLt]: () => {
        compareFn(left, right, (l: unknown, r: unknown) => {
          // l -> RNodeT r -> RNodeT
          return (
            (<nodes.RNodeT>l).numberValue() < (<nodes.RNodeT>r).numberValue()
          );
        });
      },
      [OpType.OpGt]: () => {
        compareFn(left, right, (l: unknown, r: unknown) => {
          // l -> RNodeT r -> RNodeT
          return (
            (<nodes.RNodeT>l).numberValue() > (<nodes.RNodeT>r).numberValue()
          );
        });
      },
      [OpType.OpLeq]: () => {
        compareFn(left, right, (l: unknown, r: unknown) => {
          // l -> RNodeT r -> RNodeT
          return (
            (<nodes.RNodeT>l).numberValue() <= (<nodes.RNodeT>r).numberValue()
          );
        });
      },
      [OpType.OpGeq]: () => {
        compareFn(left, right, (l: unknown, r: unknown) => {
          // l -> RNodeT r -> RNodeT
          return (
            (<nodes.RNodeT>l).numberValue() >= (<nodes.RNodeT>r).numberValue()
          );
        });
      },
    };
    comparators[op]();
  }

  private compare_Nodeset_String(
    left: XData,
    right: XData,
    op: RelativeOpType
  ) {
    const compareFn = (lData: XData, rData: XData, cmp: CompareFn) => {
      let ret = false;
      for (const nd of lData.value as XNodeSet) {
        if (cmp(nd, rData)) {
          // nd is RNode, rData is XData (string)
          ret = true;
          break;
        }
      }
      this.pushData({ cType: XDataType.Boolean, value: ret });
    };

    const comparators: { [key in RelativeOpType]: () => void } = {
      [OpType.OpEq]: () => {
        compareFn(left, right, (l: unknown, r: unknown) => {
          // l -> RNodeT |  r -> XData (string)
          return (
            (<nodes.RNodeT>l).stringValue() === ((<XData>r).value as string)
          );
        });
      },
      [OpType.OpNeq]: () => {
        compareFn(left, right, (l: unknown, r: unknown) => {
          // l -> RNodeT |  r -> XData (string)
          return (
            (<nodes.RNodeT>l).stringValue() !== ((<XData>r).value as string)
          );
        });
      },
      [OpType.OpLt]: () => {
        compareFn(left, right, (l: unknown, r: unknown) => {
          // l -> RNodeT |  r -> XData (string)
          return (<nodes.RNodeT>l).numberValue() < XDataEval.toNumber(<XData>r);
        });
      },
      [OpType.OpGt]: () => {
        compareFn(left, right, (l: unknown, r: unknown) => {
          // l -> RNodeT |  r -> XData (string)
          return (<nodes.RNodeT>l).numberValue() > XDataEval.toNumber(<XData>r);
        });
      },
      [OpType.OpLeq]: () => {
        compareFn(left, right, (l: unknown, r: unknown) => {
          // l -> RNodeT |  r -> XData (string)
          return (
            (<nodes.RNodeT>l).numberValue() <= XDataEval.toNumber(<XData>r)
          );
        });
      },
      [OpType.OpGeq]: () => {
        compareFn(left, right, (l: unknown, r: unknown) => {
          // l -> RNodeT |  r -> XData (string)
          return (
            (<nodes.RNodeT>l).numberValue() >= XDataEval.toNumber(<XData>r)
          );
        });
      },
    };
    comparators[op]();
  }

  private compare_Nodeset_Number(
    left: XData,
    right: XData,
    op: RelativeOpType
  ) {
    const compareFn = (lData: XData, rData: XData, cmp: CompareFn) => {
      let ret = false;
      for (const nd of lData.value as XNodeSet) {
        if (cmp(nd, rData.value as number)) {
          // use the number value directly
          // nd is type RNode, rData is XData-(number)
          ret = true;
          break;
        }
      }
      this.pushData({ cType: XDataType.Boolean, value: ret });
    };

    const comparators: { [key in RelativeOpType]: () => void } = {
      [OpType.OpEq]: () => {
        compareFn(left, right, (l: unknown, r: unknown) => {
          // l -> RNodeT |  r -> (number)
          return (<nodes.RNodeT>l).numberValue() === (r as number);
        });
      },
      [OpType.OpNeq]: () => {
        compareFn(left, right, (l: unknown, r: unknown) => {
          // l -> RNodeT |  r -> (number)
          return (<nodes.RNodeT>l).numberValue() !== (r as number);
        });
      },
      [OpType.OpLt]: () => {
        compareFn(left, right, (l: unknown, r: unknown) => {
          // l -> RNodeT |  r -> (number)
          return (<nodes.RNodeT>l).numberValue() < (r as number);
        });
      },
      [OpType.OpGt]: () => {
        compareFn(left, right, (l: unknown, r: unknown) => {
          // l -> RNodeT |  r -> (number)
          return (<nodes.RNodeT>l).numberValue() > (r as number);
        });
      },
      [OpType.OpLeq]: () => {
        compareFn(left, right, (l: unknown, r: unknown) => {
          // l -> RNodeT |  r -> (number)
          return (<nodes.RNodeT>l).numberValue() <= (r as number);
        });
      },
      [OpType.OpGeq]: () => {
        compareFn(left, right, (l: unknown, r: unknown) => {
          // l -> RNodeT |  r -> (number)
          return (<nodes.RNodeT>l).numberValue() >= (r as number);
        });
      },
    };
    comparators[op]();
  }

  private compare_Nodeset_Boolean(
    left: XData,
    right: XData,
    op: RelativeOpType
  ) {
    const compareFn = (lData: XData, rData: XData, cmp: CompareFn) => {
      this.pushData({
        cType: XDataType.Boolean,
        value: cmp(lData, rData),
      });
    };

    const comparators: { [key in RelativeOpType]: () => void } = {
      [OpType.OpEq]: () => {
        compareFn(left, right, (l: unknown, r: unknown) => {
          // l -> XData (nodeset) | r -> XData (boolean)
          const leftVal: boolean = XDataEval.toBoolean(<XData>l);
          const rightVal = (<XData>r).value as boolean;
          return leftVal === rightVal;
        });
      },
      [OpType.OpNeq]: () => {
        compareFn(left, right, (l: unknown, r: unknown) => {
          // l -> XData (nodeset) | r -> XData (boolean)
          const leftVal: boolean = XDataEval.toBoolean(<XData>l);
          const rightVal = (<XData>r).value as boolean;
          return leftVal !== rightVal;
        });
      },
      [OpType.OpLt]: () => {
        compareFn(left, right, (l: unknown, r: unknown) => {
          // l -> XData (nodeset) | r -> XData (boolean)
          const leftVal: number = XDataEval.toNumber(<XData>l);
          const rightVal: number = XDataEval.toNumber(<XData>r);
          return leftVal < rightVal;
        });
      },
      [OpType.OpGt]: () => {
        compareFn(left, right, (l: unknown, r: unknown) => {
          // l -> XData (nodeset) | r -> XData (boolean)
          const leftVal: number = XDataEval.toNumber(<XData>l);
          const rightVal: number = XDataEval.toNumber(<XData>r);
          return leftVal > rightVal;
        });
      },
      [OpType.OpLeq]: () => {
        compareFn(left, right, (l: unknown, r: unknown) => {
          // l -> XData (nodeset) | r -> XData (boolean)
          const leftVal: number = XDataEval.toNumber(<XData>l);
          const rightVal: number = XDataEval.toNumber(<XData>r);
          return leftVal <= rightVal;
        });
      },
      [OpType.OpGeq]: () => {
        compareFn(left, right, (l: unknown, r: unknown) => {
          // l -> XData (nodeset) | r -> XData (boolean)
          const leftVal: number = XDataEval.toNumber(<XData>l);
          const rightVal: number = XDataEval.toNumber(<XData>r);
          return leftVal >= rightVal;
        });
      },
    };
    comparators[op]();
  }

  private compare_Boolean_Nodeset(
    left: XData,
    right: XData,
    op: RelativeOpType
  ) {
    switch (op) {
      case OpType.OpEq:
        // nodeset == boolean <-> boolean == nodeset
        this.compare_Nodeset_Boolean(right, left, OpType.OpEq);
        break;
      case OpType.OpNeq:
        // nodeset != boolean <-> boolean != nodeset
        this.compare_Nodeset_Boolean(right, left, OpType.OpNeq);
        break;
      case OpType.OpGt:
        // nodeset > boolean <-> boolean < nodeset
        this.compare_Nodeset_Boolean(right, left, OpType.OpLt);
        break;
      case OpType.OpLt:
        // nodeset < boolean <-> boolean > nodeset
        this.compare_Nodeset_Boolean(right, left, OpType.OpGt);
        break;
      case OpType.OpLeq:
        // nodeset <= boolean <-> boolean >= nodeset
        this.compare_Nodeset_Boolean(right, left, OpType.OpGeq);
        break;
      case OpType.OpGeq:
        // nodeset >= boolean <-> boolean <= nodeset
        this.compare_Nodeset_Boolean(right, left, OpType.OpLeq);
        break;
      default:
        unreachable("compare_Boolean_Nodeset");
    }
  }

  private compare_String_Nodeset(left: XData, right: XData, op: OpType) {
    switch (op) {
      case OpType.OpEq:
        // nodeset == string <-> string == nodeset
        this.compare_Nodeset_String(right, left, OpType.OpEq);
        break;
      case OpType.OpNeq:
        // nodeset != string <-> string != nodeset
        this.compare_Nodeset_String(right, left, OpType.OpNeq);
        break;
      case OpType.OpGt:
        // nodeset > string <-> string < nodeset
        this.compare_Nodeset_String(right, left, OpType.OpLt);
        break;
      case OpType.OpLt:
        // nodeset < string <-> string > nodeset
        this.compare_Nodeset_String(right, left, OpType.OpGt);
        break;
      case OpType.OpLeq:
        // nodeset <= string <-> string >= nodeset
        this.compare_Nodeset_String(right, left, OpType.OpGeq);
        break;
      case OpType.OpGeq:
        // nodeset >= string <-> string <= nodeset
        this.compare_Nodeset_String(right, left, OpType.OpLeq);
        break;
      default:
        unreachable("compare_String_Nodeset");
    }
  }

  private compare_Number_Nodeset(left: XData, right: XData, op: OpType) {
    switch (op) {
      case OpType.OpEq:
        // nodeset == number <-> number == nodeset
        this.compare_Nodeset_Number(right, left, OpType.OpEq);
        break;
      case OpType.OpNeq:
        // nodeset != number <-> number != nodeset
        this.compare_Nodeset_Number(right, left, OpType.OpNeq);
        break;
      case OpType.OpGt:
        // nodeset > number <-> number < nodeset
        this.compare_Nodeset_Number(right, left, OpType.OpLt);
        break;
      case OpType.OpLt:
        // nodeset < number <-> number > nodeset
        this.compare_Nodeset_Number(right, left, OpType.OpGt);
        break;
      case OpType.OpLeq:
        // nodeset <= number <-> number > nodeset
        this.compare_Nodeset_Number(right, left, OpType.OpGeq);
        break;
      case OpType.OpGeq:
        // nodeset >= number <-> number <= nodeset
        this.compare_Nodeset_Number(right, left, OpType.OpLeq);
        break;
      default:
        unreachable("compare_Number_Nodeset");
    }
  }

  private getCoreFunctions() {
    /**
     * Helpers
     */
    const getNodesetData = (node: CallNode) => {
      let data: XData;
      if (node.args.length) {
        this.visit(node.args[0]);
        data = this.popData();
        if (!XDataEval.isNodeset(data)) {
          this.error(
            `Expected type '${XDataType.Nodeset}' but got '${data.cType}'`
          );
        }
      } else {
        data = {
          cType: XDataType.Nodeset,
          value: new Set<nodes.RNodeT>([this.ctx.node]),
        };
      }
      return data.value as XNodeSet;
    };

    /**
     * Callbacks
     */
    return {
      //*** nodeset functions ***//
      lastFn: (node: CallNode) => {
        /* last() -> number
         * The last function returns a number equal to the context size from the
         * expression evaluation context
         */
        void node;
        this.pushData({ cType: XDataType.Number, value: this.ctx.size });
      },
      positionFn: (node: CallNode) => {
        /* position() -> number
         * The position function returns a number equal to the context
         * position from the expression evaluation context.
         */
        void node;
        this.pushData({ cType: XDataType.Number, value: this.ctx.pos });
      },
      countFn: (node: CallNode) => {
        /* count(node-set) -> number
         * The count function returns the number of nodes in the argument node-set.
         */
        this.visit(node.args[0]); // 1 arg
        const data: XData = this.popData();
        if (!XDataEval.isNodeset(data)) {
          this.pushData({ cType: XDataType.Number, value: NaN });
        } else {
          const nodeset = data.value as XNodeSet;
          this.pushData({ cType: XDataType.Number, value: nodeset.size });
        }
      },
      localNameFn: (node: CallNode) => {
        /* local-name(node-set?) -> string
         * The local-name function returns the local part of the expanded-name
         * of the node in the argument node-set that is first in document order.
         * If the argument node-set is empty or the first node has no expanded-name,
         * an empty string is returned. If the argument is omitted, it defaults to a node-set
         * with the context node as its only member.
         */
        const nodeset: XNodeSet = getNodesetData(node);
        const empty: XData = { cType: XDataType.String, value: "" };
        if (!nodeset.size) {
          this.pushData(empty);
        } else {
          const first: nodes.RNodeT = Array.from(nodeset)[0];
          if (nodes.isElement(first) || nodes.isAttribute(first)) {
            this.pushData({ cType: XDataType.String, value: first.name.lname });
          } else {
            this.pushData(empty);
          }
        }
      },
      namespaceUriFn: (node: CallNode) => {
        /* namespace-uri(node-set?) -> string
         * The namespace-uri function returns the namespace URI of
         * the expanded-name of the node in the argument node-set that
         * is first in document order. If the argument node-set is empty,
         * the first node has no expanded-name, or the namespace URI of the
         * expanded-name is null, an empty string is returned.
         * If the argument is omitted, it defaults to a node-set with the
         * context node as its only member.
         */
        const nodeset: XNodeSet = getNodesetData(node);
        const empty: XData = { cType: XDataType.String, value: "" };
        if (!nodeset.size) {
          this.pushData(empty);
        } else {
          const first: nodes.RNodeT = Array.from(nodeset)[0];
          if (
            (nodes.isElement(first) || nodes.isAttribute(first)) &&
            first.namespace
          ) {
            const ns: nodes.NamespaceNode = first.namespace;
            this.pushData({ cType: XDataType.String, value: ns.uri });
          } else {
            this.pushData(empty);
          }
        }
      },
      nameFn: (node: CallNode) => {
        /* name(node-set?) -> string
         */
        const nodeset: XNodeSet = getNodesetData(node);
        const empty: XData = { cType: XDataType.String, value: "" };
        if (!nodeset.size) {
          this.pushData(empty);
        } else {
          const first: nodes.RNodeT = Array.from(nodeset)[0];
          if (nodes.isElement(first) || nodes.isAttribute(first)) {
            this.pushData({ cType: XDataType.String, value: first.name.qname });
          } else {
            this.pushData(empty);
          }
        }
      },

      //*** boolean functions ***//
      booleanFn: (node: CallNode) => {
        /* boolean(object) -> boolean
         * The boolean function converts its argument to a boolean
         */
        this.visit(node.args[0]);
        const data: XData = this.popData();
        this.pushData({
          cType: XDataType.Boolean,
          value: XDataEval.toBoolean(data),
        });
      },
      notFn: (node: CallNode) => {
        /* not(object) -> boolean
         * The not function returns true if its argument is false, and false otherwise.
         */
        this.visit(node.args[0]);
        const data: XData = this.popData();
        this.pushData({
          cType: XDataType.Boolean,
          value: !XDataEval.toBoolean(data),
        });
      },
      trueFn: (node: CallNode) => {
        /* true() -> boolean
         * The true function returns true
         */
        void node;
        this.pushData({
          cType: XDataType.Boolean,
          value: true,
        });
      },
      falseFn: (node: CallNode) => {
        /* false() -> boolean
         * The false function returns false
         */
        void node;
        this.pushData({
          cType: XDataType.Boolean,
          value: false,
        });
      },
      langFn: (node: CallNode) => {
        /* lang(string) -> boolean
         *  The lang function returns true or false depending on whether the language
         *  of the context node as specified by xml:lang attributes is the same as or
         *  is a sub-language of the language specified by the argument string.
         */
        this.visit(node.args[0]);
        const data: XData = this.popData();
        let n: nodes.RNodeT = this.ctx.node;
        const prop = "xml:lang";
        let foundLang: string | undefined;
        do {
          if (nodes.isElement(n) && n.attributes.has(prop)) {
            foundLang = n.attributes.get(prop)!.value.toLowerCase();
            break;
          } else if (nodes.isAttribute(n) && n.name.qname === prop) {
            foundLang = n.value.toLowerCase();
            break;
          }
          n = n.parent!;
        } while (n && !nodes.isRoot(n));
        const res: XData = { cType: XDataType.Boolean, value: false };
        if (foundLang) {
          const argLang = XDataEval.toString(data).toLowerCase();
          if (argLang === foundLang || foundLang.split("-")[0] === argLang) {
            this.pushData({ cType: XDataType.Boolean, value: true });
            return;
          }
        }
        this.pushData(res);
      },

      //*** number functions ***//
      numberFn: (node: CallNode) => {
        /* number(object?) -> number
         * The number function converts its argument to a number
         */
        let data: XData;
        if (node.args.length) {
          this.visit(node.args[0]);
          data = this.popData();
        } else {
          data = {
            cType: XDataType.Nodeset,
            value: new Set<nodes.RNodeT>([this.ctx.node]),
          };
        }
        this.pushData({
          cType: XDataType.Number,
          value: XDataEval.toNumber(data),
        });
      },
      sumFn: (node: CallNode) => {
        /* sum(node-set) -> number
         * The sum function returns the sum, for each node in the argument
         * node-set, of the result of converting the string-values of the
         * node to a number.
         */
        this.visit(node.args[0]);
        const data: XData = this.popData();
        if (!XDataEval.isNodeset(data)) {
          this.error(
            `Expected argument of type '${XDataType.Nodeset}' but got '${data.cType}'`
          );
        }
        const nodeset = data.value as XNodeSet;
        let sum = 0;
        for (const n of nodeset) {
          sum += n.numberValue();
          if (Number.isNaN(sum)) break;
        }
        this.pushData({ cType: XDataType.Number, value: sum });
      },
      floorFn: (node: CallNode) => {
        /* floor(number) -> number
         * The floor function returns the largest (closest to positive infinity)
         * number that is not greater than the argument and that is an integer.
         */
        this.visit(node.args[0]);
        const data: XData = this.popData();
        this.pushData({
          cType: XDataType.Number,
          value: Math.floor(XDataEval.toNumber(data)),
        });
      },
      ceilingFn: (node: CallNode) => {
        /* ceiling(number) -> number
         * The ceiling function returns the smallest (closest to negative infinity)
         * number that is not less than the argument and that is an integer.
         */
        this.visit(node.args[0]);
        const data: XData = this.popData();
        this.pushData({
          cType: XDataType.Number,
          value: Math.ceil(XDataEval.toNumber(data)),
        });
      },
      roundFn: (node: CallNode) => {
        /* round(number) -> number
         * The round function returns the number that is closest to the
         * argument and that is an integer.
         */
        this.visit(node.args[0]);
        const data: XData = this.popData();
        this.pushData({
          cType: XDataType.Number,
          value: Math.round(XDataEval.toNumber(data)),
        });
      },

      //*** string functions ***//
      stringFn: (node: CallNode) => {
        /* string(object?) -> string
         * The string function converts an object to a string
         */
        let data: XData;
        if (node.args.length) {
          this.visit(node.args[0]);
          data = this.popData();
        } else {
          data = {
            cType: XDataType.Nodeset,
            value: new Set<nodes.RNodeT>([this.ctx.node]),
          };
        }
        this.pushData({
          cType: XDataType.String,
          value: XDataEval.toString(data),
        });
      },
      concatFn: (node: CallNode) => {
        /* concat(string, string, string*) -> string
         * The concat function returns the concatenation of its arguments.
         */
        let concat = "";
        for (const arg of node.args) {
          this.visit(arg);
          concat += XDataEval.toString(this.popData());
        }
        this.pushData({ cType: XDataType.String, value: concat });
      },
      startsWithFn: (node: CallNode) => {
        /* starts-with(string, string) -> boolean
         * The starts-with function returns true if the first argument string
         * starts with the second argument string, and otherwise returns false.
         */
        const args: string[] = [];
        for (const arg of node.args) {
          this.visit(arg);
          args.push(XDataEval.toString(this.popData()));
        }
        this.pushData({
          cType: XDataType.Boolean,
          value: args[0].startsWith(args[1]),
        });
      },
      containsFn: (node: CallNode) => {
        /* contains(string, string) -> boolean
         * The contains function returns true if the first argument string
         * contains the second argument string, and otherwise returns false.
         */
        const args: string[] = [];
        for (const arg of node.args) {
          this.visit(arg);
          args.push(XDataEval.toString(this.popData()));
        }
        this.pushData({
          cType: XDataType.Boolean,
          value: args[0].includes(args[1]),
        });
      },
      substringBeforeFn: (node: CallNode) => {
        /* substring-before(string, string) -> string
         * The substring-before function returns the substring of the first
         * argument string that precedes the first occurrence of the second
         * argument string in the first argument string, or the empty string
         * if the first argument string does not contain the second argument string.
         * For example, substring-before("1999/04/01","/") returns 1999.
         */
        const args: string[] = [];
        for (const arg of node.args) {
          this.visit(arg);
          args.push(XDataEval.toString(this.popData()));
        }
        const splits = args[0].split(args[1]);
        let sub = "";
        if (splits.length > 1) {
          sub = splits[0];
        }
        this.pushData({
          cType: XDataType.String,
          value: sub,
        });
      },
      substringAfterFn: (node: CallNode) => {
        /* substring-after(string, string) -> string
         * The substring-after function returns the substring of the first
         * argument string that follows the first occurrence of the second
         * argument string in the first argument string, or the empty string
         * if the first argument string does not contain the second argument string.
         * For example, substring-after("1999/04/01","/") returns 04/01, and
         * substring-after("1999/04/01","19") returns 99/04/01.
         */
        const args: string[] = [];
        for (const arg of node.args) {
          this.visit(arg);
          args.push(XDataEval.toString(this.popData()));
        }
        const index = args[0].indexOf(args[1]);
        let sub = "";
        if (index !== -1) {
          sub = args[0].slice(index + args[1].length);
        }
        this.pushData({
          cType: XDataType.String,
          value: sub,
        });
      },
      substringFn: (node: CallNode) => {
        /* substring(string, number, number?) -> string
         * The substring function returns the substring of the first argument
         * starting at the position specified in the second argument with length
         * specified in the third argument.
         * For example, substring("12345",2,3) returns "234". If the third argument
         * is not specified, it returns the substring starting at the position
         * specified in the second argument and continuing to the end of the string.
         * For example, substring("12345",2) returns "2345".
         */
        const empty: XData = {
          cType: XDataType.String,
          value: "",
        };
        // first arg
        this.visit(node.args[0]);
        const str: string = XDataEval.toString(this.popData());
        // second arg
        this.visit(node.args[1]);
        const data: XData = this.popData();
        let start: number = Math.round(XDataEval.toNumber(data));
        if (Number.isNaN(start)) {
          this.pushData(empty);
          return;
        }
        start--;
        // third arg
        let end: number | undefined;
        if (node.args.length === 3) {
          this.visit(node.args[2]);
          end = Math.round(XDataEval.toNumber(this.popData()));
          if (Number.isNaN(end)) {
            this.pushData(empty);
            return;
          }
          end += start;
        }
        start = start >= 0 ? start : 0;
        this.pushData({
          cType: XDataType.String,
          value:
            end !== undefined
              ? str.slice(start, end >= 0 ? end : 0)
              : str.slice(start),
        });
      },
      stringLengthFn: (node: CallNode) => {
        /* string-length(string?) -> number
         * The string-length returns the number of characters in the string.
         * If the argument is omitted, it defaults to the context node
         * converted to a string, in other words the string-value of the context node.
         */
        let str: string;
        if (node.args.length) {
          this.visit(node.args[0]);
          str = XDataEval.toString(this.popData());
        } else {
          str = this.ctx.node.stringValue();
        }
        this.pushData({
          cType: XDataType.Number,
          value: str.length,
        });
      },
      normalizeSpaceFn: (node: CallNode) => {
        /* normalize-space(string?) -> string
         * The normalize-space function returns the argument string with
         * whitespace normalized by stripping leading and trailing whitespace
         * and replacing sequences of whitespace characters by a single space.
         * Whitespace characters are the same as those allowed by the S production in XML.
         * If the argument is omitted, it defaults to the context node converted to a string,
         * in other words the string-value of the context node.
         */
        let str: string;
        if (node.args.length) {
          this.visit(node.args[0]);
          str = XDataEval.toString(this.popData());
        } else {
          str = this.ctx.node.stringValue();
        }
        str = str.trim().replace(/\s+/g, " ");
        this.pushData({
          cType: XDataType.String,
          value: str,
        });
      },
      translateFn: (node: CallNode) => {
        /* translate(string, string, string) -> string
         * The translate function returns the first argument string with occurrences
         * of characters in the second argument string replaced by the character at
         * the corresponding position in the third argument string.
         * For example, translate("bar","abc","ABC") returns the string BAr.
         * If there is a character in the second argument string with no character at
         * a corresponding position in the third argument string (because the second
         * argument string is longer than the third argument string), then occurrences of
         * that character in the first argument string are removed.
         * For example, translate("--aaa--","abc-","ABC") returns "AAA".
         * If a character occurs more than once in the second argument string, then the first
         * occurrence determines the replacement character. If the third argument string is
         * longer than the second argument string, then excess characters are ignored.
         */
        for (const arg of node.args) {
          this.visit(arg);
        }
        const replacement = XDataEval.toString(this.popData());
        const placeholder = XDataEval.toString(this.popData());
        const original = XDataEval.toString(this.popData());

        // replace function
        const replace = (
          original: string,
          placeholder: string,
          replacement: string,
          stopIndex: number
        ) => {
          const map = new Map<string, string>();
          for (let i = 0; i < stopIndex; i++) {
            // If a character occurs more than once in the second argument string,
            // then the first occurrence determines the replacement character
            if (!map.has(placeholder[i])) {
              map.set(placeholder[i], replacement[i]);
            }
          }
          let newStr = "";
          for (const ch of original) {
            const found = map.get(ch) || ch;
            newStr += found;
          }
          return newStr;
        };
        let newStr: string;
        if (placeholder.length === replacement.length) {
          newStr = replace(
            original,
            placeholder,
            replacement,
            replacement.length
          );
        } else if (placeholder.length > replacement.length) {
          // If there is a character in the second argument string with no character at
          // a corresponding position in the third argument string (because the second
          // argument string is longer than the third argument string), then occurrences of
          // that character in the first argument string are removed.
          const outcasts = placeholder.slice(replacement.length);
          let newOriginal = "";
          for (const ch of original) {
            if (!outcasts.includes(ch)) {
              newOriginal += ch;
            }
          }
          newStr = replace(
            newOriginal,
            placeholder,
            replacement,
            replacement.length
          );
        } else {
          // If the third argument string is longer than the second argument
          // string, then excess characters are ignored.
          newStr = replace(
            original,
            placeholder,
            replacement,
            placeholder.length
          );
        }
        this.pushData({ cType: XDataType.String, value: newStr });
      },
    };
  }

  private callFunction(node: CallNode) {
    type FnSignature = {
      retType: XDataType; // todo: determine return type use case
      paramCount: number;
      omittableParam: number;
      variadic?: boolean;
      fn: (node: CallNode) => void;
    };
    const fnLib = this.getCoreFunctions();
    const functions: { [key: string]: FnSignature } = {
      last: {
        retType: XDataType.Number,
        paramCount: 0,
        omittableParam: 0,
        fn: fnLib.lastFn,
      },
      position: {
        retType: XDataType.Number,
        paramCount: 0,
        omittableParam: 0,
        fn: fnLib.positionFn,
      },
      count: {
        retType: XDataType.Number,
        paramCount: 1,
        omittableParam: 0,
        fn: fnLib.countFn,
      },
      "local-name": {
        retType: XDataType.String,
        paramCount: 1,
        omittableParam: 1,
        fn: fnLib.localNameFn,
      },
      "namespace-uri": {
        retType: XDataType.String,
        paramCount: 1,
        omittableParam: 1,
        fn: fnLib.namespaceUriFn,
      },
      name: {
        retType: XDataType.String,
        paramCount: 1,
        omittableParam: 1,
        fn: fnLib.nameFn,
      },
      boolean: {
        retType: XDataType.Boolean,
        paramCount: 1,
        omittableParam: 0,
        fn: fnLib.booleanFn,
      },
      not: {
        retType: XDataType.Boolean,
        paramCount: 1,
        omittableParam: 0,
        fn: fnLib.notFn,
      },
      true: {
        retType: XDataType.Boolean,
        paramCount: 0,
        omittableParam: 0,
        fn: fnLib.trueFn,
      },
      false: {
        retType: XDataType.Boolean,
        paramCount: 0,
        omittableParam: 0,
        fn: fnLib.falseFn,
      },
      lang: {
        retType: XDataType.Boolean,
        paramCount: 1,
        omittableParam: 0,
        fn: fnLib.langFn,
      },
      number: {
        retType: XDataType.Number,
        paramCount: 1,
        omittableParam: 1,
        fn: fnLib.numberFn,
      },
      sum: {
        retType: XDataType.Number,
        paramCount: 1,
        omittableParam: 0,
        fn: fnLib.sumFn,
      },
      floor: {
        retType: XDataType.Number,
        paramCount: 1,
        omittableParam: 0,
        fn: fnLib.floorFn,
      },
      ceiling: {
        retType: XDataType.Number,
        paramCount: 1,
        omittableParam: 0,
        fn: fnLib.ceilingFn,
      },
      round: {
        retType: XDataType.Number,
        paramCount: 1,
        omittableParam: 0,
        fn: fnLib.roundFn,
      },
      string: {
        retType: XDataType.String,
        paramCount: 1,
        omittableParam: 1,
        fn: fnLib.stringFn,
      },
      concat: {
        retType: XDataType.String,
        paramCount: 2,
        omittableParam: 0,
        variadic: true,
        fn: fnLib.concatFn,
      },
      "starts-with": {
        retType: XDataType.Boolean,
        paramCount: 2,
        omittableParam: 0,
        fn: fnLib.startsWithFn,
      },
      contains: {
        retType: XDataType.Boolean,
        paramCount: 2,
        omittableParam: 0,
        fn: fnLib.containsFn,
      },
      "substring-before": {
        retType: XDataType.String,
        paramCount: 2,
        omittableParam: 0,
        fn: fnLib.substringBeforeFn,
      },
      "substring-after": {
        retType: XDataType.String,
        paramCount: 2,
        omittableParam: 0,
        fn: fnLib.substringAfterFn,
      },
      substring: {
        retType: XDataType.String,
        paramCount: 3,
        omittableParam: 1,
        fn: fnLib.substringFn,
      },
      "string-length": {
        retType: XDataType.Number,
        paramCount: 1,
        omittableParam: 1,
        fn: fnLib.stringLengthFn,
      },
      "normalize-space": {
        retType: XDataType.String,
        paramCount: 1,
        omittableParam: 1,
        fn: fnLib.normalizeSpaceFn,
      },
      translate: {
        retType: XDataType.String,
        paramCount: 3,
        omittableParam: 0,
        fn: fnLib.translateFn,
      },
    };
    // return-type | parameter count | parameter type
    const func: FnSignature = functions[node.name];
    if (!func) {
      this.error(`Function '${node.name}' is not supported`);
    }
    // check param count
    const argc = node.args.length;
    if (argc !== func.paramCount) {
      if (argc < func.paramCount) {
        // check less
        const diff = func.paramCount - argc;
        if (diff !== func.omittableParam) {
          this.error(`Function '${node.name}' is missing ${diff} argument(s)`);
        }
      } else if (argc > func.paramCount) {
        // check more
        if (!func.variadic) {
          this.error(
            `Function '${node.name}' expected ${func.paramCount} argument(s)`
          );
        }
      }
    }
    func.fn(node);
  }

  /****************************************/
  /**** expression types & evaluators *****/
  /****************************************/

  private evaluatePredicateExpr(res: XData): boolean {
    /*
     * A PredicateExpr is evaluated by evaluating the Expr and converting the result to boolean.
     * If the result is a number, the result will be converted to true if the number is equal to
     * the context position and will be converted to false otherwise;
     * if the result is not a number, then the result will be converted as if by a call
     * to the boolean function.
     */
    if (res.cType === XDataType.Number) {
      return (res.value as number) === this.ctx.pos;
    } else if (res.cType === XDataType.Boolean) {
      return res.value as boolean;
    } else {
      return XDataEval.toBoolean(res);
    }
  }

  private evaluateNonNodesetRelativeExpr(
    left: XData,
    right: XData,
    op: OpType
  ) {
    // ! != < > <= >=
    let ret: boolean;
    if (op === OpType.OpEq || op === OpType.OpNeq) {
      // if one of the data is boolean, cast the other to boolean.
      // boolean type has the highest precedence in terms of type coercion and casting.
      if (XDataEval.isBoolean(left) || XDataEval.isBoolean(right)) {
        const leftVal: boolean = XDataEval.toBoolean(left);
        const rightVal: boolean = XDataEval.toBoolean(right);
        ret = op === OpType.OpEq ? leftVal === rightVal : leftVal !== rightVal;
      }
      // If one of the data is number, cast the other to number
      else if (XDataEval.isNumber(left) || XDataEval.isNumber(right)) {
        const leftVal: number = XDataEval.toNumber(left);
        const rightVal: number = XDataEval.toNumber(right);
        ret = op === OpType.OpEq ? leftVal === rightVal : leftVal !== rightVal;
      }
      // cast both to strings and compare them
      else {
        const leftVal: string = XDataEval.toString(left);
        const rightVal: string = XDataEval.toString(right);
        ret = op === OpType.OpEq ? leftVal === rightVal : leftVal !== rightVal;
      }
    } else {
      // convert both to numbers and compare them
      const leftVal: number = XDataEval.toNumber(left);
      const rightVal: number = XDataEval.toNumber(right);
      switch (op) {
        case OpType.OpLt:
          ret = leftVal < rightVal;
          break;
        case OpType.OpGt:
          ret = leftVal > rightVal;
          break;
        case OpType.OpLeq:
          ret = leftVal <= rightVal;
          break;
        case OpType.OpGeq:
          ret = leftVal >= rightVal;
          break;
        default:
          unreachable("evaluateNonNodesetRelativeExpr");
      }
    }
    this.pushData({ cType: XDataType.Boolean, value: ret });
  }

  private evaluateNodesetRelativeExpr(left: XData, right: XData, op: OpType) {
    /*
     * We only care about the binary operations involving at least 1 nodeset node,
     * Since the other combinations are already handled in evaluateNonNodesetRelativeExpr()
     * i.e.:
     *                    right
     *                      ^
     *                      |
     *                      nodeset         string            number            boolean
     *  left-> nodeset  [['#', '#', '#'], ['#', '#', '#'], ['#', '#', '#'], ['#', '#', '#'] ],
     *         string   [['#', '#', '#'],       0,                0,                0       ],
     *         number   [['#', '#', '#'],       0,                0,                0       ],
     *         boolean  [['#', '#', '#'],       0,                0,                0       ],
     *                     |
     *                     ^
                           op
    */
    if (XDataEval.isNodeset(left)) {
      switch (right.cType) {
        case XDataType.Nodeset:
          this.compare_Nodeset_Nodeset(left, right, op as RelativeOpType);
          break;
        case XDataType.String:
          this.compare_Nodeset_String(left, right, op as RelativeOpType);
          break;
        case XDataType.Number:
          this.compare_Nodeset_Number(left, right, op as RelativeOpType);
          break;
        case XDataType.Boolean:
          this.compare_Nodeset_Boolean(left, right, op as RelativeOpType);
          break;
        default:
          unreachable("evaluateNodesetRelativeExpr");
      }
    } else if (XDataEval.isString(left)) {
      switch (right.cType) {
        case XDataType.Nodeset:
          this.compare_String_Nodeset(left, right, op as RelativeOpType);
          break;
        default:
          unreachable("evaluateNodesetRelativeExpr");
      }
    } else if (XDataEval.isNumber(left)) {
      switch (right.cType) {
        case XDataType.Nodeset:
          this.compare_Number_Nodeset(left, right, op as RelativeOpType);
          break;
        default:
          unreachable("evaluateNodesetRelativeExpr");
      }
    } else {
      // Boolean
      switch (right.cType) {
        case XDataType.Nodeset:
          this.compare_Boolean_Nodeset(left, right, op as RelativeOpType);
          break;
        default:
          unreachable("evaluateNodesetRelativeExpr");
      }
    }
  }

  private evaluateConditionalExpr(left: XData, right: XData, op: OpType) {
    // for 'and' & 'or' both operands are converted to boolean types
    const leftVal: boolean = XDataEval.toBoolean(left);
    let ret: boolean;
    if (op === OpType.OpOr) {
      if (leftVal) {
        ret = leftVal;
      } else {
        ret = XDataEval.toBoolean(right);
      }
    } else {
      // and
      if (!leftVal) {
        ret = leftVal;
      } else {
        ret = leftVal && XDataEval.toBoolean(right);
      }
    }
    this.pushData({ cType: XDataType.Boolean, value: ret });
  }

  private evaluateRelativeExpr(left: XData, right: XData, op: OpType) {
    if (!XDataEval.isNodeset(left) && !XDataEval.isNodeset(right)) {
      this.evaluateNonNodesetRelativeExpr(left, right, op);
    } else {
      this.evaluateNodesetRelativeExpr(left, right, op);
    }
  }

  private evaluatePipeExpr(left: XData, right: XData) {
    if (!XDataEval.isNodeset(left) || !XDataEval.isNodeset(right)) {
      this.error("Pipe/union operator takes only nodesets as arguments");
    } else {
      // reuse left
      const union = left.value as XNodeSet;
      for (const val of right.value as XNodeSet) {
        union.add(val);
      }
      const value: XNodeSet = this.sortNodeset(union);
      this.pushData({ cType: XDataType.Nodeset, value });
    }
  }

  private evaluateArithmeticExpr(left: XData, right: XData, op: OpType) {
    // convert both to numbers
    const leftVal: number = XDataEval.toNumber(left);
    const rightVal: number = XDataEval.toNumber(right);
    let ret: number;
    if (Number.isNaN(leftVal) || Number.isNaN(rightVal)) {
      ret = NaN;
    } else {
      switch (op) {
        case OpType.OpPlus:
          ret = leftVal + rightVal;
          break;
        case OpType.OpMinus:
          ret = leftVal - rightVal;
          break;
        case OpType.OpMul:
          ret = leftVal * rightVal;
          break;
        case OpType.OpDiv:
          ret = leftVal / rightVal;
          break;
        case OpType.OpMod:
          ret = leftVal % rightVal;
          break;
        default:
          unreachable("evaluateArithmeticExpr");
      }
    }
    this.pushData({ cType: XDataType.Number, value: ret });
  }

  /********************/
  /**** visitors *****/
  /*******************/

  private visit(node: XNodeT): void {
    const fnProp = `visit${node.constructor.name}`;
    // eslint-disable-next-line  @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this[fnProp].call(this, node);
  }

  private visitPathNode(node: PathNode): void {
    this.pushData({ cType: XDataType.Nodeset, value: new Set() });
    node.steps.forEach((node: XNodeT, index: number) => {
      if (node instanceof StepNode) {
        node.pos = index;
      }
      this.visit(node);
    });
  }

  private visitNumberNode(node: NumberNode): void {
    this.pushData({ cType: XDataType.Number, value: +node.value });
  }

  private visitStringNode(node: StringNode): void {
    this.pushData({ cType: XDataType.String, value: node.value });
  }

  private visitUnaryOpNode(node: UnaryOpNode): void {
    this.visit(node.node);
    const right = this.popData();
    const value = XDataEval.toNumber(right);
    switch (node.op) {
      case OpType.OpPlus:
        this.pushData({ cType: XDataType.Number, value });
        break;
      case OpType.OpMinus:
        this.pushData({ cType: XDataType.Number, value: -value });
        break;
      default:
        unreachable(
          `visitUnaryOpNode::Illegal operator for unary '${node.op}'`
        );
    }
  }

  private visitBinaryOpNode(node: BinaryOpNode): void {
    this.visit(node.leftNode);
    this.visit(node.rightNode);
    const right: XData = this.popData();
    const left: XData = this.popData();
    switch (node.op) {
      case OpType.OpPlus:
      case OpType.OpMinus:
      case OpType.OpMul:
      case OpType.OpDiv:
      case OpType.OpMod:
        this.evaluateArithmeticExpr(left, right, node.op);
        break;
      case OpType.OpEq:
      case OpType.OpNeq:
      case OpType.OpLt:
      case OpType.OpGt:
      case OpType.OpGeq:
      case OpType.OpLeq:
        this.evaluateRelativeExpr(left, right, node.op);
        break;
      case OpType.OpOr:
      case OpType.OpAnd:
        this.evaluateConditionalExpr(left, right, node.op);
        break;
      case OpType.OpPipe:
        this.evaluatePipeExpr(left, right);
        break;
      default:
        unreachable(
          `visitBinaryOpNode::Illegal operator for binary '${node.op}'`
        );
    }
  }

  private visitCallNode(node: CallNode): void {
    // core functions ->
    // signature -> return-type | parameter count | parameter type
    this.callFunction(node);
  }

  private visitStepNode(node: StepNode): undefined {
    const data: XData = this.popData();
    const nodeset = data.value as XNodeSet;
    if (node.pos > 0 && !nodeset.size) {
      // no need to evaluate this step since it's the not the **first** step,
      // and the nodeset is empty. This means that a __previous__ step evaluated
      // to an empty nodeset
      this.pushData(data); // return... to sender ;)
      return;
    }

    this.state.construct(nodeset, this.ctx.node, this.root);
    this.state.step(node);
    const nodesetArray = this.state.result();
    const empty = null as unknown as XNodeSet;

    if (!node.predicates.length) {
      // if the step has no predicates, combine all nodesets found into a
      // single nodeset for the next step node's evaluation if available
      const nodeList: nodes.RNodeT[] = [];
      for (const node_set of nodesetArray) {
        nodeList.push(...node_set);
      }
      const result: XNodeSet = this.sortNodeset(empty, nodeList);
      this.pushData({ cType: XDataType.Nodeset, value: result });
    } else {
      // if the step has predicates, then the nodesetArray is the partitioned nodeset
      // which the predicate node evaluates on. We push that directly
      this.pushData({
        cType: XDataType.Nodeset,
        value: empty,
        nodesetArray,
      });
    }

    for (const pred of node.predicates) {
      this.visit(pred);
    }
  }

  private visitPredicateNode(node: PredicateNode): void | never {
    let partitions: Array<XNodeSet>;
    if (node.leftExpr) {
      // when leftExpr is available (for ex. (//*)[1] `(//*)` becomes leftExpr)
      // we do not want the nodesetArray partitioned in the way the nodes were obtained,
      // instead all nodeset in the nodesetArray should be combined into one nodeset, i.e.
      // the nodeset array should only contain one nodeset containing all nodes.
      // this is because such kinds of expression (ex. (//*)[1] mentioned above) is akin
      // to indexing.
      this.visit(node.leftExpr);
      const data: XData = this.popData();
      // handle orphaned PathNode(s) arising as a result of multiple PathNodes in a
      // query expression e.g. in (//*)[1] -> `//*` <- PathNode `(//*)[1]` overall PathNode
      if (node.leftExpr instanceof PathNode) {
        this.popData();
      }
      if (!data.nodesetArray) {
        if (data.value && XDataEval.isNodeset(data)) {
          partitions = [data.value as XNodeSet];
        } else {
          this.error(
            "Expected type",
            XDataType.Nodeset,
            "as predicate operand but got",
            data.cType
          );
        }
      } else {
        const nodes: nodes.RNodeT[] = [];
        for (const nodeset of data.nodesetArray) {
          nodes.push(...nodeset);
        }
        partitions = [new Set<nodes.RNodeT>(nodes)];
      }
    } else {
      // if leftExpr isn't available, the nodesetArray available represents
      // the partitioned nodesets (directly from step node)
      const data: XData = this.popData();
      assert(XDataEval.isNodeset(data), "Expected nodeset type as popped data");
      assert(data.nodesetArray, "Expected nodeset array as actual data value");
      partitions = data.nodesetArray;
    }
    this.reorderNodesetArrayInPlace(partitions, node.order);
    let result: XNodeSet = new Set();
    // nodesetArray would hold the result for the next predicate to be evaluated, if any
    const nodesetArray: Array<XNodeSet> = [];
    let ctxSize: number, ctxPos: number;
    for (const partition of partitions) {
      const tmp: XNodeSet = new Set();
      ctxSize = partition.size;
      ctxPos = 0;
      for (const ctxNode of partition) {
        ctxPos++;
        // create a new context
        this.pushContext({ pos: ctxPos, size: ctxSize, node: ctxNode });
        // visit the predicate expression
        this.visit(node.expr);
        // evaluate the expression against the ctx node
        const res: XData = this.popData();
        if (this.evaluatePredicateExpr(res)) {
          result.add(ctxNode);
          tmp.add(ctxNode);
        }
        // reset context to its initial state
        this.popContext();
      }
      if (tmp.size) {
        nodesetArray.push(tmp);
      }
    }
    // sort the nodeset in document order (for use if the next node to be evaluated
    // after this predicate node is a step or not a predicate node)
    result = this.sortNodeset(result);
    // push the result
    this.pushData({ cType: XDataType.Nodeset, value: result, nodesetArray });
  }

  query(queryString: Readonly<string>): XDataCType {
    assert(this.root, "Expected query root");
    const query: XNodeT = new XParser(queryString).parse();
    this.pushContext({ pos: 1, size: 1, node: this.root });
    this.visit(query);
    const result = this.popData();
    this.endComputation();
    return result.value;
  }

  queryOne<T extends XReturnType>(queryString: Readonly<string>): T | null {
    const v: XDataCType = this.query(queryString);
    if (v instanceof Set) {
      if (!v.size) return null;
      return Array.from<T>(v as Set<T>)[0];
    }
    return <T>v;
  }

  queryAll<T extends XReturnType>(queryString: Readonly<string>): T[] {
    const v: XDataCType = this.query(queryString);
    if (v instanceof Set) {
      if (!v.size) return [];
      return Array.from<T>(v as Set<T>);
    }
    return [<T>v];
  }
}
