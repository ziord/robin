import { NamespaceScopeTable, XmlParser, HtmlParser } from "../src/parser";
import { XmlLexer, HtmlLexer } from "../src/lexer";
import { NamespaceNode, RootNode, ElementNode } from "../src";
import { Scope } from "../src/utils";

declare function loadData(filename?: string): string;

describe("NamespaceScopeTable tests", () => {
  test("insert should work", () => {
    const table = new NamespaceScopeTable();
    const ns1 = new NamespaceNode("xyz", "some uri");
    const ns2 = new NamespaceNode("abc", "some uri");
    expect(table.insert(ns1.prefix, ns1)).toBe(true);
    expect(table.insert(ns2.prefix, ns2)).toBe(true);
    expect(table.insert(ns1.prefix, ns1)).toBe(false);
    expect(table.insert(ns2.prefix, ns2)).toBe(false);
    expect(table.insert("123", ns1)).toBe(true);
  });

  test("lookup should work", () => {
    const table = new NamespaceScopeTable();
    const ns1 = new NamespaceNode("xyz", "some uri");
    const ns2 = new NamespaceNode("abc", "some uri");
    table.insert(ns1.prefix, ns1);
    table.insert(ns2.prefix, ns2);
    expect(table.lookup(ns1.prefix)).toBe(ns1);
    expect(table.lookup(ns2.prefix)).toBe(ns2);
    expect(table.lookup("123")).toBeUndefined();
    expect(table.lookup("abcxyz")).toBeUndefined();
  });

  test("backtrackScope should work", () => {
    const table = new NamespaceScopeTable();
    const enclosing: Scope<string, NamespaceNode> = {
      symbols: new Map<string, NamespaceNode>(),
      enclosingScope: null,
    };
    expect(table.backtrackScope()).toBeUndefined();
    table.disable();
    expect(table.backtrackScope()).toBeUndefined();
    expect(table.table.enclosingScope).toBeNull();
    table.table.enclosingScope = enclosing;
    // disable prevents backtracking
    table.disable();
    table.backtrackScope();
    expect(table.table).not.toBe(enclosing);
    // backtracking moves `table` pointer to `enclosingScope`
    table.disabled = false; // clear `disabled` state
    table.backtrackScope();
    expect(table.table).toBe(enclosing);
  });

  test("newScope should work", () => {
    const table = new NamespaceScopeTable();
    let scope: Scope<string, NamespaceNode> = table.table;
    table.newScope();
    expect(table.table).not.toBe(scope);
    scope = table.table;
    table.disable();
    table.newScope(); // disable prevents newScope
    expect(table.table).toBe(scope);
  });
});

