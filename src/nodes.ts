/**
 * Core node type definitions
 **/

import * as constants from "./constants";
import { Render, RenderConfig } from "./render";

export enum RNodeType {
  Text = "TEXT_NODE",
  Comment = "COMMENT_NODE",
  Attribute = "ATTRIBUTE_NODE",
  Element = "ELEMENT_NODE",
  ProcessingInstruction = "PROCESSING_INSTRUCTION_NODE",
  Namespace = "NAMESPACE_NODE",
  Root = "ROOT_NODE",
  /** custom node types **/
  DTD = "DTD_NODE",
  XmlDecl = "DECLARATION_NODE",
}

export type RNodeT =
  | ElementNode
  | TextNode
  | AttributeNode
  | NamespaceNode
  | RootNode
  | CommentNode
  | PINode
  | DTDNode
  | XMLDeclNode;

export type RParentNodeT = ElementNode | RootNode;

export type FilterFn = (n: RNodeT) => boolean;

interface RNode<P = RParentNodeT, T = number> {
  readonly _type: RNodeType;
  parent: P;
  index: T; // only corresponds to direct children of parent nodes - i.e. comment,text,element,pi,
  id(): T;
  stringValue(): string;
  numberValue(): number;
  expandedName(): string;
  position(): number;
  setPosition(position: number): void;
  prettify(config?: RenderConfig): string;
}

export class RName {
  constructor(
    public qname: string, // qualified name
    public lname: string, // local name
    public pname: string // prefix name
  ) {}

  toString() {
    return `${this.qname}`;
  }
}

export class ElementNode implements RNode {
  readonly _type = RNodeType.Element;
  public parent!: RParentNodeT;
  public index!: number;
  public hasChild = false;
  public hasParent = false;
  public hasText = false;
  public hasComment = false;
  public hasAttribute = false;
  public isSelfEnclosing = false;
  public isVoid = false;
  public isNamespaced = false;
  public children: Array<RNodeT> = [];
  public namespace: NamespaceNode | null = null;
  public attributes: Map<string, AttributeNode> = new Map();
  public namespaces: Array<NamespaceNode> = [];
  public mode = "XML";
  private pos = -1;

  constructor(public name: RName) {}

  expandedName(): string {
    if (this.namespace) {
      return `${this.namespace.uri.trim()}:${this.name.lname}`;
    }
    return this.name.qname;
  }

  setPosition(position: number) {
    this.pos = position;
  }

  id() {
    return this.pos;
  }

  numberValue(): number {
    const str = this.stringValue(false, true);
    return str.trim().length ? +str : NaN;
  }

  position(): number {
    return this.pos;
  }

  stringValue(transformNamedEntities = true, checkType?: boolean): string {
    /**
     * checkType is a flag used when we care about the numerical type of
     * the nodes being converted to string.
     * Useful when a text node is being converted to a string so that it can then be
     * converted to a numerical value, in that case, with checkType set,
     * when any string with a non-numeric type is found, it fails fast and stops
     * building the string, because the end result would be a NAN.
     */
    let val = "";
    for (const child of this.children) {
      if (isText(child)) {
        if (checkType && Number.isNaN(child.numberValue())) {
          // when checking type, stop searching immediately we confirm
          // that at least one text node's numeric value is NaN
          break;
        }
        val += child.stringValue(transformNamedEntities);
      } else if (isElement(child)) {
        val += child.stringValue(transformNamedEntities, checkType);
      }
    }
    return val;
  }

  hasAttributeNode(name: string): boolean {
    return this.attributes.has(name);
  }

  getAttributeNode(name: string): AttributeNode | undefined {
    return this.attributes.get(name);
  }

