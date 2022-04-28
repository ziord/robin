import {
  DOM,
  ElementNode,
  TextNode,
  AttributeNode,
  RNodeT,
  Robin,
  RootNode,
  RParentNodeT,
  XNodeSet,
  XPath,
} from "../src";

declare function loadData(filename?: string): string;

let data: string = loadData();
let robin = new Robin(data);
let root: RootNode = robin.getRoot();

beforeEach(() => {
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  // state is shared across all tests, so this needs to be recreated.
  // if robin.getRoot() is also used across tests here, we'd have to pass
  // 'data' to the Robin constructor for re-initialization.
  robin = new Robin();
});

describe("general expectations tests", () => {
  test("init path with non root node", () => {
    const element: ElementNode = root.rootElement!;
    // allowCopy must be specified when running xpath on a non RootNode (Document node) object
    expect(() => robin.path(element)).toThrow();
    // use a different root node. query() returns an XDataCType (number | string | boolean | XNodeSet)
    let nodeset = <XNodeSet<RootNode>>robin.path(element, true).query(".");
    expect(nodeset.size).toBe(1);
    let contextNode = Array.from<RNodeT>(nodeset)[0];
    // a virtual RootNode object is created for a non-RootNode object used in path
    expect(contextNode).toBeInstanceOf(RootNode);
    expect(contextNode).not.toBe(root);
    expect(contextNode).not.toBe(element);
    // we should get the root since it's an actual RootNode
    nodeset = <XNodeSet<RootNode>>robin.path(root, true).query(".");
    expect(nodeset.size).toBe(1);
    expect(Array.from(nodeset)[0]).toBe(root);
    // we can decide not to use allowCopy, this means that the element would not be cloned,
    // its root node ancestor/parent would be sought out automatically so long as it can be found
    expect(element.parent).toBe(root);
    nodeset = <XNodeSet<RootNode>>robin.path(element, false).query(".");
    expect(nodeset.size).toBe(1);
    contextNode = Array.from(nodeset)[0];
    expect(contextNode).toBeInstanceOf(RootNode);
    expect(contextNode).toBe(root);
    expect(element.parent).toBe(contextNode);
    // when we can't reach the RootNode from the element, it should throw
    const d = new DOM();
    const elem = d.createElement("parent");
    elem.parent = <RParentNodeT>new DOM().createElement("sample"); // use a fake parent
    expect(() => robin.path(elem, false)).toThrow();
  });

  test("expressions should be evaluable", () => {
    const path: XPath = robin.path(root);
    expect(path.query("2 * 3 - 6")).toEqual(0);
    expect(path.query("2 * 3 - 6 + 4 mod 5 div --2")).toBe(2);
    expect(path.query("2 and 0")).toBe(false);
    expect(path.query("2 or 0")).toBe(true);
    expect(path.query("2 >= 1")).toBe(true);
    expect(path.query("'2' > 1")).toBe(true);
    expect(path.query("10 <= 5")).toBe(false);
    expect(path.query("10 = 5")).toBe(false);
    expect(path.query("'fish' != 'fan'")).toBe(true);
    expect(path.query("number('10')")).toEqual(10);
    expect(path.queryAll("'10' < '5'")).toEqual([false]);
    expect(path.query(". div 0")).toBeNaN();
    expect(path.queryAll(". div 0")).toEqual([NaN]);
  });

  test("invalid expressions should error", () => {
    const path: XPath = robin.path(root);
    expect(() => path.query("'10' | '5'")).toThrow();
    expect(() => path.query("'10' ! '5'")).toThrow();
    expect(() => path.query("//*[)")).toThrow();
    expect(() => path.query("//*[fish::fox])")).toThrow();
    expect(() => path.query("//*[number(.,])")).toThrow();
    expect(() => path.query("//*[number(.)]/(.)")).toThrow();
    expect(() => path.query("//*[]")).toThrow();
    expect(() => path.query('//*[string-length(")]')).toThrow(); // less arguments
    expect(() => path.query("fox()")).toThrow(); // invalid function
    expect(() => path.query("count(., .)")).toThrow(); // too many arguments
    expect(() => path.query("count(.,)")).toThrow(); // trailing comma
    expect(() => path.query("count()")).toThrow(); // wrong arg count
    expect(() => path.query("position(")).toThrow(); // missing ')'
    expect(() => path.query("0xacebage")).toThrow(); // bad hex
    expect(() => path.query("f:x(:)")).toThrow(); // unclosed comment
    expect(() => path.query("'this is...")).toThrow(); // unclosed string
    expect(() => path.query("..234")).toThrow(); // invalid expression
    expect(() => path.query("2.2.34")).toThrow(); // invalid number
    expect(() => path.queryOne("(2 * 3)/*")).toThrow(); // bad expression
    expect(() => path.queryOne("('fox')/*")).toThrow(); // bad expression
    expect(() => path.queryOne("/*/('fox')/*")).toThrow(); // bad expression
  });

  test("newline in xpath expression should be parsed properly", () => {
    expect(() => robin.path(root).query("//*\n[1 - - 2\r\n]")).not.toThrow();
  });

  test("comments in xpath expression should be parsed properly", () => {
    expect(() =>
      robin
        .path(root)
        .query("//*[1(:this is a fancy (:::nested!:) comment:)- - 0x0aceface2]")
    ).not.toThrow();
    expect(() => robin.path(root).query("1 + 3 (:::) (::)")).not.toThrow();
  });

  test("numbers in xpath expression should be parsed properly", () => {
    expect(() =>
      robin
        .path(root)
        .query(".2345 + 0xff + - 1234.56 * 125e-2 div 12E+6 mod 1.35e3")
    ).not.toThrow();
  });
});

