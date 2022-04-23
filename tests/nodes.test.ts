import { XmlParser, HtmlParser } from "../src/parser";
import { XmlLexer, HtmlLexer } from "../src/lexer";
import {
  isNamespace,
  isAttribute,
  isText,
  isPI,
  isElement,
  isComment,
  isRoot,
  isParent,
  NamespaceNode,
  RootNode,
  ElementNode,
  TextNode,
  AttributeNode,
  PINode,
  CommentNode,
  DTDNode,
  XMLDeclNode,
} from "../src";

describe("ElementNode tests", () => {
  test("regular methods should work correctly", () => {
    let src = "<good x='bar'>some data</good>";
    let lexer = new XmlLexer(src);
    let parser = new XmlParser(lexer);
    let root: RootNode = parser.parse();
    let elem: ElementNode = root.rootElement!;
    expect(elem.expandedName()).toBe("good");
    expect(elem.position()).toBe(0);
    expect(elem.stringValue()).toBe("some data");
    expect(elem.numberValue()).toBeNaN();
    expect(elem.hasAttributeNode("x")).toBe(true);
    expect(elem.hasAttributeNode("j")).toBe(false);
    expect(elem.getAttributeNode("j")).toBeUndefined();
    expect(elem.getAttributeNode("x")).not.toBeNull();
    expect(() => elem.id()).not.toThrow();
    expect(isElement(elem)).toBe(true);
    expect(isParent(elem)).toBe(true);
    // namespaced expanded name
    src = "<f:good x='bar' xmlns:f='the-uri'>some data</f:good>";
    lexer = new XmlLexer(src);
    parser = new XmlParser(lexer);
    root = parser.parse();
    elem = root.rootElement!;
    expect(elem.expandedName()).toBe("the-uri:good");
  });

  test(".clone() should clone", () => {
    const lexer = new XmlLexer("<good x='bar'>some data</good>");
    const parser = new XmlParser(lexer);
    const root: RootNode = parser.parse();
    const elem: ElementNode = root.rootElement!;
    const cloned = elem.clone();
    expect(cloned.name).toBe(elem.name);
    expect(cloned.parent).toBe(elem.parent);
    expect(cloned.hasChild).toBe(elem.hasChild);
    expect(cloned.hasText).toBe(elem.hasText);
    expect(cloned.hasAttribute).toBe(elem.hasAttribute);
    expect(cloned.hasComment).toBe(elem.hasComment);
    expect(cloned.isSelfEnclosing).toBe(elem.isSelfEnclosing);
    expect(cloned.isNamespaced).toBe(elem.isNamespaced);
    expect(cloned.isVoid).toBe(elem.isVoid);
    expect(cloned.children).toBe(elem.children);
    expect(cloned.namespace).toBe(elem.namespace);
    expect(cloned.attributes).toBe(elem.attributes);
    expect(cloned.namespaces).toBe(elem.namespaces);
    expect(cloned.index).toBe(elem.index);
    expect(cloned.position()).toBe(elem.position());
    expect(cloned.id()).toBe(elem.id());
  });
});

describe("TextNode tests", () => {
  test("regular methods should work correctly", () => {
    jest.spyOn(console, "warn").mockImplementation();
    const src = "<![CDATA[some data]]>";
    let lexer = new XmlLexer(src);
    let parser = new XmlParser(lexer);
    let root: RootNode = parser.parse();
    let text = <TextNode>root.children[0];
    expect(text.expandedName()).toBe("");
    expect(text.position()).toBe(0);
    expect(text.stringValue()).toBe("some data");
    expect(text.numberValue()).toBeNaN();
    expect(text.isCData).toBe(true);
    expect(text.hasEntity).toBe(false);
    expect(text.prettify()).toBe(src);
    expect(isText(text)).toBe(true);
    text.value = "0xff";
    expect(text.numberValue()).toBe(0xff);
    text.value = "> ok there's no need";
    // hasEntity is only computed once, during parsing
    expect(text.hasEntity).toBe(false);
    // hasEntity
    lexer = new XmlLexer("<![CDATA[some <> data]]>");
    parser = new XmlParser(lexer);
    root = parser.parse();
    text = <TextNode>root.children[0];
    expect(text.hasEntity).toBe(true);
    expect(() => text.id()).not.toThrow();
  });
});