  clone(): ElementNode {
    // shallow copy of element
    const elem = new ElementNode(this.name);
    elem.parent = this.parent;
    elem.index = this.index;
    elem.hasChild = this.hasChild;
    elem.hasParent = this.hasParent;
    elem.hasText = this.hasText;
    elem.hasComment = this.hasComment;
    elem.hasAttribute = this.hasAttribute;
    elem.isSelfEnclosing = this.isSelfEnclosing;
    elem.isVoid = this.isVoid;
    elem.isNamespaced = this.isNamespaced;
    elem.children = this.children;
    elem.namespace = this.namespace;
    elem.attributes = this.attributes;
    elem.namespaces = this.namespaces;
    elem.pos = this.pos;
    return elem;
  }

  prettify(config?: RenderConfig): string {
    return new Render(config).renderElementNode(this);
  }
}

export class TextNode implements RNode {
  readonly _type = RNodeType.Text;
  public index!: number;
  public hasEntity = false;
  public isCData = false;
  public parent!: RParentNodeT;
  private pos = -1;
  constructor(public value: string) {}

  id() {
    return this.pos;
  }

  position(): number {
    return this.pos;
  }

  setPosition(position: number) {
    this.pos = position;
  }

  stringValue(transformNamedEntities = true): string {
    return transformNamedEntities
      ? Render.transposeEntities(this.value)
      : this.value;
  }

  numberValue(): number {
    return this.value.trim().length ? +this.value : NaN;
  }

  expandedName(): string {
    return "";
  }

  prettify(config?: RenderConfig): string {
    return new Render(config).renderTextNode(this);
  }
}

export class AttributeNode implements RNode<ElementNode | XMLDeclNode | null> {
  readonly _type: RNodeType = RNodeType.Attribute;
  public parent!: ElementNode | XMLDeclNode;
  public index = NaN;
  public namespace: NamespaceNode | null = null;
  private pos = -1;
  constructor(public name: RName, public value: string) {}

  expandedName(): string {
    if (this.namespace) {
      return `${this.namespace.uri.trim()}:${this.name.lname}`;
    }
    return this.name.qname;
  }

  id(): number {
    return this.pos;
  }

  setPosition(position: number) {
    this.pos = position;
  }

  numberValue(): number {
    return this.value.trim().length ? +this.value : NaN;
  }

  position(): number {
    return this.pos;
  }

  stringValue(): string {
    return this.value;
  }

  prettify(config?: RenderConfig): string {
    return new Render(config).renderAttributeNode(this);
  }
}

export class NamespaceNode implements RNode {
  readonly _type = RNodeType.Namespace;
  public parent!: RParentNodeT;
  public index = NaN;
  public isDefault = false;
  public isGlobal = false;
  private pos = -1;
  constructor(public prefix: string, public uri: string) {}

  expandedName(): string {
    return this.prefix !== constants.XmlnsName ? this.prefix : "";
  }

  id() {
    return this.pos;
  }

  setPosition(position: number) {
    this.pos = position;
  }

  numberValue(): number {
    return NaN;
  }

  position(): number {
    return this.pos;
  }

  stringValue(): string {
    // no normalization is done
    return this.uri;
  }

  prettify(config?: RenderConfig): string {
    return new Render(config).renderNamespaceNode(this);
  }
}

export class CommentNode implements RNode {
  readonly _type = RNodeType.Comment;
  public parent!: RParentNodeT;
  public index!: number;
  private pos = -1;

  constructor(public value: string) {}

  expandedName(): string {
    return "";
  }

  id() {
    return this.pos;
  }

  setPosition(position: number) {
    this.pos = position;
  }

  numberValue(): number {
    return this.value.trim().length ? +this.value : NaN;
  }

  position(): number {
    return this.pos;
  }

  stringValue(): string {
    return this.value;
  }

  prettify(config?: RenderConfig): string {
    return new Render(config).renderCommentNode(this);
  }
}

export class PINode implements RNode {
  readonly _type = RNodeType.ProcessingInstruction;
  public parent!: RParentNodeT;
  public index!: number;
  private pos = -1;
  constructor(public target: string, public value: string) {}

  id(): number {
    return this.pos;
  }

