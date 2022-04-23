import * as nodes from "./nodes";
import { ExcludedHTMLElementTexts } from "./constants";

type AttributeKey = string;
type AttributeValue = string;
type ElementName = string;
type MatchType =
  | "partial"
  | "exact"
  | "partial-ignoreCase"
  | "exact-ignoreCase";
export type StringFilterT = Readonly<{
  value: string;
  match: MatchType;
  trim?: boolean;
}>;

export type AttributeFilterT =
  | AttributeKey
  | Array<AttributeKey>
  | { [key: AttributeKey]: AttributeValue };

export type SelectFilterT =
  | ElementName
  | Readonly<
      Partial<{
        name: ElementName;
        text: string | StringFilterT;
        comment: string | StringFilterT;
        target: string; // pi-target
        filter: nodes.FilterFn;
      }>
    >;

/**
 * SUC Interfaces
 */
// prettier-ignore
interface Select {
  find(pattern: SelectFilterT, recursive?: boolean): nodes.RNodeT | null;
  findAll(pattern: SelectFilterT, recursive?: boolean): nodes.RNodeT[];
  findChildren(pattern: SelectFilterT, recursive?: boolean): nodes.RNodeT[];
  next(): nodes.RNodeT | null;
  previous(): nodes.RNodeT | null;
  nextElement(): nodes.ElementNode | null;
  previousElement(): nodes.ElementNode | null;
  nextComment(): nodes.CommentNode | null;
  previousComment(): nodes.CommentNode | null;
  nextText(): nodes.TextNode | null;
  previousText(): nodes.TextNode | null;
  parent(): nodes.RParentNodeT | null;
  findParent(pattern: SelectFilterT, recursive?: boolean): nodes.RParentNodeT | null;
  ancestors(): nodes.RParentNodeT[];
  findAncestors(pattern: SelectFilterT, recursive?: boolean): nodes.RParentNodeT[];
  descendants(): nodes.RNodeT[];
  findDescendants(pattern: SelectFilterT, recursive?: boolean): nodes.RNodeT[];
  nextSibling(): nodes.RNodeT | null;
  previousSibling(): nodes.RNodeT | null;
  findNextSibling(pattern: SelectFilterT, recursive?: boolean): nodes.RNodeT | null;
  findPreviousSibling(pattern: SelectFilterT, recursive?: boolean): nodes.RNodeT | null;
  siblings(): nodes.RNodeT[];
  findSiblings(pattern: SelectFilterT, recursive?: boolean): nodes.RNodeT[];
  findAttribute(pattern: SelectFilterT, key: AttributeKey, recursive?: boolean): nodes.AttributeNode | null;
  findAttributes(pattern: SelectFilterT, recursive?: boolean): nodes.AttributeNode[];
  extractComments(recursive?: boolean): nodes.CommentNode[];
  extractTexts(recursive?: boolean): nodes.TextNode[];
  comment(concat?: string, recursive?: boolean): string;
  text(concat?: string, recursive?: boolean): string;
}

// prettier-ignore
interface Update {
  insertBefore(node: nodes.RNodeT): boolean;
  insertAfter(node: nodes.RNodeT): boolean;
  setElementName(lName: string, pName?: string): boolean;
  setNamespace(namespace: nodes.NamespaceNode): boolean;
  addNamespace(namespace: nodes.NamespaceNode): boolean;
  addAttribute(attribute: nodes.AttributeNode): boolean;
  setRootNodeName(name: string): boolean;
  setRootElement(node: nodes.ElementNode): boolean;
  addChild(node: nodes.RNodeT): boolean;
}

// prettier-ignore
interface Create {
  createElement(lName: string, pName?: string): nodes.ElementNode;
  createText(value: string): nodes.TextNode;
  createComment(value: string): nodes.CommentNode;
  createAttribute(value: string, lName: string, pName?: string): nodes.AttributeNode;
  createNamespace(prefix: string, uri: string): nodes.NamespaceNode;
  createRoot(name: string): nodes.RootNode;
  createPI(target: string, value: string): nodes.PINode;
}