describe("XmlParser tests", () => {
  // test configs
  const spy: jest.SpyInstance = jest
    .spyOn(console, "warn")
    .mockImplementation();
  jest.spyOn(console, "error").mockImplementation();
  test("parse - showWarnings", () => {
    spy.mockClear();
    let lexer = new XmlLexer("<![CDATA[test]]> <t:xml></t:xml!");
    let parser = new XmlParser(lexer);
    expect(() => parser.parse()).toThrow();
    expect(spy).toHaveBeenCalled(); // warnings would be shown by default
    // do not show warnings
    spy.mockClear();
    lexer = new XmlLexer("<![CDATA[test]]> <bad><-bad!");
    parser = new XmlParser(lexer, { showWarnings: false });
    expect(() => parser.parse()).toThrow();
    expect(spy).not.toHaveBeenCalled();
  });

  test("parse - documentName", () => {
    const src = "<good> some data </good>";
    let lexer = new XmlLexer(src);
    let parser = new XmlParser(lexer, { documentName: "Robin" });
    let root: RootNode = parser.parse();
    expect(root.name).toBe("Robin");
    // non-defaults
    lexer = new XmlLexer(src);
    parser = new XmlParser(lexer);
    root = parser.parse();
    expect(root.name).toBe("Document");
  });

  test("parse - allowMissingNamespaces", () => {
    let src = "<t:good t:x='bar'> some data </t:good>";
    let lexer = new XmlLexer(src);
    let parser = new XmlParser(lexer);
    expect(() => parser.parse()).toThrow();
    // defaults
    lexer = new XmlLexer(src);
    parser = new XmlParser(lexer, { allowMissingNamespaces: true });
    expect(() => parser.parse()).not.toThrow();
    // namespaced attributes only
    src = "<good t:x='bar' p:y='foo'> some data </good>";
    lexer = new XmlLexer(src);
    parser = new XmlParser(lexer);
    expect(() => parser.parse()).toThrow();
    // defaults
    lexer = new XmlLexer(src);
    parser = new XmlParser(lexer, { allowMissingNamespaces: true });
    expect(() => parser.parse()).not.toThrow();
  });

  test("parse - allowDefaultNamespaceBindings", () => {
    const src = "<good xmlns='http://www.w3.org/1999/xhtml'> some data </good>";
    let lexer = new XmlLexer(src);
    let parser = new XmlParser(lexer);
    let root: RootNode = parser.parse();
    let elem: ElementNode = root.rootElement!;
    expect(elem.namespace).not.toBeNull();
    expect(elem.isNamespaced).toBe(true);
    expect(elem.namespaces.length).toBe(1);
    // non-defaults
    lexer = new XmlLexer(src);
    parser = new XmlParser(lexer, { allowDefaultNamespaceBindings: false });
    root = parser.parse();
    elem = root.rootElement!;
    expect(elem.namespace).toBeNull();
    expect(elem.isNamespaced).toBe(false);
    expect(elem.namespaces.length).toBe(1);
  });

  test("parse - ensureUniqueNamespacedAttributes", () => {
    // attribute name (expanded-name) not unique
    const src =
      "<good xmlns:a='some uri' xmlns:b='some uri' a:name='Jerry' b:name='Perry' />";
    let lexer = new XmlLexer(src);
    let parser = new XmlParser(lexer);
    expect(() => parser.parse()).toThrow();
    // non-defaults
    lexer = new XmlLexer(src);
    parser = new XmlParser(lexer, { ensureUniqueNamespacedAttributes: false });
    expect(() => parser.parse()).not.toThrow();
  });

  test("bad markup should error", () => {
    let lexer = new XmlLexer("<bad></good>");
    let parser = new XmlParser(lexer);
    expect(() => parser.parse()).toThrow();
    lexer = new XmlLexer("<bad></bad!");
    parser = new XmlParser(lexer);
    expect(() => parser.parse()).toThrow();
    // 'xml' in local name
    spy.mockClear();
    lexer = new XmlLexer("<bad:xmLpot></bad:xmLpot>");
    parser = new XmlParser(lexer);
    expect(() => parser.parse()).toThrow();
    expect(spy).toHaveBeenCalled();
    // 'xml' in prefix
    spy.mockClear();
    lexer = new XmlLexer("<xmlBad:xmLpot></xmlBad:xmLpot>");
    parser = new XmlParser(lexer);
    expect(() => parser.parse()).toThrow();
    expect(spy).toHaveBeenCalled();
    // regular namespace
    spy.mockClear();
    lexer = new XmlLexer("<f:p xmlns:f='fox'>bean</f:p>");
    parser = new XmlParser(lexer);
    expect(() => parser.parse()).not.toThrow();
    expect(spy).not.toHaveBeenCalled();
    // 'xmlns' in element name
    lexer = new XmlLexer("<xmlns:p xmlns:f='fox'>bean</xmlns:p>");
    parser = new XmlParser(lexer);
    expect(() => parser.parse()).toThrow();
    // prefix un-declaring should error - i.e. prefixed namespace with empty uri
    lexer = new XmlLexer('<p xmlns:f=""></p>');
    parser = new XmlParser(lexer);
    expect(() => parser.parse()).toThrow();
    // xml prefix bound to another uri
    lexer = new XmlLexer('<p xmlns:xml="this is bad"></p>');
    parser = new XmlParser(lexer);
    expect(() => parser.parse()).toThrow();
    // xml uri as default namespace
    lexer = new XmlLexer(
      `<p xmlns="http://www.w3.org/XML/1998/namespace"></p>`
    );
    parser = new XmlParser(lexer);
    expect(() => parser.parse()).toThrow();
    // xmlns uri as default namespace
    lexer = new XmlLexer(`<p xmlns="http://www.w3.org/2000/xmlns/"></p>`);
    parser = new XmlParser(lexer);
    expect(() => parser.parse()).toThrow();
    // another prefix bound to xml uri
    lexer = new XmlLexer(
      `<p xmlns:rex="http://www.w3.org/XML/1998/namespace"></p>`
    );
    parser = new XmlParser(lexer);
    expect(() => parser.parse()).toThrow();
    // xmlns as namespace prefix
    lexer = new XmlLexer(`<p xmlns:xmlns="this is so bad"></p>`);
    parser = new XmlParser(lexer);
    expect(() => parser.parse()).toThrow();
    // another prefix bound to xmlns uri
    lexer = new XmlLexer(`<p xmlns:tig="http://www.w3.org/2000/xmlns/"></p>`);
    parser = new XmlParser(lexer);
    expect(() => parser.parse()).toThrow();
    // duplicate namespaces
    lexer = new XmlLexer(`<p xmlns:p="foo" xmlns:p="bar"></p>`);
    parser = new XmlParser(lexer);
    expect(() => parser.parse()).toThrow();
    // bad comment
    lexer = new XmlLexer(`<!--fox`);
    parser = new XmlParser(lexer);
    expect(() => parser.parse()).toThrow();
    // bad xml header
    lexer = new XmlLexer(`<?xml xmlns:bad="so bad"?>`);
    parser = new XmlParser(lexer);
    expect(() => parser.parse()).toThrow();
    // multiple root elements
    lexer = new XmlLexer(`<p/><p/>`);
    parser = new XmlParser(lexer);
    expect(() => parser.parse()).toThrow();
    // bad processing instruction
    lexer = new XmlLexer(`<?121212?>`);
    parser = new XmlParser(lexer);
    expect(() => parser.parse()).toThrow();
    // unexpected eof
    lexer = new XmlLexer(`<?pi`);
    parser = new XmlParser(lexer);
    expect(() => parser.parse()).toThrow();
  });
});