describe("AttributeNode tests", () => {
  test("regular methods should work correctly", () => {
    let lexer = new XmlLexer("<good x='bar'>some data</good>");
    let parser = new XmlParser(lexer);
    let root: RootNode = parser.parse();
    let attr: AttributeNode = root.rootElement!.getAttributeNode("x")!;
    expect(attr.expandedName()).toBe("x");
    expect(attr.position()).toBe(1);
    expect(attr.stringValue()).toBe("bar");
    expect(attr.numberValue()).toBeNaN();
    expect(attr.prettify()).toBe(`x="bar"`);
    expect(isAttribute(attr)).toBe(true);
    attr.value = "1234";
    expect(attr.numberValue()).toBe(1234);
    attr.value = "";
    expect(attr.numberValue()).toBeNaN();
    // hasEntity
    lexer = new XmlLexer("<good f:x='bar' xmlns:f='some-uri'>some data</good>");
    parser = new XmlParser(lexer);
    root = parser.parse();
    attr = root.rootElement!.getAttributeNode("f:x")!;
    expect(attr.expandedName()).toBe("some-uri:x");
    expect(() => attr.id()).not.toThrow();
  });
});

describe("NamespaceNode tests", () => {
  test("regular methods should work correctly", () => {
    let lexer = new XmlLexer("<good xmlns:x='bar'>some data</good>");
    let parser = new XmlParser(lexer);
    let root: RootNode = parser.parse();
    let ns: NamespaceNode = root.rootElement!.namespaces[0];
    expect(ns.expandedName()).toBe("x");
    expect(ns.position()).toBe(1);
    expect(ns.isDefault).toBe(false);
    expect(ns.stringValue()).toBe("bar");
    expect(ns.numberValue()).toBeNaN();
    expect(ns.prettify()).toBe(`xmlns:x="bar"`);
    ns.prefix = "xmlns";
    expect(isNamespace(ns)).toBe(true);
    expect(ns.expandedName()).toBe("");
    expect(() => ns.id()).not.toThrow();
    // default ns
    lexer = new XmlLexer("<good xmlns='bar'>some data</good>");
    parser = new XmlParser(lexer);
    root = parser.parse();
    ns = root.rootElement!.namespaces[0];
    expect(ns.expandedName()).toBe("");
    expect(ns.position()).toBe(1);
    expect(ns.isDefault).toBe(true);
    expect(ns.stringValue()).toBe("bar");
    expect(ns.prettify()).toBe(`xmlns="bar"`);
  });
});

describe("CommentNode tests", () => {
  test("regular methods should work correctly", () => {
    const src = "<!--a good comment-->";
    const lexer = new HtmlLexer(src);
    const parser = new HtmlParser(lexer);
    const root: RootNode = parser.parse();
    const comm = <CommentNode>root.children[0];
    expect(comm.expandedName()).toBe("");
    expect(comm.position()).toBe(0);
    expect(comm.stringValue()).toBe("a good comment");
    expect(comm.numberValue()).toBeNaN();
    expect(comm.prettify()).toBe(src);
    expect(isComment(comm)).toBe(true);
    expect(() => comm.id()).not.toThrow();
    comm.value = "-1231";
    expect(comm.numberValue()).toBe(-1231);
    comm.value = "";
    expect(comm.numberValue()).toBeNaN();
  });
});

describe("PINode tests", () => {
  test("regular methods should work correctly", () => {
    const src = "<?rabbit  some  foxes ?>";
    const lexer = new XmlLexer(src);
    const parser = new XmlParser(lexer);
    const root: RootNode = parser.parse();
    const pi = <PINode>root.children[0];
    expect(pi.expandedName()).toBe("rabbit");
    expect(pi.target).toBe("rabbit");
    expect(pi.position()).toBe(0);
    expect(pi.stringValue()).toBe("  some  foxes ");
    expect(pi.numberValue()).toBeNaN();
    expect(pi.prettify()).toBe(src);
    expect(() => pi.id()).not.toThrow();
    expect(isPI(pi)).toBe(true);
    pi.value = "-1231";
    expect(pi.numberValue()).toBe(-1231);
    pi.value = "";
    expect(pi.numberValue()).toBeNaN();
  });
});

describe("RootNode tests", () => {
  test("regular methods should work correctly", () => {
    let lexer = new XmlLexer("<p>some data</p> some bad text");
    let parser = new XmlParser(lexer);
    let root: RootNode = parser.parse();
    expect(root.expandedName()).toBe("");
    expect(root.isWellFormed).toBe(false);
    expect(root.position()).toBe(-1);
    expect(root.xmlDecl).toBeNull();
    expect(root.dtdDecl).toBeNull();
    expect(root.stringValue()).toBe("some data some bad text");
    expect(root.numberValue()).toBeNaN();
    expect(root.prettify()).toBe("<p>\n  some data\n</p>\nsome bad text");
    expect(() => root.id()).not.toThrow();
    expect(isRoot(root)).toBe(true);
    expect(isParent(root)).toBe(true);
    //
    lexer = new XmlLexer(
      `<?xml version="1.0" encoding="utf-8"?><!DOCTYPE tools>`
    );
    parser = new XmlParser(lexer);
    root = parser.parse();
    expect(root.xmlDecl).not.toBeNull();
    expect(root.dtdDecl).not.toBeNull();
    lexer = new XmlLexer(`<![CDATA[bad]]><xmlF:xmlFoo xmlns:xmlF='fox'/>`);
    parser = new XmlParser(lexer);
    root = parser.parse();
    expect(root.isWellFormed).toBe(false);
    lexer = new XmlLexer(`<p>some text</p>`);
    parser = new XmlParser(lexer);
    root = parser.parse();
    expect(root.isWellFormed).toBe(true);
  });
});