// prettier-ignore
interface Delete {
  drop(): boolean;
  dropChild(filter: nodes.FilterFn, recursive?: boolean): boolean;
  dropChildren(filter: nodes.FilterFn, recursive?: boolean): boolean;
  dropAttribute(name: AttributeKey): boolean;
}

/**
 * Filters
 */
export class DOMFilter {
  private static performMatch(
    match: MatchType,
    nodeValue: string,
    searchValue: string
  ): boolean {
    switch (match) {
      case "exact":
        return nodeValue === searchValue;
      case "partial":
        return nodeValue.includes(searchValue);
      case "exact-ignoreCase":
        return nodeValue.toLowerCase() === searchValue.toLowerCase();
      case "partial-ignoreCase":
        return nodeValue.toLowerCase().includes(searchValue.toLowerCase());
      default:
        return false;
    }
  }

  static AttributeFilter(attributes: AttributeFilterT): nodes.FilterFn {
    return (node: nodes.RNodeT) => {
      if (nodes.isElement(node)) {
        if (typeof attributes === "string") {
          return node.hasAttributeNode(attributes);
        } else if (Array.isArray(attributes)) {
          for (const name of attributes) {
            if (node.hasAttributeNode(name)) {
              return true;
            }
          }
        } else if (typeof attributes === "object") {
          let attr: nodes.AttributeNode | undefined;
          for (const name in attributes) {
            if (
              (attr = node.getAttributeNode(name)) &&
              attr.value === attributes[name]
            ) {
              return true;
            }
          }
        }
      }
      return false;
    };
  }

  static ElementFilter(
    name: ElementName,
    attribute?: AttributeFilterT
  ): nodes.FilterFn {
    if (attribute) {
      const attrFilter: nodes.FilterFn = DOMFilter.AttributeFilter(attribute);
      return (node: nodes.RNodeT) => {
        return (
          nodes.isElement(node) && node.name.qname === name && attrFilter(node)
        );
      };
    } else {
      return (node: nodes.RNodeT) => {
        return nodes.isElement(node) && node.name.qname === name;
      };
    }
  }

  static TextFilter(pattern: StringFilterT | string): nodes.FilterFn {
    return (node: nodes.RNodeT) => {
      if (!nodes.isText(node)) return false;
      if (typeof pattern === "string") {
        return pattern === node.value;
      } else if (typeof pattern === "object") {
        const match = pattern.match;
        const nodeValue = pattern.trim ? node.value.trim() : node.value;
        return DOMFilter.performMatch(match, nodeValue, pattern.value);
      }
      return false;
    };
  }

  static CommentFilter(pattern: StringFilterT | string): nodes.FilterFn {
    return (node: nodes.RNodeT) => {
      if (!nodes.isComment(node)) return false;
      if (typeof pattern === "string") {
        return pattern === node.value;
      } else if (typeof pattern === "object") {
        const match = pattern.match;
        const nodeValue = pattern.trim ? node.value.trim() : node.value;
        return this.performMatch(match, nodeValue, pattern.value);
      }
      return false;
    };
  }

  static PIFilter(pattern: string): nodes.FilterFn {
    return (node: nodes.RNodeT) => {
      if (!nodes.isPI(node)) return false;
      return node.target === pattern;
    };
  }
}