describe("stress tests", () => {
  test("perform expressive selections", () => {
    const data = loadData("sample.html");
    const robin = new Robin(data, "HTML");
    const path: XPath = robin.path(robin.getRoot());
    let nodeset = <XNodeSet<ElementNode>>path.query("//*[. >= 123]");
    expect(nodeset.size).toBe(1);
    const elem = Array.from(nodeset)[0];
    expect(elem.name.qname).toBe("p");
    expect(elem.numberValue()).toBe(123);
    expect(elem.stringValue()).toBe("123");
    let value = <number>path.query("count(//@node()[. > 2])");
    expect(value).toBe(3);
    // <div id="1" data-method="xml">xml parsing</div>
    value = <number>path.query("count(//*[string-length(.) = 11])");
    expect(value).toBe(1);
  });

  test("find an element by path", () => {
    let nodeset = <XNodeSet<RNodeT>>(
      robin.path(root).query("//tool[@node()=2][1]")
    );
    expect(nodeset.size).toEqual(1);
    let elem = <ElementNode>Array.from(nodeset)[0];
    expect(elem.name.qname).toBe("tool");
    expect(elem.hasAttributeNode("id")).toBe(true);
    expect(elem.getAttributeNode("id")!.value).toBe("2");

    nodeset = <XNodeSet>robin.path(root).query("(//tool[@id=2])[1]");
    expect(nodeset.size).toEqual(1);
    expect(<ElementNode>Array.from(nodeset)[0]).toBe(elem);

    // check how many elements contains 'parsing' starting from the root node
    nodeset = <XNodeSet>robin.path(root).query("//*[contains(., 'parsing')]");
    expect(nodeset.size).toEqual(3);

    // check how many elements contains 'parsing' starting from the root element
    nodeset = <XNodeSet>robin.path(root).query("*//*[contains(., 'parsing')]");
    expect(nodeset.size).toEqual(2);

    nodeset = <XNodeSet>robin.path(root).query("/");
    expect(nodeset.size).toEqual(1);
    expect(Array.from(nodeset)[0]).toBeInstanceOf(RootNode);
  });

  test("numerical computations", () => {
    const path: XPath = robin.path(root);
    expect(path.query("2.1e5 mod 0xff div 310 * 6")).toEqual(
      2.6129032258064515
    );
    expect(path.query("0.111111115 * 2 - + 1.2222222222 + 1.33333333")).toEqual(
      0.33333333779999996
    );
    expect(path.query("0.111111115 < 2 > 1.2222222222 <= 1.33333333")).toBe(
      true
    );
    expect(
      path.query("0.111111115 <= 3.142 >= 1.2222222222 > 1.33333333")
    ).toBe(false);
    expect(path.query("1 div 'fox'")).toBeNaN();
    expect(path.query("10 mod 'bar'")).toBeNaN();
    expect(path.query("10 mod 'bar' > NaN")).toBe(false);
    expect(path.query("10 div 0")).toBe(Infinity);
    expect(path.query("10 div -0")).toBe(-Infinity);
    expect(path.query("'3' - '-3.4'")).toBe(6.4);
    expect(path.query("'fox' = 'fox'")).toBe(true);
    expect(path.queryOne("'fox' = ((((((((('fox')))))))))")).toBe(true);
    expect(path.queryOne("'0xff' div -(((((((((number('0xff'))))))))))")).toBe(
      -1
    );
    expect(
      path.queryOne("'0xff' div (2 - 5) -(((((((((number('0xff'))))))))))")
    ).toBe(-340);
  });

  test("predicate tests", () => {
    const path: XPath = robin.path(root);
    expect(path.queryOne<ElementNode>("*[1][1][1][1][2-1]")).toBe(
      root.rootElement
    );
    expect(path.queryOne<number>("count(//*[..])")).toBe(9);
    expect(path.queryOne<number>("count(//node()[not(.) and .])")).toBe(0);
    expect(() => path.queryOne<ElementNode>("(2)[1]")).toThrow();
  });

  test("keyword name tests", () => {
    const path: XPath = robin.path(root);
    expect(() => path.queryOne("/text/comment/*")).not.toThrow();
    expect(() => path.queryOne("/and/*")).not.toThrow();
    expect(() => path.queryOne("/or/div/*")).not.toThrow();
    expect(() => path.queryOne("node/or/div/node")).not.toThrow();
    expect(() => path.queryOne("/mod/*/processing-instruction")).not.toThrow();
  });

  test("node tests", () => {
    const path: XPath = robin.path(root);
    // comparators
    // nodeset x nodeset
    expect(path.queryOne(". | .")).toBe(root);
    expect(path.queryOne("//*[//. > .]")).toBeNull();
    expect(path.queryOne<ElementNode>("//*[. >= .]")!.name.qname).toBe("bar");
    expect(path.queryOne("//*[//. < .]")).toBeNull();
    expect(path.queryOne<ElementNode>("//*[//. >= .]")!.name.qname).toBe("bar");
    expect(path.queryOne<ElementNode>("//*[//. <= .]")!.name.qname).toBe("bar");
    expect(path.queryOne<ElementNode>("//*[//. = .]")!.name.qname).toBe(
      "tools"
    );
    expect(path.queryOne<ElementNode>("//*[//. != .]")!.name.qname).toBe(
      "tools"
    );
    // nodeset x string | string x nodeset
    expect(path.queryOne("//*[//. > '12']")).toBeTruthy();
    expect(path.queryOne("//*['12' > //.]")).toBeNull();
    expect(path.queryOne<ElementNode>("//*['12' >= .]")).toBeNull();
    expect(path.queryOne("//*[//. < 'string']")).toBeNull();
    expect(path.queryOne("//*['string' < .]")).toBeNull();
    expect(
      path.queryOne<ElementNode>("//*[//. >= '10']")!.name.qname
    ).not.toBeNull();
    expect(path.queryOne<ElementNode>("//*['fox' <= .]")).toBeNull();
    expect(path.queryOne<ElementNode>("//*[//. = '0xff']")).toBeNull();
    expect(path.queryOne<ElementNode>("//*['0xace' = .]")).toBeNull();
    expect(path.queryOne<ElementNode>("//*['0xace' != .]")).toBeTruthy();
    expect(
      path.queryOne<ElementNode>("//*[//. > '0xff' or . < ('0xff' div 2)]")!
        .name.qname
    ).toBe("bar");
    expect(
      path.queryOne<ElementNode>("//*[//. != 'parsing']")!.name.qname
    ).toBe("tools");
    // nodeset x number | number x nodeset
    expect(path.queryOne("//*[//. > 12]")).toBeTruthy();
    expect(path.queryOne<ElementNode>("//*[12 >= .]")).toBeNull();
    expect(path.queryOne("//*[//. < -0xdeadbeef]")).toBeNull();
    expect(path.queryOne("//*[0xff < .]")).toBeNull();
    expect(
      path.queryOne<ElementNode>("//*[//. >= 10]")!.name.qname
    ).not.toBeNull();
    expect(path.queryOne<ElementNode>("//*[123 <= .]")!.name.qname).toBe("bar");
    expect(path.queryOne<ElementNode>("//*[//. = 0xff]")).toBeNull();
    expect(path.queryOne<ElementNode>("//*[0xff = .]")).toBeNull();
    expect(
      path.queryOne<ElementNode>("//*[//. > 0xff or . < (0xff div 2)]")!.name
        .qname
    ).toBe("bar");
    expect(path.queryOne<ElementNode>("//*[//. != 120]")!.name.qname).toBe(
      "tools"
    );
    expect(path.queryOne<ElementNode>("//*[120 != .]")!.name.qname).toBe(
      "tools"
    );
    // nodeset x boolean | boolean x nodeset
    expect(path.queryOne("//*[//. > boolean(12)]")).toBeNull();
    expect(path.queryOne<ElementNode>("//*[boolean(12) >= .]")).toBeNull();
    expect(path.queryOne("//*[//. < false()]")).toBeNull();
    expect(path.queryOne<ElementNode>("//*[//. >= true()]")).toBeNull();
    expect(path.queryOne<ElementNode>("//*[true() >= //.]")).toBeNull();
    expect(path.queryOne<ElementNode>("//*[true() > //.]")).toBeNull();
    expect(path.queryOne<ElementNode>("//*[false() < .]")).toBeTruthy();
    expect(path.queryOne<ElementNode>("//*[false() <= .]")!.name.qname).toBe(
      "bar"
    );
    expect(path.queryOne<ElementNode>("//*[//. = true()]")).toBeTruthy();
    expect(path.queryOne<ElementNode>("//*[false() = .]")).toBeNull();
    expect(path.queryOne<ElementNode>("//*[true() != .]")).toBeNull();
    expect(path.queryOne<ElementNode>("//*[true() = false()]")).toBeNull();
    expect(
      path.queryOne<ElementNode>("//*[//. > true() or . < (0xff div 2)]")!.name
        .qname
    ).toBe("bar");
    expect(path.queryOne<ElementNode>("//*[//. != boolean(120)]")).toBeNull();
  });
});