  position(): number {
    return this.pos;
  }

  setPosition(position: number) {
    this.pos = position;
  }

  stringValue(): string {
    return this.value;
  }

  numberValue(): number {
    return this.value.trim().length ? +this.value : NaN;
  }

  expandedName(): string {
    return this.target;
  }

  prettify(config?: RenderConfig): string {
    return new Render(config).renderPINode(this);
  }
}

export class RootNode implements RNode<null> {
  readonly _type = RNodeType.Root;
  public parent = null;
  public index = NaN;
  public xmlDecl: { node: XMLDeclNode; pos: number } | null = null;
  public dtdDecl: { node: DTDNode; pos: number } | null = null;
  public rootElement: ElementNode | null = null;
  public hasChild = false;
  public isWellFormed = false;
  public children: RNodeT[] = [];
  public namespaces: NamespaceNode[] = [];
  private pos = -1; // before any node

  constructor(public name: string) {}

  expandedName(): string {
    return "";
  }

  id(): number {
    return this.pos;
  }

  setPosition(position: number) {
    this.pos = position;
  }

  numberValue(): number {
    return NaN;
  }

  position(): number {
    return this.pos;
  }

  stringValue(): string {
    let val = "";
    for (const child of this.children) {
      if (isText(child)) {
        val += child.stringValue();
      } else if (isElement(child)) {
        val += child.stringValue();
      }
    }
    return val;
  }

  prettify(config?: RenderConfig): string {
    return new Render(config).renderRootNode(this);
  }
}

export class DTDNode implements RNode {
  readonly _type = RNodeType.DTD;
  public parent!: RootNode;
  public index = NaN;
  private pos = -1;

  constructor(public value: string) {}

  expandedName(): string {
    return "";
  }

  id() {
    return this.pos;
  }

  setPosition(position: number) {
    this.pos = position;
  }

  numberValue(): number {
    return NaN;
  }

  position(): number {
    return this.pos;
  }

  stringValue(): string {
    return this.value;
  }

  prettify(config?: RenderConfig): string {
    return new Render(config).renderDTDNode(this);
  }
}

export class XMLDeclNode implements RNode {
  readonly _type = RNodeType.XmlDecl;
  public parent!: RootNode;
  public index = NaN;
  public attributes: Map<string, AttributeNode> = new Map();
  private pos = -1;

  expandedName(): string {
    return "";
  }

  id() {
    return this.pos;
  }

  setPosition(position: number) {
    this.pos = position;
  }

  numberValue(): number {
    return NaN;
  }

  position(): number {
    return this.pos;
  }

  stringValue(): string {
    return "";
  }

  prettify(config?: RenderConfig): string {
    return new Render(config).renderXMLDeclNode(this);
  }
}

/** Utilities **/

export interface Traversable<T> {
  traverseAllLinear(
    node: T,
    test: (n: T) => boolean,
    result: Array<T> | Set<T>
  ): void;

  traverseAllRecursive(
    node: T,
    test: (n: T) => boolean,
    result: Array<T> | Set<T>
  ): void;
}

export function isRoot(val: RNodeT): val is RootNode {
  return val._type === RNodeType.Root;
}

export function isElement(val: RNodeT): val is ElementNode {
  return val._type === RNodeType.Element;
}

export function isAttribute(val: RNodeT): val is AttributeNode {
  return val._type === RNodeType.Attribute;
}

export function isNamespace(val: RNodeT): val is NamespaceNode {
  return val._type === RNodeType.Namespace;
}

export function isText(val: RNodeT): val is TextNode {
  return val._type === RNodeType.Text;
}

export function isComment(val: RNodeT): val is CommentNode {
  return val._type === RNodeType.Comment;
}

export function isPI(val: RNodeT): val is PINode {
  return val._type === RNodeType.ProcessingInstruction;
}

export function isParent(val: RNodeT): val is RootNode | ElementNode {
  return isRoot(val) || isElement(val);
}