export class DOM
  implements nodes.Traversable<nodes.RNodeT>, Select, Update, Create, Delete
{
  private root!: nodes.RNodeT;
  public dom!: (n: nodes.RNodeT) => DOM;

  constructor() {
    this.dom = this.construct.bind(this);
  }

  /** Select **/

  private select(pattern: SelectFilterT): nodes.FilterFn | never {
    // direct `name`
    if (typeof pattern === "string") {
      return DOMFilter.ElementFilter(pattern);
    } else if (pattern.name) {
      return DOMFilter.ElementFilter(pattern.name);
    } else if (pattern.comment) {
      return DOMFilter.CommentFilter(pattern.comment);
    } else if (pattern.text) {
      return DOMFilter.TextFilter(pattern.text);
    } else if (pattern.target) {
      return DOMFilter.PIFilter(pattern.target);
    } else if (pattern.filter) {
      return pattern.filter;
    } else {
      throw new Error("Unknown pattern provided");
    }
  }

  public construct(node: nodes.RNodeT): DOM {
    this.root = node;
    return this;
  }

  public traverseLinear(
    node: nodes.RNodeT,
    test: nodes.FilterFn
  ): nodes.RNodeT | null {
    if (test(node)) {
      return node;
    }
    if (nodes.isParent(node)) {
      for (const child of node.children) {
        if (test(child)) {
          return child;
        }
      }
    }
    return null;
  }

  public traverseAllLinear(
    node: nodes.RNodeT,
    test: nodes.FilterFn,
    result: nodes.RNodeT[]
  ) {
    if (test(node)) {
      result.push(node);
    }
    if (nodes.isParent(node)) {
      for (const child of node.children) {
        if (test(child)) {
          result.push(child);
        }
      }
    }
  }

  public traverseRecursive(
    node: nodes.RNodeT,
    test: nodes.FilterFn
  ): nodes.RNodeT | null {
    if (test(node)) {
      return node;
    }
    let res;
    if (nodes.isParent(node)) {
      for (const child of node.children) {
        if ((res = this.traverseRecursive(child, test))) return res;
      }
    }
    return null;
  }

  public traverseAllRecursive(
    node: nodes.RNodeT,
    test: nodes.FilterFn,
    result: nodes.RNodeT[]
  ) {
    if (test(node)) {
      result.push(node);
    }
    if (nodes.isParent(node)) {
      for (const child of node.children) {
        this.traverseAllRecursive(child, test, result);
      }
    }
  }

  private nextNode<T extends nodes.RNodeT>(check: nodes.FilterFn): T | null {
    if (!check(this.root)) return null;
    const children = (<nodes.RParentNodeT>this.root.parent!).children;
    let child: T;
    for (let i = this.root.index + 1; i < children.length; i++) {
      child = <T>children[i];
      if (check(child)) {
        return child;
      }
    }
    return null;
  }

  private previousNode<T extends nodes.RNodeT>(
    check: nodes.FilterFn
  ): T | null {
    if (!check(this.root)) return null;
    const children = (<nodes.RParentNodeT>this.root.parent!).children;
    let child: T;
    for (let i = this.root.index - 1; i >= 0; i--) {
      child = <T>children[i];
      if (check(child)) {
        return child;
      }
    }
    return null;
  }

  private updateIndexes(items: nodes.RNodeT[], start: number): void {
    for (let i = start; i < items.length; i++) {
      items[i].index = i;
    }
  }

  private updateParentFields(
    parent: nodes.RParentNodeT,
    child: nodes.RNodeT
  ): void {
    if (nodes.isElement(parent)) {
      switch (child._type) {
        case nodes.RNodeType.Attribute:
          parent.hasAttribute = true;
          break;
        case nodes.RNodeType.Text:
          parent.hasText = true;
          break;
        case nodes.RNodeType.Comment:
          parent.hasComment = true;
          break;
        case nodes.RNodeType.Namespace:
          parent.isNamespaced = true;
          break;
        default:
          break;
      }
      parent.isSelfEnclosing = parent.children.length === 0;
    }
    parent.hasChild = !!parent.children.length;
    child.parent = parent;
  }

  private updateParentFieldsD(
    parent: nodes.RParentNodeT,
    child: nodes.RNodeT
  ): void {
    // updateParentFields(), but for when a child is dropped.
    const has = (n: nodes.RNodeT) => n._type === child._type;
    if (nodes.isElement(parent)) {
      switch (child._type) {
        case nodes.RNodeType.Attribute:
          parent.hasAttribute = !!parent.attributes.size;
          break;
        case nodes.RNodeType.Text:
          parent.hasText = parent.children.some(has);
          break;
        case nodes.RNodeType.Comment:
          parent.hasComment = parent.children.some(has);
          break;
        case nodes.RNodeType.Namespace:
          parent.isNamespaced = !!parent.namespace;
          break;
        default:
          break;
      }
      parent.isSelfEnclosing = parent.children.length === 0;
    }
    parent.hasChild = !!parent.children.length;
    child.parent = null;
  }

  private createName(lName: string, pName?: string): nodes.RName {
    const qname = pName ? `${pName}:${lName}` : lName;
    return new nodes.RName(qname, lName, pName || "");
  }

  private dropNode(node: nodes.RNodeT): boolean {
    if (nodes.isAttribute(node) || nodes.isNamespace(node)) return false;
    const parent = node.parent as nodes.RParentNodeT;
    if (!parent) return false;
    parent.children.splice(node.index, 1);
    this.updateIndexes(parent.children, node.index);
    this.updateParentFieldsD(parent, node);
    return true;
  }

  /**
   * Find a node that matches the given pattern
   * @param pattern: the pattern for selecting the node
   * @param recursive: flag to determine if search is to be done recursively
   */
  find<T extends nodes.RNodeT>(
    pattern: SelectFilterT,
    recursive = true
  ): T | null | never {
    const cb: nodes.FilterFn = this.select(pattern);
    return <T>(
      (recursive
        ? this.traverseRecursive(this.root, cb)
        : this.traverseLinear(this.root, cb))
    );
  }

  /**
   * Find all nodes that match the given pattern
   * @param pattern: the pattern for selecting the node
   * @param recursive: flag to determine if search is to be done recursively
   */
  findAll<T extends nodes.RNodeT>(
    pattern: SelectFilterT,
    recursive = true
  ): T[] {
    const res = new Array<T>();
    const cb: nodes.FilterFn = this.select(pattern);
    recursive
      ? this.traverseAllRecursive(this.root, cb, res)
      : this.traverseAllLinear(this.root, cb, res);
    return res;
  }

  /**
   * Find the children of the node that matches the given pattern
   * @param pattern: the pattern for selecting the node
   * @param recursive: flag to determine if search is to be done recursively
   */
  findChildren<T extends nodes.RNodeT>(
    pattern: SelectFilterT,
    recursive = true
  ): T[] {
    const elem = this.find<nodes.ElementNode>(pattern, recursive);
    if (elem && nodes.isParent(elem)) {
      return elem.children as T[];
    }
    return [];
  }

  /**
   * Get the next node after the current node in document order
   */
  next<T extends nodes.RNodeT>(): T | null {
    // eslint-disable-next-line  @typescript-eslint/no-unused-vars
    return this.nextNode<T>((_: nodes.RNodeT) => true);
  }

  /**
   * Get the previous node before the current node in document order
   */
  previous<T extends nodes.RNodeT>(): T | null {
    // eslint-disable-next-line  @typescript-eslint/no-unused-vars
    return this.previousNode<T>((_: nodes.RNodeT) => true);
  }

  /**
   * Get the next element node after the current node in document order
   * provided the current node is an element
   */
  nextElement(): nodes.ElementNode | null {
    return this.nextNode<nodes.ElementNode>(nodes.isElement);
  }

  /**
   * Get the previous element node before the current node in document order
   * provided the current node is an element
   */
  previousElement(): nodes.ElementNode | null {
    return this.previousNode<nodes.ElementNode>(nodes.isElement);
  }

  /**
   * Get the next comment node after the current node in document order
   * provided the current node is a comment
   */
  nextComment(): nodes.CommentNode | null {
    return this.nextNode<nodes.CommentNode>(nodes.isComment);
  }

  /**
   * Get the previous comment node before the current node in document order
   * provided the current node is a comment
   */
  previousComment(): nodes.CommentNode | null {
    return this.previousNode<nodes.CommentNode>(nodes.isComment);
  }

  /**
   * Get the next text node after the current node in document order
   * provided the current node is a text
   */
  nextText(): nodes.TextNode | null {
    return this.nextNode<nodes.TextNode>(nodes.isText);
  }

  /**
   * Get the previous text node before the current node in document order
   * provided the current node is a text
   */
  previousText(): nodes.TextNode | null {
    return this.previousNode<nodes.TextNode>(nodes.isText);
  }

  /**
   * Get the parent of the current node
   */
  parent<T extends nodes.RParentNodeT>(): T | null {
    return <T>this.root.parent;
  }

  /**
   * Get the parent of the node that matches the given selection pattern
   * @param pattern:  the pattern for selecting the node
   * @param recursive: flag to determine if search is to be done recursively
   */
  findParent<T extends nodes.RParentNodeT>(
    pattern: SelectFilterT,
    recursive = true
  ): T | null {
    const n: nodes.RNodeT | null = this.find(pattern, recursive);
    if (n) {
      return <T>n.parent;
    }
    return null;
  }

  /**
   * Get all ancestor nodes of the current node
   */
  ancestors<T extends nodes.RParentNodeT>(): T[] {
    const anc: T[] = [];
    let parent = this.root.parent;
    while (parent) {
      anc.push(<T>parent);
      parent = parent.parent;
    }
    return anc;
  }

  /**
   * Find the ancestors of the node that matches the given selection pattern
   * @param pattern:  the pattern for selecting the node
   * @param recursive: flag to determine if search is to be done recursively
   */
  findAncestors<T extends nodes.RParentNodeT>(
    pattern: SelectFilterT,
    recursive = true
  ): T[] {
    const n: nodes.RNodeT | null = this.find(pattern, recursive);
    if (!n) return [];
    // swap root
    const root: nodes.RNodeT = this.root;
    this.root = n;
    // get ancestors
    const anc: T[] = this.ancestors<T>();
    // reset root to original node
    this.root = root;
    return anc;
  }

  /**
   * Get all descendant nodes of the current node - only applicable to element/root node
   */
  descendants<T extends nodes.RNodeT>(): T[] {
    const desc: T[] = [];
    if (!nodes.isParent(this.root)) return desc;
    // eslint-disable-next-line  @typescript-eslint/no-unused-vars
    this.traverseAllRecursive(this.root, (_: nodes.RNodeT) => true, desc);
    desc.shift(); // remove this.root from the selection
    return desc;
  }

  /**
   * Find the descendants of the node that matches the given selection pattern
   * @param pattern:  the pattern for selecting the node
   * @param recursive: flag to determine if search is to be done recursively
   */
  findDescendants<T extends nodes.RNodeT>(
    pattern: SelectFilterT,
    recursive = true
  ): T[] {
    const n: nodes.RNodeT | null = this.find(pattern, recursive);
    if (!n) return [];
    // swap root
    const root: nodes.RNodeT = this.root;
    this.root = n;
    // get descendants
    const desc: T[] = this.descendants<T>();
    // reset root to original node
    this.root = root;
    return desc;
  }

  /**
   * Get the next sibling node of the current node in document order
   */
  nextSibling<T extends nodes.RNodeT>(): T | null {
    const parent = <nodes.RParentNodeT>this.root.parent;
    if (!parent) return null;
    const index = this.root.index + 1;
    return <T>(index < parent.children.length ? parent.children[index] : null);
  }

  /**
   * Get the previous sibling node of the current node in document order
   */
  previousSibling<T extends nodes.RNodeT>(): T | null {
    const parent = <nodes.RParentNodeT>this.root.parent;
    if (!parent) return null;
    const index = this.root.index - 1;
    return <T>(index >= 0 ? parent.children[index] : null);
  }

  /**
   * Find the next sibling of the node that matches the given selection pattern
   * in document order
   * @param pattern:  the pattern for selecting the node
   * @param recursive: flag to determine if search is to be done recursively
   */
  findNextSibling<T extends nodes.RNodeT>(
    pattern: SelectFilterT,
    recursive = true
  ): T | null {
    const n: nodes.RNodeT | null = this.find(pattern, recursive);
    if (!n) return null;
    // swap root
    const root: nodes.RNodeT = this.root;
    this.root = n;
    // get next sibling
    const next: T | null = this.nextSibling<T>();
    // reset root to original node
    this.root = root;
    return next;
  }

  /**
   * Find the previous sibling of the node that matches the given selection pattern
   * in document order
   * @param pattern:  the pattern for selecting the node
   * @param recursive: flag to determine if search is to be done recursively
   */
  findPreviousSibling<T extends nodes.RNodeT>(
    pattern: SelectFilterT,
    recursive = true
  ): nodes.RNodeT | null {
    const n: nodes.RNodeT | null = this.find(pattern, recursive);
    if (!n) return null;
    // swap root
    const root: nodes.RNodeT = this.root;
    this.root = n;
    // get previous sibling
    const next: T | null = this.previousSibling<T>();
    // reset root to original node
    this.root = root;
    return next;
  }

  /**
   * Get all siblings (- before and after -) of the current node
   */
  siblings<T extends nodes.RNodeT>(): T[] {
    if (!this.root.parent) return [];
    const children = <T[]>(
      (<nodes.RParentNodeT>this.root.parent).children.slice()
    );
    children.splice(this.root.index, 1);
    return children;
  }

  /**
   * Get all siblings of the node that matches the given selection pattern
   * @param pattern:  the pattern for selecting the node
   * @param recursive: flag to determine if search is to be done recursively
   */
  findSiblings<T extends nodes.RNodeT>(
    pattern: SelectFilterT,
    recursive = true
  ): T[] {
    const n: nodes.RNodeT | null = this.find(pattern, recursive);
    if (!n) return [];
    // swap root
    const root: nodes.RNodeT = this.root;
    this.root = n;
    // get siblings
    const siblings = this.siblings<T>();
    // reset root to original node
    this.root = root;
    return siblings;
  }

  /**
   * Get the attribute with the provided key from the (element)
   * node that matches the given selection pattern
   * @param pattern:  the pattern for selecting the node
   * @param key: the attribute key or name
   * @param recursive: flag to determine if search is to be done recursively
   */
  findAttribute(
    pattern: SelectFilterT,
    key: AttributeKey,
    recursive = true
  ): nodes.AttributeNode | null {
    const n: nodes.RNodeT | null = this.find(pattern, recursive);
    if (!n || !nodes.isElement(n)) return null;
    const attr: nodes.AttributeNode | undefined = n.getAttributeNode(key);
    if (!attr) return null;
    return attr;
  }

  /**
   * Get all attributes from the (element) node that matches the
   * given selection pattern
   * @param pattern:  the pattern for selecting the node
   * @param recursive: flag to determine if search is to be done recursively
   */
  findAttributes(
    pattern: SelectFilterT,
    recursive = true
  ): nodes.AttributeNode[] {
    const n: nodes.RNodeT | null = this.find(pattern, recursive);
    if (!n || !nodes.isElement(n)) return [];
    return Array.from<nodes.AttributeNode>(n.attributes.values());
  }

  /**
   * Extract all comments from the current node
   * @param recursive: flag to determine if extraction is to be done recursively
   */
  extractComments(recursive = true): nodes.CommentNode[] {
    const comments: nodes.CommentNode[] = [];
    const cb: nodes.FilterFn = (n: nodes.RNodeT) => nodes.isComment(n);
    recursive
      ? this.traverseAllRecursive(this.root, cb, comments)
      : this.traverseAllLinear(this.root, cb, comments);
    return comments;
  }

  /**
   * Extract all texts from the current node
   * @param recursive: flag to determine if extraction is to be done recursively
   */
  extractTexts(recursive = true): nodes.TextNode[] {
    const texts: nodes.TextNode[] = [];
    const cb: nodes.FilterFn = (n: nodes.RNodeT) => {
      if (!nodes.isText(n)) return false;
      const parent = n.parent;
      if (nodes.isRoot(parent)) return true;
      if (parent.mode !== "HTML") return true;
      return !ExcludedHTMLElementTexts.includes(parent.name.qname);
    };
    recursive
      ? this.traverseAllRecursive(this.root, cb, texts)
      : this.traverseAllLinear(this.root, cb, texts);
    return texts;
  }

  /**
   * Obtain all comments (values) in the current node concatenated into
   * a single string
   * @param concat: the concatenation string if available
   * @param recursive: flag to determine if extraction is to be done recursively
   */
  comment(concat?: string, recursive = true): string {
    return this.extractComments(recursive)
      .map((n: nodes.CommentNode) => n.stringValue())
      .join(concat || "\n");
  }

  /**
   * Obtain all texts in the current node concatenated into a single string
   * @param concat: the concatenation string if available
   * @param recursive: flag to determine if extraction is to be done recursively
   */
  text(concat?: string, recursive = true): string {
    return this.extractTexts(recursive)
      .map((n: nodes.TextNode) => n.stringValue())
      .join(concat || "");
  }

  /**
   * Insert a given node before the current node in document order
   * @param node: the node to insert
   */
  insertBefore(node: nodes.RNodeT): boolean {
    const parent: nodes.RParentNodeT | null = this.parent();
    if (!parent) return false;
    const index = this.root.index;
    parent.children.splice(index, 0, node);
    this.updateIndexes(parent.children, index);
    this.updateParentFields(parent, node);
    return true;
  }

  /**
   * Insert a given node after the current node in document order
   * @param node: the node to insert
   */
  insertAfter(node: nodes.RNodeT): boolean {
    const parent: nodes.RParentNodeT | null = this.parent();
    if (!parent) return false;
    const index = this.root.index + 1;
    parent.children.splice(index, 0, node);
    this.updateIndexes(parent.children, index);
    this.updateParentFields(parent, node);
    return true;
  }

  /**
   * Set the name of the current node - provided it's an element
   * @param lName: local name
   * @param pName: prefix name if available
   */
  setElementName(lName: string, pName?: string): boolean {
    if (!nodes.isElement(this.root)) return false;
    this.root.name = this.createName(lName, pName);
    return true;
  }

  /**
   * Add a namespace to the current node - provided it's an element
   * @param namespace: the namespace to be added
   */
  addNamespace(namespace: nodes.NamespaceNode): boolean {
    if (!nodes.isElement(this.root)) return false;
    this.root.namespaces.push(namespace);
    this.updateParentFields(this.root, namespace);
    return true;
  }

  /**
   * Set the namespace of the current node - provided it's an element/attribute
   * @param namespace: the namespace node
   */
  setNamespace(namespace: nodes.NamespaceNode): boolean {
    if (nodes.isElement(this.root)) {
      this.root.namespace = namespace;
      this.setElementName(this.root.name.lname, namespace.prefix);
      this.root.isNamespaced = true;
    } else if (nodes.isAttribute(this.root)) {
      this.root.namespace = namespace;
      this.root.name = this.createName(this.root.name.lname, namespace.prefix);
    } else {
      return false;
    }
    return true;
  }

  /**
   * Add an attribute to the current node - provided it's an element
   * @param attribute: the attribute to be added
   */
  addAttribute(attribute: nodes.AttributeNode): boolean {
    if (!nodes.isElement(this.root)) return false;
    this.root.attributes.set(attribute.name.qname, attribute);
    this.updateParentFields(this.root, attribute);
    return true;
  }

  /**
   * Set the name of the current node if it's a root node
   * @param name
   */
  setRootNodeName(name: string): boolean {
    if (!nodes.isRoot(this.root)) return false;
    this.root.name = name;
    return true;
  }

  /**
   * Set the root element of the current node - provided it's a root node
   * @param node: root element
   */
  setRootElement(node: nodes.ElementNode): boolean {
    if (!nodes.isRoot(this.root)) return false;
    this.root.rootElement = node;
    return true;
  }

  /**
   * Add a child node to the current node - provided the current
   * node is a parent
   * @param node: the child to be added
   */
  addChild(node: nodes.RNodeT): boolean {
    if (!nodes.isParent(this.root) || nodes.isRoot(node)) return false;
    switch (node._type) {
      case nodes.RNodeType.Attribute:
        return this.addAttribute(node);
      case nodes.RNodeType.Namespace:
        return this.addNamespace(node as nodes.NamespaceNode);
      default:
        if (nodes.isElement(this.root)) {
          this.root.children.push(node);
          this.updateIndexes(this.root.children, this.root.children.length - 1);
          this.updateParentFields(this.root, node);
          return true;
        } else {
          if (nodes.isElement(node)) {
            if (!this.root.rootElement) return false;
            this.root.rootElement.children.push(node);
            this.updateIndexes(
              this.root.rootElement.children,
              this.root.rootElement.children.length - 1
            );
            this.updateParentFields(this.root.rootElement, node);
            return true;
          }
          this.root.children.push(node);
          this.updateIndexes(this.root.children, this.root.children.length - 1);
          this.updateParentFields(this.root, node);
          return true;
        }
    }
  }

  /**
   * Create an element node given its local name and an optional
   * namespace prefix name
   * @param lName: local name
   * @param pName: prefix name
   */
  createElement(lName: string, pName?: string): nodes.ElementNode {
    return new nodes.ElementNode(this.createName(lName, pName));
  }

  /**
   * Create a text node with `value` as its string-value
   * @param value
   */
  createText(value: string): nodes.TextNode {
    return new nodes.TextNode(value);
  }

  /**
   * Create a comment node with `value` as its string-value
   * @param value
   */
  createComment(value: string): nodes.CommentNode {
    return new nodes.CommentNode(value);
  }

  /**
   * Create an attribute node
   * @param value: the attribute value
   * @param lName: the attribute local name
   * @param pName: the attribute namespace prefix name if available
   */
  createAttribute(
    value: string,
    lName: string,
    pName?: string
  ): nodes.AttributeNode {
    const name = this.createName(lName, pName);
    return new nodes.AttributeNode(name, value);
  }

  createNamespace(prefix: string, uri: string): nodes.NamespaceNode {
    return new nodes.NamespaceNode(prefix, uri);
  }

  /**
   * Create a root node
   * @param name: the root node's name
   */
  createRoot(name: string): nodes.RootNode {
    return new nodes.RootNode(name);
  }

  /**
   * Create a processing instruction node
   * @param target: processing instruction target
   * @param value: processing instruction string-value
   */
  createPI(target: string, value: string): nodes.PINode {
    return new nodes.PINode(target, value);
  }

  /**
   * Drop the current node from its parent - given that the current node
   * is not an attribute or namespace node
   */
  drop(): boolean {
    return this.dropNode(this.root);
  }

  /**
   * Drop the child node that matches the search filter, from the
   * current node - parent element/root node
   * @param filter: the selection criteria/filter function
   * @param recursive: flag to determine if extraction is to be done recursively
   */
  dropChild(filter: nodes.FilterFn, recursive?: boolean): boolean {
    let child: nodes.RNodeT | null;
    if (recursive) {
      child = this.traverseRecursive(this.root, filter);
    } else {
      child = this.traverseLinear(this.root, filter);
    }
    if (!child) return false;
    return this.dropNode(child);
  }

  /**
   * Drop the child nodes matching the search filter, from the
   * current node - parent element/root node
   * @param filter: the selection criteria/filter function
   * @param recursive: flag to determine if extraction is to be done recursively
   */
  dropChildren(filter: nodes.FilterFn, recursive?: boolean): boolean {
    const children: nodes.RNodeT[] = [];
    if (recursive) {
      this.traverseAllRecursive(this.root, filter, children);
    } else {
      this.traverseAllLinear(this.root, filter, children);
    }
    if (!children.length) return false;
    children.forEach((child: nodes.RNodeT) => this.dropNode(child));
    return true;
  }

  /**
   * Drop the current attribute from the parent element
   * @param name: the attribute name/key
   */
  dropAttribute(name: AttributeKey): boolean {
    if (!nodes.isElement(this.root)) return false;
    const attr: nodes.AttributeNode | undefined =
      this.root.getAttributeNode(name);
    if (!attr) return false;
    this.root.attributes.delete(name);
    this.updateParentFieldsD(this.root, attr);
    return true;
  }
}