describe("axis tests", () => {
  test("ancestor axis", () => {
    // begin
    let anc = robin.path(root).queryAll<ElementNode>("ancestor::node()");
    expect(anc.length).toBe(0);
    anc = robin.path(root).queryAll("ancestor::*");
    expect(anc.length).toBe(0);
    // middle
    anc = robin.path(root).queryAll("*/*/ancestor::*");
    expect(anc.length).toBe(1);
    // predicate
    anc = robin.path(root).queryAll("*/*[./ancestor::*]");
    expect(anc.length).toBe(5);
    expect(anc.map((n: ElementNode) => n.name.qname)).toEqual([
      "tool",
      "tool",
      "tool",
      "tool",
      "random",
    ]);
    expect(robin.path(root).queryOne<ElementNode>("ancestor::*")).toBeNull();
    expect(
      robin.path(root).queryOne<ElementNode>("ancestor::node()")
    ).toBeNull();
    expect(robin.path(root).queryOne("*/ancestor::node()")).toBe(root);
  });

  test("ancestor-or-self axis", () => {
    // begin
    let anc: RNodeT[] = robin.path(root).queryAll("ancestor-or-self::node()");
    expect(anc.length).toBe(1);
    expect(anc[0]).toBe(root);
    anc = robin.path(root).queryAll("ancestor-or-self::*");
    expect(anc.length).toBe(0);
    // middle
    anc = robin.path(root).queryAll("*/*/ancestor-or-self::*");
    expect(anc.length).toBe(6);
    // predicate
    anc = robin.path(root).queryAll("*/*[./ancestor-or-self::*]");
    expect(anc.length).toBe(5);
    expect(anc.map((n: RNodeT) => (<ElementNode>n).name.qname)).toEqual([
      "tool",
      "tool",
      "tool",
      "tool",
      "random",
    ]);
    expect(
      robin.path(root).queryOne<ElementNode>("ancestor-or-self::*")
    ).toBeNull();
    expect(
      robin.path(root).queryOne<ElementNode>("ancestor-or-self::node()")
    ).toBe(root);
    expect(
      robin.path(root).queryOne<ElementNode>("/ancestor-or-self::node()")
    ).toBe(root);
    anc = robin.path(root).queryAll("*/ancestor-or-self::node()");
    expect(anc.length).toBe(2);
    expect(anc[0]).toBe(root);
    expect(anc[1]).toBe(root.rootElement);
  });

  test("attribute axis", () => {
    // begin
    let arr: RNodeT[] = robin.path(root).queryAll("attribute::node()");
    expect(arr.length).toBe(0);
    arr = robin.path(root).queryAll("attribute::*");
    expect(arr.length).toBe(0);
    arr = robin.path(root).queryAll("*//@id");
    expect(arr.length).toBe(5);
    arr = robin.path(root).queryAll("*//@unknown");
    expect(arr.length).toBe(0);
    // middle
    arr = robin.path(root).queryAll<AttributeNode>("*/*/attribute::*");
    expect(arr.length).toBe(10);
    // predicate
    arr = robin.path(root).queryAll("*//@*[position() > 2]");
    expect(arr.length).toBe(0);
    arr = robin.path(root).queryAll("./*/..//@id[position() > 2]");
    expect(arr.length).toBe(0);
    arr = robin
      .path(root)
      .queryAll<ElementNode>("*/*[./attribute::id mod 2 = 1]");
    expect(arr.length).toBe(3);
    expect(arr.map((n: RNodeT) => (<ElementNode>n).name.qname)).toEqual([
      "tool",
      "tool",
      "random",
    ]);
  });

  test("child axis", () => {
    // begin
    const rootElem = robin.path(root).queryOne<ElementNode>("*");
    expect(rootElem).not.toBeNull();
    expect(rootElem).toBe(root.rootElement);
    let arr: RNodeT[] = robin.path(root).queryAll("child::node()");
    expect(arr.length).toBe(1);
    expect(arr[0]).toBe(rootElem);
    arr = robin.path(root).queryAll("child::*");
    expect(arr.length).toBe(1);
    expect(arr[0]).toBe(rootElem);
    arr = robin.path(root).queryAll("child::fox");
    expect(arr.length).toBe(0);
    arr = robin.path(root).queryAll("//child::a:fun");
    expect(arr.length).toBe(1);
    expect((arr[0] as ElementNode).name.qname).toBe("a:fun");
    expect(robin.path(root).queryAll("/child::node()")[0]).toBe(rootElem);
    let elem = robin.path(root).queryOne<ElementNode>("//child::xml:foo")!;
    expect(elem).not.toBeNull();
    expect(elem.name.qname).toBe("xml:foo");
    elem = robin.path(root).queryOne<ElementNode>("child::tools")!;
    expect(elem).not.toBeNull();
    expect(elem.name.qname).toBe("tools");
    // middle
    elem = robin.path(root).queryOne<ElementNode>("./*/*/child::*")!;
    expect(elem).not.toBeNull();
    expect(elem.name.qname).toBe("xml:foo");
    // predicate
    elem = robin.path(root).queryOne<ElementNode>("./*/*[child::*]")!;
    expect(elem).not.toBeNull();
    expect(elem.name.qname).toBe("random");
  });

  test("descendant axis", () => {
    // begin
    expect(robin.path(root).queryOne<number>("count(descendant::node())")).toBe(
      32
    );
    const arr: RNodeT[] = robin.path(root).queryAll("descendant::node()");
    expect(arr.length).toBe(32);
    expect(arr[0]).toBeInstanceOf(ElementNode);
    expect((<ElementNode>arr[0]).name.qname).toBe("tools");
    expect(arr[31]).toBeInstanceOf(TextNode);
    expect((<TextNode>arr[31]).value).toBe("\n");
    expect(robin.path(root).queryAll("descendant::node()")).toEqual(
      robin.path(root).queryAll("./descendant::node()")
    );
    expect(robin.path(root).queryOne<number>("count(descendant::*)")).toBe(9);
    expect(robin.path(root).queryOne<ElementNode>("/descendant::*")).toBe(
      root.rootElement
    );
    expect(robin.path(root).queryOne<ElementNode>("/descendant::node()")).toBe(
      root.rootElement
    );
    // middle
    const elem = robin
      .path(root)
      .queryOne<ElementNode>("./*/*/descendant::bar")!;
    expect(elem).not.toBeNull();
    expect(elem.name.qname).toBe("bar");
    // predicate
    const arr2 = robin
      .path(root)
      .queryAll<ElementNode>("./*/*[descendant::*]")!;
    expect(arr2.length).toBe(1);
    expect(arr2[0].name.qname).toBe("random");
  });

  test("descendant-or-self", () => {
    // begin
    expect(
      robin.path(root).queryOne<number>("count(descendant-or-self::node())")
    ).toBe(33);
    const arr: RNodeT[] = robin
      .path(root)
      .queryAll("((((descendant-or-self::node()))))");
    expect(arr.length).toBe(33);
    expect(arr[0]).toBeInstanceOf(RootNode);
    expect((<RootNode>arr[0]).name).toBe("Document");
    expect(arr[32]).toBeInstanceOf(TextNode);
    expect((<TextNode>arr[32]).value).toBe("\n");
    expect(robin.path(root).queryAll("descendant-or-self::node()")).toEqual(
      robin.path(root).queryAll("./descendant-or-self::node()")
    );
    expect(
      robin.path(root).queryOne<number>("count(descendant-or-self::*)")
    ).toBe(9);
    expect(
      robin.path(root).queryOne<ElementNode>("/descendant-or-self::*")
    ).toBe(root.rootElement);
    expect(
      robin.path(root).queryOne<ElementNode>("*/descendant-or-self::*")
    ).toBe(root.rootElement);
    expect(
      robin.path(root).queryOne<ElementNode>("/descendant-or-self::node()")
    ).toBe(root);
    // middle
    const elem = robin
      .path(root)
      .queryOne<ElementNode>("./*/*/descendant-or-self::bar")!;
    expect(elem).not.toBeNull();
    expect(elem.name.qname).toBe("bar");
    // predicate
    const arr2 = robin
      .path(root)
      .queryAll<ElementNode>("./*/*[descendant-or-self::*]")!;
    expect(arr2.length).toBe(5);
    expect(arr2[0].name.qname).toBe("tool");
    expect(arr2[4].name.qname).toBe("random");

    const elems = robin
      .path(root)
      .queryAll<ElementNode>("(./*/*/descendant-or-self::node())[1]/self::*")!;
    expect(elems.length).toBe(1);
    expect(elems[0].name.qname).toBe("tool");
    expect(elems[0].getAttributeNode("id")!.value).toBe("1");
  });

  test("following axis", () => {
    // begin
    let arr: RNodeT[] = robin.path(root).queryAll("following::node()");
    const nodes = ["tool", "tool", "tool", "random", "xml:foo", "bar", "a:fun"];
    expect(arr.length).toBe(0);
    expect(robin.path(root).queryOne("count(*/*/following::node())")).toBe(28);
    arr = robin.path(root).queryAll("*/*/following::*");
    expect(arr.length).toBe(7);
    expect(arr.map((n: RNodeT) => (<ElementNode>n).name.qname)).toEqual(nodes);
    expect(robin.path(root).queryAll("//@text()/following::*").length).toBe(0);
    expect(robin.path(root).queryAll("//@comment()/following::*").length).toBe(
      0
    );
    arr = robin.path(root).queryAll("//@id/following::*");
    expect(arr.length).toBe(7);
    expect(arr.map((n: RNodeT) => (<ElementNode>n).name.qname)).toEqual(nodes);
    // middle
    const elem = robin
      .path(root)
      .queryOne<ElementNode>("./*/*/following::bar")!;
    expect(elem).not.toBeNull();
    expect(elem.name.qname).toBe("bar");
    // predicate
    const arr2 = robin
      .path(root)
      .queryAll<ElementNode>("./*//*[following::*]")!;
    expect(arr2.length).toBe(6);
    expect(arr2.map((n: ElementNode) => n.name.qname)).toEqual([
      "tool",
      "tool",
      "tool",
      "tool",
      "xml:foo",
      "bar",
    ]);
  });

  test("following-sibling axis", () => {
    // begin
    let arr: RNodeT[] = robin.path(root).queryAll("following-sibling::node()");
    expect(arr.length).toBe(0);
    expect(
      robin.path(root).queryOne("count(*/*/following-sibling::node())")
    ).toBe(9);
    arr = robin.path(root).queryAll("*/*/following-sibling::*");
    expect(arr.length).toBe(4);
    expect(arr.map((n: RNodeT) => (<ElementNode>n).name.qname)).toEqual([
      "tool",
      "tool",
      "tool",
      "random",
    ]);
    // middle
    let elem = robin
      .path(root)
      .queryOne<ElementNode>("./*/*/following-sibling::bar")!;
    expect(elem).toBeNull();
    elem = robin
      .path(root)
      .queryOne<ElementNode>("./*/*/following-sibling::random")!;
    expect(elem.name.qname).toBe("random");
    // predicate
    const arr2 = robin
      .path(root)
      .queryAll<ElementNode>("./*/*[following-sibling::*]")!;
    expect(arr2.length).toBe(4);
    expect(arr2.every((n: ElementNode) => n.name.qname === "tool")).toBe(true);
  });

  test("parent axis", () => {
    // begin
    const rootElem = robin.path(root).queryOne<ElementNode>("*");
    expect(rootElem).not.toBeNull();
    expect(rootElem).toBe(root.rootElement);
    let arr: RNodeT[] = robin.path(root).queryAll("parent::node()");
    expect(arr.length).toBe(0);
    expect(robin.path(root).queryOne("parent::*")).toBeNull();
    expect(robin.path(root).queryOne("parent::node()")).toBeNull();
    expect(robin.path(root).queryOne("/parent::node()")).toBeNull();
    expect(robin.path(root).queryOne("*/parent::*")).toBeNull();
    expect(robin.path(root).queryOne("*/parent::node()")).not.toBeNull();

    arr = robin.path(root).queryAll("*/*/parent::*");
    expect(arr).toEqual(robin.path(root).queryAll("*/*/parent::tools"));
    expect(arr.length).toBe(1);
    expect(arr[0]).toBeInstanceOf(ElementNode);
    expect((<ElementNode>arr[0]).name.qname).toBe("tools");

    expect(robin.path(root).queryOne("count(//parent::*)")).toBe(9);
    arr = robin.path(root).queryAll("//parent::tool");
    expect(arr.length).toBe(4);
    expect(
      arr.every((n: RNodeT) => (n as ElementNode).name.qname === "tool")
    ).toBe(true);
    // middle
    arr = robin.path(root).queryAll<ElementNode>("./*/*/parent::*")!;
    expect(arr.length).toEqual(1);
    expect((<ElementNode>arr[0]).name.qname).toBe("tools");
    // predicate
    const elem = robin.path(root).queryOne<ElementNode>("./*/*[parent::*]")!;
    expect(elem).not.toBeNull();
    expect(elem.getAttributeNode("id")!.value).toBe("1");
  });

  test("preceding axis", () => {
    // begin
    let arr: RNodeT[] = robin.path(root).queryAll("preceding::node()");
    expect(arr.length).toBe(0);
    expect(robin.path(root).queryOne("count(*/*/preceding::node())")).toBe(13);

    const qs = ["*/*/preceding::*", "//@id/preceding::*"];
    const ids = ["1", "2", "3", "4"];
    for (let q of qs) {
      arr = robin.path(root).queryAll(q);
      expect(arr.length).toBe(4);
      expect(
        arr.map((n: RNodeT) => (<ElementNode>n).getAttributeNode("id")!.value)
      ).toEqual(ids);
    }
    // middle
    let elem = robin.path(root).queryOne<ElementNode>("./*/*/preceding::bar")!;
    expect(elem).toBeNull();
    elem = robin.path(root).queryOne<ElementNode>("./*/*//preceding::bar")!;
    expect(elem.name.qname).toBe("bar");
    expect(robin.path(root).queryOne<ElementNode>("preceding::*")).toBeNull();
    // predicate
    const arr2 = robin
      .path(root)
      .queryAll<ElementNode>("./*/*[.//preceding::comment()]")!;
    expect(arr2.length).toBe(1);
    expect(arr2[0].name.qname).toBe("random");
  });

  test("preceding-sibling axis", () => {
    // begin
    let arr: RNodeT[] = robin.path(root).queryAll("preceding-sibling::node()");
    expect(arr.length).toBe(0);
    expect(
      robin.path(root).queryOne("count(*/*/preceding-sibling::node())")
    ).toBe(9);
    arr = robin.path(root).queryAll("*/*/preceding-sibling::*");
    expect(arr.length).toBe(4);
    expect(
      arr.map((n: RNodeT) => (<ElementNode>n).getAttributeNode("id")!.value)
    ).toEqual(["1", "2", "3", "4"]);
    // middle
    let elem = robin
      .path(root)
      .queryOne<ElementNode>("./*/*/preceding-sibling::bar")!;
    expect(elem).toBeNull();
    expect(
      robin.path(root).queryOne<ElementNode>("preceding-sibling::tools")
    ).toBeNull();
    elem = robin
      .path(root)
      .queryOne<ElementNode>("./*/*/*/preceding-sibling::bar")!;
    expect(elem.name.qname).toBe("bar");
    // predicate
    let arr2 = robin
      .path(root)
      .queryAll<ElementNode>("./*/*[tools/*/preceding-sibling::*]")!;
    expect(arr2.length).toBe(0);
    arr2 = robin
      .path(root)
      .queryAll<ElementNode>("./*/*[tools/*//preceding-sibling::*]")!;
    expect(arr2.length).toBe(0);
  });

  test("self axis", () => {
    // begin
    const rootElem = robin.path(root).queryOne<ElementNode>("*");
    expect(rootElem).not.toBeNull();
    expect(rootElem).toBe(root.rootElement);
    let arr: ElementNode[] = robin
      .path(root)
      .queryAll<ElementNode>("parent::node()");
    expect(arr.length).toBe(0);
    expect(robin.path(root).queryOne("self::*")).toBeNull();
    expect(
      robin.path(root).queryOne<ElementNode>("*/self::*")!.name.qname
    ).toBe("tools");
    expect(robin.path(root).queryOne("/self::node()")).toBe(root);

    arr = robin.path(root).queryAll<ElementNode>("*/*/self::*");
    expect(arr.length).toBe(5);
    expect(arr[0].name.qname).toBe("tool");
    expect(arr[4].name.qname).toBe("random");

    expect(robin.path(root).queryOne("count(//self::*)")).toBe(9);
    expect(robin.path(root).queryOne<ElementNode>("*/self::tools")).toBe(
      root.rootElement
    );
    arr = robin.path(root).queryAll<ElementNode>("//self::tool");
    expect(arr.length).toBe(4);
    expect(arr.every((n: ElementNode) => n.name.qname === "tool")).toBe(true);
    // middle
    arr = robin
      .path(root)
      .queryAll<ElementNode>("./*/*/descendant-or-self::node()/self::*")!;
    expect(arr.length).toEqual(8);
    expect(arr.map((n: ElementNode) => n.name.qname)).toEqual([
      "tool",
      "tool",
      "tool",
      "tool",
      "random",
      "xml:foo",
      "bar",
      "a:fun",
    ]);
    expect(arr[0].name.qname).toBe("tool");
    // predicate
    const attrs = robin
      .path(root)
      .queryAll<AttributeNode>("*/*/@id/self::node() | /*/*/@id/self::*")!;
    expect(attrs.length).toBe(5);
    expect(attrs.map((a: AttributeNode) => a.value)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
    ]);
    expect(robin.path(root).queryOne<ElementNode>("self::tools")).toBeNull();
    expect(robin.path(root).queryOne<ElementNode>("self::node()")).toBe(root);
    let elems = robin
      .path(root) // (./*/*/descendant-or-self::node())[1]/self::*
      .queryAll<ElementNode>("(./*/*/descendant-or-self::node())/self::*")!;
    expect(elems.length).toBe(8);
    expect(robin.path(root).queryAll<ElementNode>("(./*)/*[1]")).toEqual(
      robin.path(root).queryAll<ElementNode>("./*/*[1]")
    );

    elems = robin
      .path(root)
      .queryAll<ElementNode>(
        "(./*/*/descendant-or-self::node())[./self::*][1]"
      )!;
    expect(elems.length).toBe(1);
    expect(elems[0].name.qname).toBe("tool");
    expect(elems[0].getAttributeNode("id")!.value).toBe("1");

    elems = robin
      .path(root)
      .queryAll<ElementNode>(
        "(./*/*/descendant-or-self::node())[./self::*]/self::node()[1]"
      )!;
    expect(elems.length).toBe(8);
    expect(elems[0].name.qname).toBe("tool");
    expect(elems[0].getAttributeNode("id")!.value).toBe("1");
    expect(elems[6].name.qname).toBe("bar");
    expect(elems[7].name.qname).toBe("a:fun");
  });
});