describe("DTDNode tests", () => {
  test("regular methods should work correctly", () => {
    let src = `<!DOCTYPE TVSCHEDULE [
<!ELEMENT TVSCHEDULE (CHANNEL+)>
<!ELEMENT CHANNEL (BANNER,DAY+)>
<!ELEMENT BANNER (#PCDATA)>
<!ELEMENT DAY (DATE,(HOLIDAY|PROGRAMSLOT+)+)>
<!ELEMENT HOLIDAY (#PCDATA)>
<!ELEMENT DATE (#PCDATA)>
<!ELEMENT PROGRAMSLOT (TIME,TITLE,DESCRIPTION?)>
<!ELEMENT TIME (#PCDATA)>
<!ELEMENT TITLE (#PCDATA)> 
<!ELEMENT DESCRIPTION (#PCDATA)>

<!ATTLIST TVSCHEDULE NAME CDATA #REQUIRED>
<!ATTLIST CHANNEL CHAN CDATA #REQUIRED>
<!ATTLIST PROGRAMSLOT VTR CDATA #IMPLIED>
<!ATTLIST TITLE RATING CDATA #IMPLIED>
<!ATTLIST TITLE LANGUAGE CDATA #IMPLIED>
]>`;
    // preserveDtdStructure - false by default
    let lexer = new XmlLexer(src);
    let parser = new XmlParser(lexer);
    let root: RootNode = parser.parse();
    let dtd = <DTDNode>root.dtdDecl!.node;
    expect(dtd.expandedName()).toBe("");
    expect(dtd.position()).toBe(0);
    expect(dtd.stringValue().length).toBe(10);
    expect(dtd.numberValue()).toBeNaN();
    expect(dtd.prettify()).toBe("<!DOCTYPE TVSCHEDULE>");
    expect(() => dtd.id()).not.toThrow();
    // preserveDtdStructure - true
    lexer = new XmlLexer(src, { preserveDtdStructure: true });
    parser = new XmlParser(lexer);
    root = parser.parse();
    dtd = <DTDNode>root.dtdDecl!.node;
    expect(dtd.expandedName()).toBe("");
    expect(dtd.position()).toBe(0);
    expect(dtd.stringValue().length).toBeGreaterThan(10);
    expect(dtd.numberValue()).toBeNaN();
    expect(() => dtd.id()).not.toThrow();
    // another test
    src = `<!DOCTYPE CATALOG [
<!ENTITY AUTHOR "John Doe">
<!ENTITY COMPANY "JD Power Tools, Inc.">
<!ENTITY EMAIL "jd@jd-tools.com">

<!ELEMENT CATALOG (PRODUCT+)>

<!ELEMENT PRODUCT
(SPECIFICATIONS+,OPTIONS?,PRICE+,NOTES?)>
<!ATTLIST PRODUCT
NAME CDATA #IMPLIED
CATEGORY (HandTool|Table|Shop-Professional) "HandTool"
PARTNUM CDATA #IMPLIED
PLANT (Pittsburgh|Milwaukee|Chicago) "Chicago"
INVENTORY (InStock|Backordered|Discontinued) "InStock">

<!ELEMENT SPECIFICATIONS (#PCDATA)>
<!ATTLIST SPECIFICATIONS
WEIGHT CDATA #IMPLIED
POWER CDATA #IMPLIED>

<!ELEMENT OPTIONS (#PCDATA)>
<!ATTLIST OPTIONS
FINISH (Metal|Polished|Matte) "Matte"
ADAPTER (Included|Optional|NotApplicable) "Included"
CASE (HardShell|Soft|NotApplicable) "HardShell">

<!ELEMENT PRICE (#PCDATA)>
<!ATTLIST PRICE
MSRP CDATA #IMPLIED
WHOLESALE CDATA #IMPLIED
STREET CDATA #IMPLIED
SHIPPING CDATA #IMPLIED>

<!ELEMENT NOTES (#PCDATA)>

]>`;
    lexer = new XmlLexer(src);
    parser = new XmlParser(lexer);
    root = parser.parse();
    dtd = <DTDNode>root.dtdDecl!.node;
    expect(dtd.position()).toBe(0);
    expect(dtd.stringValue().length).toBe(7);
    expect(dtd.numberValue()).toBeNaN();
    expect(dtd.prettify()).toBe("<!DOCTYPE CATALOG>");

    src = `<!DOCTYPE NEWSPAPER [
<!ELEMENT NEWSPAPER (ARTICLE+)>
<!ELEMENT ARTICLE (HEADLINE,BYLINE,LEAD,BODY,NOTES)>
<!ELEMENT HEADLINE (#PCDATA)>
<!ELEMENT BYLINE (#PCDATA)>
<!ELEMENT LEAD (#PCDATA)>
<!ELEMENT BODY (#PCDATA)>
<!ELEMENT NOTES (#PCDATA)>

<!ATTLIST ARTICLE AUTHOR CDATA #REQUIRED>
<!ATTLIST ARTICLE EDITOR CDATA #IMPLIED>
<!ATTLIST ARTICLE DATE CDATA #IMPLIED>
<!ATTLIST ARTICLE EDITION CDATA #IMPLIED>

<!ENTITY NEWSPAPER "Vervet Logic Times">
<!ENTITY PUBLISHER "Vervet Logic Press">
<!ENTITY COPYRIGHT "Copyright 1998 Vervet Logic Press">
]>`;
    lexer = new XmlLexer(src);
    parser = new XmlParser(lexer);
    root = parser.parse();
    dtd = <DTDNode>root.dtdDecl!.node;
    expect(dtd.position()).toBe(0);
    expect(dtd.stringValue().length).toBe(9);
    expect(dtd.numberValue()).toBeNaN();
    expect(dtd.prettify()).toBe("<!DOCTYPE NEWSPAPER>");

    src = `<!DOCTYPE CATALOG [
<!ELEMENT CATALOG (PRODUCT+)>
<!ELEMENT PRODUCT (SPECIFICATIONS+, OPTIONS?, PRICE+, NOTES?)>
<!ELEMENT SPECIFICATIONS (#PCDATA)>
<!ELEMENT OPTIONS (#PCDATA)>
<!ELEMENT PRICE (#PCDATA)>
<!ELEMENT NOTES (#PCDATA)>
<!ATTLIST PRODUCT NAME CDATA #IMPLIED>
<!ATTLIST
CATEGORY (HandTool | Table | Shop-Professional) "HandTool">
<!ATTLIST
PARTNUM CDATA #IMPLIED>
<!ATTLIST
PLANT (Pittsburgh | Milwaukee | Chicago) "Chicago">
<!ATTLIST
INVENTORY (InStock | Backordered | Discontinued) "InStock">
<!ATTLIST SPECIFICATIONS WEIGHT CDATA #IMPLIED>
<!ATTLIST
POWER CDATA #IMPLIED>
<!ATTLIST OPTIONS FINISH (Metal | Polished | Matte) "Matte">
<!ATTLIST OPTIONS
ADAPTER (Included | Optional | NotApplicable) "Included">
<!ATTLIST OPTIONS
CASE (HardShell | Soft | NotApplicable) "HardShell">
<!ATTLIST PRICE MSRP CDATA #IMPLIED>
<!ATTLIST PRICE
WHOLESALE CDATA #IMPLIED>
<!ATTLIST PRICE
STREET CDATA #IMPLIED>
<!ATTLIST PRICE
SHIPPING CDATA #IMPLIED>



<!ENTITY AUTHOR "John Doe">
<!ENTITY COMPANY "JD Power Tools, Inc.">
<!ENTITY EMAIL "jd@jd-tools.com">
]>`;
    lexer = new XmlLexer(src);
    parser = new XmlParser(lexer);
    root = parser.parse();
    dtd = <DTDNode>root.dtdDecl!.node;
    expect(dtd.prettify()).toBe("<!DOCTYPE CATALOG>");
  });
});

describe("XMLDeclNode tests", () => {
  test("regular methods should work correctly", () => {
    const src = "<?xml version='1.0' encoding='utf-8'?>";
    const lexer = new XmlLexer(src);
    const parser = new XmlParser(lexer);
    const root: RootNode = parser.parse();
    const dtd = <XMLDeclNode>root.xmlDecl!.node;
    expect(dtd.expandedName()).toBe("");
    expect(dtd.position()).toBe(0);
    expect(dtd.stringValue()).toBe("");
    expect(dtd.numberValue()).toBeNaN();
    expect(dtd.prettify()).toBe(`<?xml version="1.0" encoding="utf-8"?>`);
    expect(() => dtd.id()).not.toThrow();
  });
});