describe("HtmlParser tests", () => {
  test("bad markup should error", () => {
    // mismatch
    let lexer = new HtmlLexer("<bad></good>");
    let parser = new HtmlParser(lexer);
    expect(() => parser.parse()).toThrow();
    // mismatch
    lexer = new HtmlLexer(
      "<script>for (let e of []) console.log('blah blah');</spcript>"
    );
    parser = new HtmlParser(lexer);
    expect(() => parser.parse()).toThrow();
    // okay
    lexer = new HtmlLexer(
      "<script>for (let e of []) console.log('blah blah');</script>"
    );
    parser = new HtmlParser(lexer);
    expect(() => parser.parse()).not.toThrow();
    // not okay - uri isn't xhtml uri
    lexer = new HtmlLexer("<p xmlns='some random uri'/>");
    parser = new HtmlParser(lexer);
    expect(() => parser.parse()).toThrow();
  });

  test("partial markup should be tolerated", () => {
    // okay
    let lexer = new HtmlLexer("<p xmlns='http://www.w3.org/1999/xhtml'/>");
    let parser = new HtmlParser(lexer);
    expect(() => parser.parse()).not.toThrow();
    // okay
    lexer = new HtmlLexer("<p true a=5/>");
    parser = new HtmlParser(lexer);
    expect(() => parser.parse()).not.toThrow();
  });
});