describe("core function tests", () => {
  describe("number functions", () => {
    test("number()", () => {
      const path: XPath = robin.path(root);
      expect(path.queryOne<number>("number()")).toBeNaN();
      expect(path.queryOne<number>("number(*[.])")).toBeNaN();
      expect(path.queryOne<number>("number(//bar)")).toBe(123);
      expect(path.queryOne<number>("number((//bar)[1])")).toBe(123);
      expect(path.queryOne<number>("number(string('1' + '2'))")).toBe(3);
      expect(path.queryOne<number>("number('3.142857142857143')")).toBe(
        3.142857142857143
      );
      expect(path.queryOne<number>("number('flawless possibility')")).toBeNaN();
    });

    test("sum()", () => {
      const path: XPath = robin.path(root);
      expect(path.queryOne<number>("sum(.)")).toBeNaN();
      expect(path.queryOne<number>("sum(*)")).toBeNaN();
      expect(path.queryOne<number>("sum(*[.])")).toBeNaN();
      expect(path.queryOne<number>("sum(//bar)")).toBe(123);
      expect(path.queryOne<number>("sum((//bar)[1])")).toBe(123);
      // sum only works with nodesets
      expect(() => path.queryOne("sum(string('1' + '2'))")).toThrow();
      expect(() => path.queryOne<number>("sum('3.142857142857143')")).toThrow();
      expect(() =>
        path.queryOne<number>("sum('flawless possibility')")
      ).toThrow();
    });

    test("floor()", () => {
      const path: XPath = robin.path(root);
      expect(path.queryOne<number>("floor('fan')")).toBeNaN();
      expect(path.queryOne<number>("floor(*[.])")).toBeNaN();
      expect(path.queryOne<number>("floor(//bar)")).toBe(123);
      expect(path.queryOne<number>("floor((//bar)[1])")).toBe(123);
      expect(path.queryOne<number>("floor(string('1' + '2'))")).toBe(3);
      expect(path.queryOne<number>("floor('3.142857142857143')")).toBe(3);
      expect(path.queryOne<number>("floor('13.1e-5')")).toBe(0);
      expect(path.queryOne<number>("floor('13.1E5')")).toBe(1310000);
      expect(path.queryOne<number>("floor('flawless possibility')")).toBeNaN();
    });

    test("ceiling()", () => {
      const path: XPath = robin.path(root);
      expect(path.queryOne<number>("ceiling('fan')")).toBeNaN();
      expect(path.queryOne<number>("ceiling(*[.])")).toBeNaN();
      expect(path.queryOne<number>("ceiling(//bar)")).toBe(123);
      expect(path.queryOne<number>("ceiling((//bar)[1])")).toBe(123);
      expect(path.queryOne<number>("ceiling(string('1' + '2'))")).toBe(3);
      expect(path.queryOne<number>("ceiling('3.142857142857143')")).toBe(4);
      expect(path.queryOne<number>("ceiling('13.1e-5')")).toBe(1);
      expect(path.queryOne<number>("ceiling('13.1E5')")).toBe(1310000);
      expect(
        path.queryOne<number>("ceiling('flawless possibility')")
      ).toBeNaN();
    });

    test("round()", () => {
      const path: XPath = robin.path(root);
      expect(path.queryOne<number>("round('fan')")).toBeNaN();
      expect(path.queryOne<number>("round(*[.])")).toBeNaN();
      expect(path.queryOne<number>("round(//bar)")).toBe(123);
      expect(path.queryOne<number>("round((//bar)[1])")).toBe(123);
      expect(path.queryOne<number>("round(string('1' + '2'))")).toBe(3);
      expect(path.queryOne<number>("round('3.142857142857143')")).toBe(3);
      expect(path.queryOne<number>("round('13.1e-5')")).toBe(0);
      expect(path.queryOne<number>("round('13.1E5')")).toBe(1310000);
      expect(path.queryOne<number>("round('flawless possibility')")).toBeNaN();
    });
  });

  describe("string functions", () => {
    test("string()", () => {
      const path: XPath = robin.path(root);
      expect(typeof path.queryOne<string>("string()")).toBe("string");
      expect(path.queryOne<string>("string(1 > 0)")).toBe("true");
      expect(path.queryOne<string>("string(0 > 0)")).toBe("false");
      expect(path.queryOne<string>("string(1 div 0)")).toBe("Infinity");
      expect(typeof path.queryOne<string>("string(.)")).toBe("string");
      expect(typeof path.queryOne<string>("string(*)")).toBe("string");
      expect(path.queryOne<string>("string(//bar)")).toBe("123");
      expect(path.queryOne<string>("string((//bar)[1])")).toBe("123");
      expect(
        path.queryOne<string>("string('1.000000000123' + '2.1111000000')")
      ).toBe("3.111100000123");
      expect(path.queryOne<string>("string('xyz' + 'abc')")).toBe("NaN");
      expect(path.queryOne<string>("string(3.142857142857143)")).toBe(
        "3.142857142857143"
      );
      expect(path.queryOne<string>("string(13.1e-5)")).toBe("0.000131");
      expect(path.queryOne<string>("string(13.1E5)")).toBe("1310000");
      expect(path.queryOne<string>("string('flawless possibility')")).toBe(
        "flawless possibility"
      );
    });

    test("concat()", () => {
      const path: XPath = robin.path(root);
      // concat is 2n-variadic
      expect(
        path.queryOne<string>("concat('xpath', '-engine', '-js', '-ts')")
      ).toBe("xpath-engine-js-ts");
      expect(path.queryOne<string>("concat(*, ., ..)")!.length).toBeGreaterThan(
        20
      );
      expect(path.queryOne<string>("concat(.., .., ..)")).toBe("");
      expect(
        path.queryOne<string>("concat(//bar, //bar[concat(., *, /)])")
      ).toBe("123123");
      expect(path.queryOne<string>("concat((//bar)[1], 54321)")).toBe(
        "12354321"
      );
      expect(
        path.queryOne<string>("concat('1.000000000123', '2.1111000000')")
      ).toBe("1.0000000001232.1111000000");
      expect(path.queryOne<string>("concat('xyz', 'abc')")).toBe("xyzabc");
      expect(
        path.queryOne<string>("concat(3.142857142857143, 'abc', 0xff)")
      ).toBe("3.142857142857143abc255");
      expect(path.queryOne<string>("concat(13.1e-5, 'foo', 'bar')")).toBe(
        "0.000131foobar"
      );
      expect(path.queryOne<string>("concat('flawless ', 'possibility')")).toBe(
        "flawless possibility"
      );
    });

    test("starts-with()", () => {
      const path: XPath = robin.path(root);
      expect(path.queryOne<boolean>("starts-with('xpath', 'engine')")).toBe(
        false
      );
      expect(path.queryOne<boolean>("starts-with(/, *)")).toBe(true);
      expect(path.queryOne<boolean>("starts-with(., tools/tool)")).toBe(false);
      expect(path.queryOne<boolean>("starts-with(., (tools/tool)[1])")).toBe(
        false
      );
      expect(
        path.queryOne<boolean>("starts-with((//comment())[1], '  ')")
      ).toBe(true);
      expect(
        path.queryOne<boolean>("starts-with((//comment())[2], 'ok')")
      ).toBe(true);
      expect(path.queryOne<boolean>("starts-with(., /)")).toBe(true);
      expect(path.queryOne<boolean>("starts-with(., .)")).toBe(true);
      expect(path.queryOne<boolean>("starts-with(*, *)")).toBe(true);
      expect(path.queryOne<boolean>("starts-with(//bar, '1')")).toBe(true);
      expect(
        path.queryOne<boolean>(
          "starts-with(//bar, //bar[starts-with('abc', 'a')])"
        )
      ).toBe(true);
      expect(path.queryOne<boolean>("starts-with((//bar)[1], 54321)")).toBe(
        false
      );
      expect(
        path.queryOne<boolean>("starts-with('1.000000000123', '2.1111000000')")
      ).toBe(false);
      expect(path.queryOne<boolean>("starts-with('xyz', 'abc')")).toBe(false);
      expect(path.queryOne<boolean>("starts-with('the truth', 'the ')")).toBe(
        true
      );
      expect(
        path.queryOne<boolean>("starts-with(3.142857142857143, '3.14')")
      ).toBe(true);
      expect(path.queryOne<boolean>("starts-with(13.1e-5, 'foo')")).toBe(false);
    });

    test("contains()", () => {
      const path: XPath = robin.path(root);
      expect(path.queryOne<boolean>("contains('xpath', 'engine')")).toBe(false);
      expect(path.queryOne<boolean>("contains(/, *)")).toBe(true);
      expect(path.queryOne<boolean>("contains(., tools/tool)")).toBe(true);
      expect(path.queryOne<boolean>("contains(., (tools/tool)[1])")).toBe(true);
      expect(path.queryOne<boolean>("contains((//comment())[1], '  ')")).toBe(
        true
      );
      expect(path.queryOne<boolean>("contains((//comment())[2], 'ok')")).toBe(
        true
      );
      expect(path.queryOne<boolean>("contains(., /)")).toBe(true);
      expect(path.queryOne<boolean>("contains(., .)")).toBe(true);
      expect(path.queryOne<boolean>("contains(*, *)")).toBe(true);
      expect(path.queryOne<boolean>("contains(//bar, '1')")).toBe(true);
      expect(
        path.queryOne<boolean>("contains(//bar, //bar[contains('abc', 'a')])")
      ).toBe(true);
      expect(path.queryOne<boolean>("contains((//bar)[1], 54321)")).toBe(false);
      expect(
        path.queryOne<boolean>("contains('1.000000000123', '2.1111000000')")
      ).toBe(false);
      expect(path.queryOne<boolean>("contains('xyz', 'abc')")).toBe(false);
      expect(path.queryOne<boolean>("contains('the truth', 'the ')")).toBe(
        true
      );
      expect(
        path.queryOne<boolean>("contains(3.142857142857143, '3.14')")
      ).toBe(true);
      expect(path.queryOne<boolean>("contains(13.1e-5, 'foo')")).toBe(false);
    });

    test("substring-before()", () => {
      const path: XPath = robin.path(root);
      expect(path.queryOne<string>('substring-before("1999/04/01","/")')).toBe(
        "1999"
      );
      expect(path.queryOne<string>("substring-before(/, *)")).toBe("");
      expect(
        path.queryOne<string>("substring-before(., tools/tool)")!.length
      ).toBeGreaterThan(1);
      expect(
        path.queryOne<string>("substring-before(., (tools/tool)[1])")!.length
      ).toBeGreaterThan(1);
      expect(
        path.queryOne<string>("substring-before((//comment())[1], 'foo')")
      ).toBe("        ");
      expect(
        path.queryOne<string>("substring-before((//comment())[2], 'ay')")
      ).toBe("ok");
      expect(path.queryOne<string>("substring-before(., /)")).toBe("");
      expect(path.queryOne<string>("substring-before(., .)")).toBe("");
      expect(path.queryOne<string>("substring-before(*, *)")).toBe("");
      expect(path.queryOne<string>("substring-before(//bar, '3')")).toBe("12");
      expect(path.queryOne<string>("substring-before((//bar)[1], 54321)")).toBe(
        ""
      );
      expect(
        path.queryOne<string>("substring-before('1.000000000123', '00123')")
      ).toBe("1.0000000");
      expect(path.queryOne<string>("substring-before('xyz', 'abc')")).toBe("");
      expect(
        path.queryOne<string>("substring-before('xyz-123-def', 'z-')")
      ).toBe("xy");
      expect(
        path.queryOne<string>("substring-before('the truth', 'truth')")
      ).toBe("the ");
      expect(
        path.queryOne<string>("substring-before(3.142857142857143, '.14')")
      ).toBe("3");
      expect(path.queryOne<string>("substring-before(13.1e-5, 'foo')")).toBe(
        ""
      );
      expect(
        path.queryOne<ElementNode>("//*[substring-before(13.1e-5, 'foo')]")
      ).toBeFalsy();
    });

    test("substring-after()", () => {
      const path: XPath = robin.path(root);
      expect(path.queryOne<string>('substring-after("1999/04/01","/")')).toBe(
        "04/01"
      );
      expect(path.queryOne<string>('substring-after("1999/04/01","19")')).toBe(
        "99/04/01"
      );
      expect(path.queryOne<string>("substring-after(/, *)")).toBe("");
      expect(
        path.queryOne<string>("substring-after(., tools/tool)")!.length
      ).toBeGreaterThan(1);
      expect(
        path.queryOne<string>("substring-after(., (tools/tool)[1])")!.length
      ).toBeGreaterThan(1);
      expect(
        path.queryOne<string>("substring-after((//comment())[1], 'foo')")
      ).toBe("");
      expect(
        path.queryOne<string>("substring-after((//comment())[2], 'ok')")
      ).toBe("ay");
      expect(path.queryOne<string>("substring-after(., /)")).toBe("");
      expect(path.queryOne<string>("substring-after(., .)")).toBe("");
      expect(path.queryOne<string>("substring-after(*, *)")).toBe("");
      expect(path.queryOne<string>("substring-after(//bar, '12')")).toBe("3");
      expect(path.queryOne<string>("substring-after((//bar)[1], 54321)")).toBe(
        ""
      );
      expect(
        path.queryOne<string>("substring-after('1.000000000123', '1.000')")
      ).toBe("000000123");
      expect(path.queryOne<string>("substring-after('xyz', 'abc')")).toBe("");
      expect(
        path.queryOne<string>("substring-after('xyz-123-def', 'z-')")
      ).toBe("123-def");
      expect(path.queryOne<string>("substring-after('the truth', 'the')")).toBe(
        " truth"
      );
      expect(
        path.queryOne<string>("substring-after(3.142857142857143, '.14')")
      ).toBe("2857142857143");
      expect(path.queryOne<string>("substring-after(13.1e-5, 'foo')")).toBe("");
      expect(
        path.queryOne<ElementNode>("//*[substring-after(13.1e-5, 'foo')]")
      ).toBeFalsy();
    });

    test("substring()", () => {
      const path: XPath = robin.path(root);
      expect(path.queryOne<string>('substring("12345",2,3)')).toBe("234");
      expect(path.queryOne<string>('substring("1999/04/01","/")')).toBe("");
      expect(path.queryOne<string>('substring("1999/04/01", 5)')).toBe(
        "/04/01"
      );
      expect(path.queryOne<string>("substring(\"1999/04/01\", 5, '2')")).toBe(
        "/0"
      );
      expect(path.queryOne<string>('substring("12345", 1.5, 2.6)')).toBe("234");
      expect(path.queryOne<string>('substring("12345", 0, 3)')).toBe("12");
      expect(path.queryOne<string>('substring("12345", 0 div 0, 3)')).toBe("");
      expect(path.queryOne<string>('substring("12345", 1, 0 div 0)')).toBe("");
      expect(path.queryOne<string>("substring(\"12345\", 1, 'x')")).toBe("");
      expect(path.queryOne<string>('substring("12345", -42, 1 div 0)')).toBe(
        "12345"
      );
      expect(
        path.queryOne<string>('substring("12345", -1 div 0, 1 div 0)')
      ).toBe("");
      expect(path.queryOne<string>("substring(/, *, 10)")).toBe("");
      expect(path.queryOne<string>("substring((//comment())[1], 10)")).toBe(
        "oo"
      );
      expect(path.queryOne<string>("substring((//comment())[2], 3, 5)")).toBe(
        "ay"
      );
      expect(path.queryOne<string>("substring(., /)")).toBe("");
      expect(path.queryOne<string>("substring(., .)")).toBe("");
      expect(path.queryOne<string>("substring(*, *)")).toBe("");
      expect(path.queryOne<string>("substring(//bar, '0', 3)")).toBe("12");
      expect(path.queryOne<string>("substring((//bar)[1], 54321)")).toBe("");
      expect(
        path.queryOne<string>("substring('1.000000000123', '1.000')")
      ).toBe("1.000000000123");
      expect(path.queryOne<string>("substring('xyz', 'abc')")).toBe("");
      expect(path.queryOne<string>("substring('xyz-123-def', 0.9, -3)")).toBe(
        ""
      );
      expect(path.queryOne<string>("substring('the truth', -3)")).toBe(
        "the truth"
      );
      expect(path.queryOne<string>("substring('the truth', -3, 3)")).toBe("");
      expect(path.queryOne<string>("substring(3.142857142857143, '.14')")).toBe(
        "3.142857142857143"
      );
      expect(path.queryOne<string>("substring(13.1e-5, 'foo')")).toBe("");
      expect(
        path.queryOne<ElementNode>("//*[substring(13.1e-5, 'foo')]")
      ).toBeFalsy();
    });

    test("string-length()", () => {
      const path: XPath = robin.path(root);
      expect(path.queryOne<number>("string-length()")).toBe(172);
      expect(path.queryOne<number>("string-length(.)")).toBe(172);
      expect(path.queryOne<number>("string-length(/)")).toBe(172);
      expect(path.queryOne<number>("string-length(*)")).toBe(172);
      expect(path.queryOne<number>("string-length(//bar)")).toBe(3);
      expect(path.queryOne<number>("string-length((//bar)[1])")).toBe(3);
      expect(
        path.queryOne<number>(
          "string-length('1.000000000123' + '2.1111000000')"
        )
      ).toBe(14);
      expect(path.queryOne<number>("string-length('xyz' + 'abc')")).toBe(3); // NaN
      expect(path.queryOne<number>("string-length(3.142857142857143)")).toBe(
        17
      );
      expect(path.queryOne<number>("string-length(13.1e-5)")).toBe(8);
      expect(path.queryOne<number>("string-length(13.1E5)")).toBe(7);
      expect(
        path.queryOne<number>("string-length('flawless possibility')")
      ).toBe(20);
      expect(
        path.queryOne<number>("count(//text()[string-length() > 15])")
      ).toBe(2);
    });

    test("normalize-space()", () => {
      const path: XPath = robin.path(root);
      expect(path.queryOne<string>("normalize-space('  fox  ')")).toBe("fox");
      expect(
        path.queryOne<string>("normalize-space()")!.startsWith("xml")
      ).toBe(true);
      expect(path.queryOne<string>("normalize-space(*)")!.startsWith(" ")).toBe(
        false
      );
      expect(path.queryOne<string>("normalize-space(//comment())")).toBe("foo");
      expect(path.queryOne<string>("normalize-space((//comment())[1])")).toBe(
        "foo"
      );
      expect(
        path.queryOne<string>("normalize-space('1.000000000123         ')")
      ).toBe("1.000000000123");
      expect(path.queryOne<string>("normalize-space('xyz   abc')")).toBe(
        "xyz abc"
      );
      expect(path.queryOne<string>("normalize-space(3.142857142857143)")).toBe(
        "3.142857142857143"
      );
      expect(path.queryOne<string>("normalize-space('some   string  ')")).toBe(
        "some string"
      );
      expect(path.queryOne<string>("normalize-space('   some  string')")).toBe(
        "some string"
      );
    });

    test("translate()", () => {
      const path: XPath = robin.path(root);
      expect(path.queryOne<string>(`translate("bar","abc","ABC")`)).toBe("BAr");
      expect(path.queryOne<string>(`translate("--aaa--","abc-","ABC")`)).toBe(
        "AAA"
      );
      expect(path.queryOne<string>(`translate("--aaa--","abc","ABCDEF")`)).toBe(
        "--AAA--"
      );
      expect(path.queryOne<string>(`translate("--aaa--","xyz","ABCDEF")`)).toBe(
        "--aaa--"
      );
    });
  });

  describe("nodeset functions", () => {
    test("last()", () => {
      const path: XPath = robin.path(root);
      expect(
        path.queryOne<ElementNode>("//tool[last()]")!.getAttributeNode("id")!
          .value
      ).toBe("4");
      expect(path.queryOne<ElementNode>("//*[last()]")!.name.qname).toBe(
        "tools"
      );
      expect(path.queryOne<number>("last()")).toBe(1);
    });

    test("position()", () => {
      const path: XPath = robin.path(root);
      expect(
        path
          .queryOne<ElementNode>("//tool[position()=1]")!
          .getAttributeNode("id")!.value
      ).toBe("1");
      expect(path.queryOne<ElementNode>("//tool[position()>4]")!).toBeNull();
      expect(path.queryOne<number>("position()")).toBe(1);
    });

    test("count()", () => {
      const path: XPath = robin.path(root);
      expect(path.queryOne<number>("count(//.)")).toBe(33);
      expect(path.queryOne<number>("count(//processing-instruction())")).toBe(
        1
      );
      expect(path.queryOne<number>("count(//xml:*)")).toBe(1);
      expect(path.queryOne<number>("count(//a:*)")).toBe(1);
      expect(path.queryOne<number>("count(//@a:*)")).toBe(0);
      expect(
        path.queryOne<number>("count(//processing-instruction('ok'))")
      ).toBe(1);
      expect(
        path.queryOne<number>("count(//processing-instruction('foo'))")
      ).toBe(0);
      expect(path.queryOne<number>("count(//processing-instruction(''))")).toBe(
        0
      );
      expect(
        path.queryOne<ElementNode>("//node()[(count(.))]")!.name.qname
      ).toBe("tools");
    });

    test("local-name()", () => {
      const path: XPath = robin.path(root);
      const arr = path.queryAll<ElementNode>("//*[local-name()]");
      expect(arr.length).toBe(9);
      expect(arr[0].name.qname).toBe("tools");
      expect(
        path.queryOne<ElementNode>("//node()[(local-name(*))]")!.name.qname
      ).toBe("tools");
      expect(path.queryOne<string>("local-name(*//*)")).toBe("tool");
      expect(path.queryOne<string>("local-name()")).toBe("");
    });

    test("namespace-uri()", () => {
      const path: XPath = robin.path(root);
      const arr = path.queryAll<ElementNode>("//*[namespace-uri()]");
      expect(arr.length).toBe(2);
      expect(arr.map((a: ElementNode) => a.name.qname)).toEqual([
        "xml:foo",
        "a:fun",
      ]);
      expect(
        path.queryOne<ElementNode>("//node()[(namespace-uri(.))]")!.name.qname
      ).toBe("xml:foo");
      expect(path.queryOne<string>("namespace-uri(*//*)")).toBe("");
      expect(path.queryOne<string>("namespace-uri()")).toBe("");
      expect(path.queryOne<string>("namespace-uri(//a:fun)")).toBe("some uri");
      expect(path.queryOne<string>("namespace-uri(..)")).toBe("");
    });

    test("name()", () => {
      const path: XPath = robin.path(root);
      const arr = path.queryAll<ElementNode>("//*[name()]");
      expect(arr.length).toBe(9);
      expect(arr[0].name.qname).toBe("tools");
      expect(
        path.queryOne<ElementNode>("//node()[(name(*))]")!.name.qname
      ).toBe("tools");
      expect(path.queryOne<string>("name(*/*)")).toBe("tool");
      expect(path.queryOne<string>("name()")).toBe("");
    });
  });

  describe("boolean functions", () => {
    test("boolean()", () => {
      const path: XPath = robin.path(root);
      const arr = path.queryAll<ElementNode>("//*[boolean(.)]");
      expect(arr.length).toBe(9);
      expect(arr[0].name.qname).toBe("tools");
      expect(
        path.queryOne<ElementNode>("//node()[(boolean(.))]")!.name.qname
      ).toBe("tools");
      expect(path.queryOne<boolean>("boolean(*/../*/./*/.././././../.)")).toBe(
        true
      );
      expect(path.queryOne<boolean>("boolean(*[*/../*/./*/..])")).toBe(true);
      expect(path.queryOne<boolean>("boolean(..)")).toBe(false);
    });

    test("not()", () => {
      const path: XPath = robin.path(root);
      const arr = path.queryAll<ElementNode>("//*[not(.)]");
      expect(arr.length).toBe(0);
      expect(path.queryOne<ElementNode>("//node()[(not(.))]")).toBeNull();
      expect(path.queryOne<boolean>("not(*/../*/./*/.././././../.)")).toBe(
        false
      );
      expect(path.queryOne<boolean>("not(*[*/../*/./*/..])")).toBe(false);
      expect(path.queryOne<boolean>("not(..)")).toBe(true);
    });

    test("true()", () => {
      const path: XPath = robin.path(root);
      const arr = path.queryAll<ElementNode>("//*[true()]");
      expect(arr.length).toBe(9);
      expect(path.queryOne<ElementNode>("//node()[(true())]")).not.toBeNull();
      expect(path.queryOne<boolean>("true()")).toBe(true);
      expect(path.queryOne<boolean>("not(true())")).toBe(false);
    });

    test("false()", () => {
      const path: XPath = robin.path(root);
      const arr = path.queryAll<ElementNode>("//*[false()]");
      expect(arr.length).toBe(0);
      expect(path.queryOne<ElementNode>("//node()[(false())]")).toBeNull();
      expect(path.queryOne<boolean>("false()")).toBe(false);
      expect(path.queryOne<boolean>("not(false())")).toBe(true);
    });

    test("lang()", () => {
      expect(
        robin.path(root).queryOne<AttributeNode>('//@id[lang("US")]')
      ).toBeNull();
      const data: string[] = [
        '<para xml:lang="en"/>',
        '<div xml:lang="en"><para/></div>',
        '<para xml:lang="EN"/>',
        '<para xml:lang="en-us"/>',
      ];
      for (let src of data) {
        const root: RootNode = robin.parse(src);
        expect(robin.path(root).queryOne<boolean>('lang("en")')).toBe(false);
        expect(robin.path(root).queryOne<boolean>('lang("US")')).toBe(false);
        expect(
          robin.path(root).queryOne<AttributeNode>('//@xml:lang[lang("US")]')
        ).toBeNull();
        expect(
          robin.path(root).queryOne<ElementNode>('*[lang("en")]')
        ).toBeTruthy();
        expect(
          robin
            .path(root)
            .queryOne<ElementNode>('*[lang("EN")][lang("En")][lang("eN")]')
        ).toBeTruthy();
      }
    });
  });
});
