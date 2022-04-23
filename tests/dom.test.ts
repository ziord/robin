import {
  Robin,
  RootNode,
  ElementNode,
  CommentNode,
  AttributeNode,
  NamespaceNode,
  PINode,
  TextNode,
  RNodeT,
  isElement,
  DOM,
  DOMFilter,
} from "../src";

declare function loadData(filename?: string): string;

const data: string = loadData();
const robin = new Robin(data);
const root: RootNode = robin.getRoot();

test("dom: find by element name", () => {
  const element = robin.dom(root).find<ElementNode>("tool")!;
  expect(element).not.toBeNull();
  expect(element.name).not.toBeNull();
  expect(element.name.qname).toBe("tool");
  expect(robin.dom(root).find("tool", false)).toBeNull(); // non-recursive
});

test("dom: find by filter function", () => {
  const element = robin.dom(root).find<ElementNode>({
    filter: (n: RNodeT) => {
      return (
        isElement(n) &&
        n.hasAttributeNode("id") &&
        n.getAttributeNode("id")!.value === "1"
      );
    },
  });
  // .find() returns first match
  expect(robin.dom(root).find("tool")).toBe(element);
  // @ts-ignore
  expect(() => robin.dom(root).find({ xyz: 3 })).toThrow();
});

test("dom: findAll recursive", () => {
  expect(robin.dom(root).findAll("tool").length).toEqual(4);
  // all elements having an 'id' attribute
  expect(
    robin.dom(root).findAll({ filter: DOMFilter.AttributeFilter("id") }).length
  ).toEqual(5);
  // all TextNode(s) containing the text 'parsing'
  expect(
    robin.dom(root).findAll({ text: { value: "parsing", match: "partial" } })
      .length
  ).toEqual(2);
  const nodes: RNodeT[] = robin.dom(root).findAll({
    text: { value: "dom", match: "partial" },
  });
  expect(nodes.length).toEqual(1);
  expect(nodes[0]).toBeInstanceOf(TextNode);
  expect((nodes[0] as TextNode).value.includes("dom")).toBe(true);
});

test("dom: findAll non-recursive", () => {
  expect(robin.dom(root).findAll<ElementNode>("tool", false).length).toEqual(0);
  expect(robin.dom(root).findAll<ElementNode>("tools", false).length).toEqual(
    1
  );
  // all elements having an 'id' attribute
  expect(
    robin.dom(root).findAll({ filter: DOMFilter.AttributeFilter("id") }, false)
      .length
  ).toEqual(0);
  // all TextNode(s) containing the text 'parsing'
  expect(
    robin
      .dom(root)
      .findAll({ text: { value: "parsing", match: "partial" } }, false).length
  ).toEqual(0);
  const nodes: RNodeT[] = robin
    .dom(root)
    .findAll({ text: { value: "dom", match: "partial" } }, false);
  expect(nodes.length).toEqual(0);
});

test("dom: AttributeFilter", () => {
  // all elements having 'id' & 'section' attributes
  expect(
    robin
      .dom(root)
      .findAll({ filter: DOMFilter.AttributeFilter(["id", "section"]) }).length
  ).toEqual(5);
  // all elements having mode = 'printer' attributes
  expect(
    robin
      .dom(root)
      .findAll({ filter: DOMFilter.AttributeFilter({ mode: "printer" }) })
      .length
  ).toEqual(1);
});

test("dom: ElementFilter", () => {
  // all 'tool' elements having 'id' & 'section' attributes
  expect(
    robin
      .dom(root)
      .findAll({ filter: DOMFilter.ElementFilter("tool", ["id", "section"]) })
      .length
  ).toEqual(4);
  // all 'tool' elements
  expect(
    robin.dom(root).findAll({ filter: DOMFilter.ElementFilter("tool") }).length
  ).toEqual(4);
  // all 'tool' elements having mode = 'printer' attributes
  expect(
    robin
      .dom(root)
      .findAll({ filter: DOMFilter.ElementFilter("tool", { mode: "printer" }) })
      .length
  ).toEqual(1);
});

test("dom: select", () => {
  // element
  expect(robin.dom(root).findAll("tool").length).toEqual(4);
  expect(robin.dom(root).findAll({ name: "tool" }).length).toEqual(4);
  // comment
  expect(robin.dom(root).findAll({ comment: "foo" }).length).toEqual(0);
  expect(
    robin
      .dom(root)
      .findAll({ comment: { value: "foo", match: "partial", trim: true } })
      .length
  ).toEqual(1);
  expect(
    robin
      .dom(root)
      .findAll({ comment: { value: "foo", match: "partial-ignoreCase" } })
      .length
  ).toEqual(1);
  expect(
    robin
      .dom(root)
      .findAll({ comment: { value: "okay", match: "exact", trim: true } })
      .length
  ).toEqual(1);
  expect(
    robin
      .dom(root)
      .findAll({ comment: { value: "OKAY", match: "exact-ignoreCase" } }).length
  ).toEqual(1);
  // text
  expect(robin.dom(root).findAll({ text: "xpath and dom api" }).length).toEqual(
    1
  );
  expect(
    robin.dom(root).findAll({
      text: { value: "pretty printing", match: "partial", trim: true },
    }).length
  ).toEqual(1);
  expect(
    robin
      .dom(root)
      .findAll({ text: { value: "parsing", match: "partial-ignoreCase" } })
      .length
  ).toEqual(2);
  expect(
    robin
      .dom(root)
      .findAll({ text: { value: "printing", match: "exact", trim: true } })
      .length
  ).toEqual(0);
  expect(
    robin
      .dom(root)
      .findAll({ text: { value: "123", match: "exact-ignoreCase" } }).length
  ).toEqual(1);
  // pi
  expect(robin.dom(root).findAll({ target: "ok" }).length).toEqual(1);
  expect(robin.dom(root).findAll({ target: "pop" }).length).toEqual(0);
  expect(
    robin.dom(root).findAll({ filter: (n: RNodeT) => true }).length
  ).toEqual(33); // includes root node
});

test("dom: findChildren", () => {
  // find the children of the element tools
  expect(
    robin.dom(root).findChildren<ElementNode>({ name: "tools" }).length
  ).toBe(11);
  expect(robin.dom(root).findChildren("tools", false).length).toBe(11);
  // find the children of the element tool
  expect(robin.dom(root).findChildren("tool").length).toBe(1);
  // tool is a descendant element that wouldn't be found without a recursive search
  // (recursive set to false)
  expect(robin.dom(root).findChildren("tool", false).length).toBe(0);
  // find the children of the text node containing "dom"
  expect(
    robin.dom(root).findChildren({ text: { value: "dom", match: "partial" } })
      .length
  ).toBe(0);
});

test("dom: next", () => {
  // trailing spaces separating elements are ignored with preserveSpace set to false
  let root: RootNode = robin.parse(data, "XML", { preserveSpace: false });
  let elem = robin.dom(root).find<ElementNode>("tool")!;
  expect(elem).not.toBeNull();
  expect(elem.getAttributeNode("id")!.value).toBe("1");
  // next node is an element (since we're not preserving whitespace)
  const next = robin.dom(elem).next<ElementNode>()!;
  expect(elem).not.toBeNull();
  expect(next.name.qname).toBe("tool");
  expect(next.getAttributeNode("id")!.value).toBe("2");

  // preserveSpace is true by default
  root = robin.parse(data, "XML");
  elem = robin.dom(root).find<ElementNode>("tool")!;
  expect(elem).not.toBeNull();
  expect(elem.getAttributeNode("id")!.value).toBe("1");
  // next node is a text (since we're preserving whitespace)
  expect(<TextNode>robin.dom(elem).next()).toBeInstanceOf(TextNode);
});

test("dom: previous", () => {
  // trailing spaces separating elements are ignored with preserveSpace set to false
  let root: RootNode = robin.parse(data, "XML", { preserveSpace: false });
  let elem = robin.dom(root).find<ElementNode>("tool")!;
  expect(elem).not.toBeNull();
  expect(elem.getAttributeNode("id")!.value).toBe("1");
  // there's no previous node (since we're not preserving whitespace)
  let previous = robin.dom(elem).previous();
  expect(previous).toBeNull();

  // preserveSpace is true by default
  root = robin.parse(data, "XML");
  elem = robin.dom(root).find<ElementNode>("tool")!;
  expect(elem).not.toBeNull();
  expect(elem.getAttributeNode("id")!.value).toBe("1");
  // previous node is a text (since we're preserving whitespace)
  previous = <TextNode>robin.dom(elem).previous();
  expect(previous).not.toBeNull();
  expect(previous).toBeInstanceOf(TextNode);
  elem = robin.dom(root).find<ElementNode>("tools")!;
  expect(elem).not.toBeNull();
  expect(robin.dom(elem).previous()).toBeNull();
});

test("dom: previousElement", () => {
  const root: RootNode = robin.parse(data, "XML");
  let elem = robin
    .dom(root)
    .find<ElementNode>({ filter: DOMFilter.AttributeFilter({ id: "2" }) })!;
  expect(elem).not.toBeNull();
  expect(elem.name.qname).toBe("tool");
  expect(elem.getAttributeNode("id")!.value).toBe("2");
  const previous = robin.dom(elem).previousElement()!;
  expect(previous).not.toBeNull();
  expect(previous.name.qname).toBe("tool");
  expect(previous.getAttributeNode("id")!.value).toBe("1");
  elem = robin.dom(root).find<ElementNode>("tool")!;
  expect(robin.dom(elem).previousElement()).toBeNull();
  expect(robin.dom(root).previousElement()).toBeNull();
});

test("dom: nextElement", () => {
  const root: RootNode = robin.parse(data, "XML");
  let elem = robin.dom(root).find<ElementNode>("tool")!;
  expect(elem).not.toBeNull();
  expect(elem.name.qname).toBe("tool");
  expect(elem.getAttributeNode("id")!.value).toBe("1");
  const next = robin.dom(elem).nextElement()!;
  expect(next).not.toBeNull();
  expect(next.name.qname).toBe("tool");
  expect(next.getAttributeNode("id")!.value).toBe("2");
  elem = robin.dom(root).find<ElementNode>("tools")!;
  expect(robin.dom(elem).nextElement()).toBeNull();
  expect(robin.dom(root).nextElement()).toBeNull();
});

test("dom: previousComment", () => {
  const root: RootNode = robin.parse(data, "XML");
  const comm = <CommentNode>(
    robin.dom(root).find({ comment: { value: "okay", match: "exact" } })
  );
  expect(comm).not.toBeNull();
  const previous = <CommentNode>robin.dom(comm).previousComment();
  expect(previous).not.toBeNull();
  expect(previous).toBeInstanceOf(CommentNode);
  expect(previous.value).toBe("        foo");
  expect(robin.dom(comm).previousElement()).toBeNull();
  expect(robin.dom(root).previousComment()).toBeNull();
});

test("dom: nextComment", () => {
  const root: RootNode = robin.parse(data, "XML");
  const comm = <CommentNode>(
    robin
      .dom(root)
      .find({ comment: { value: "foo", match: "partial-ignoreCase" } })
  );
  expect(comm).not.toBeNull();
  const previous = <CommentNode>robin.dom(comm).nextComment();
  expect(previous).not.toBeNull();
  expect(previous).toBeInstanceOf(CommentNode);
  expect(previous.value).toBe("okay");
  expect(robin.dom(comm).nextElement()).toBeNull();
  expect(robin.dom(root).nextComment()).toBeNull();
});

test("dom: previousText", () => {
  const root: RootNode = robin.parse("<p>foo <!----> bar </p>", "XML");
  const text = <TextNode>(
    robin.dom(root).find({ text: { value: "bar", match: "partial" } })
  );
  expect(text).not.toBeNull();
  const previous = <TextNode>robin.dom(text).previousText();
  expect(previous).not.toBeNull();
  expect(previous).toBeInstanceOf(TextNode);
  expect(robin.dom(text).previousComment()).toBeNull();
  expect(robin.dom(text).previousElement()).toBeNull();
  expect(robin.dom(root).previousText()).toBeNull();
});

test("dom: nextText", () => {
  const root: RootNode = robin.parse("<p>foo <!----> bar </p>", "XML");
  const text = <TextNode>(
    robin.dom(root).find({ text: { value: "foo", match: "partial" } })
  );
  expect(text).not.toBeNull();
  const previous = <TextNode>robin.dom(text).nextText();
  expect(previous).not.toBeNull();
  expect(previous).toBeInstanceOf(TextNode);
  expect(robin.dom(text).nextComment()).toBeNull();
  expect(robin.dom(text).nextElement()).toBeNull();
  expect(robin.dom(root).nextText()).toBeNull();
});

test("dom: parent", () => {
  const root: RootNode = robin.parse(data, "XML", { documentName: "Robin" });
  expect(robin.dom(root).parent()).toBeNull();
  let elem = robin.dom(root).find<ElementNode>("tool")!;
  expect(elem).not.toBeNull();
  expect(robin.dom(elem).parent<ElementNode>()!.name.qname).toBe("tools");
  elem = robin.dom(root).find<ElementNode>("tools")!;
  expect(elem).not.toBeNull();
  expect((<RootNode>robin.dom(elem).parent()!).name).toBe("Robin");
});

test("dom: findParent", () => {
  const root: RootNode = robin.parse(data, "XML");
  // find the parent of the element named 'fx' - doesn't exist
  expect(robin.dom(root).findParent("fx")).toBeNull();
  // find the parent of the element named 'tool'
  const elem = robin.dom(root).findParent<ElementNode>("tool")!;
  expect(elem).not.toBeNull();
  expect(elem.name.qname).toBe("tools");
  // find the parent of the element named 'tools'
  const parent = <RootNode>robin.dom(root).findParent("tools");
  expect(parent).not.toBeNull();
  expect(parent).toBe(root);
  expect(parent.name).toBe("Document");
});

test("dom: ancestors", () => {
  const root: RootNode = robin.parse(data, "XML");
  // get the ancestors of root - root has no ancestor
  let anc = robin.dom(root).ancestors();
  expect(anc.length).toBe(0);
  const elem = robin.dom(root).find<ElementNode>("bar")!;
  expect(elem).not.toBeNull();
  expect(elem.name.qname).toBe("bar");
  // get the ancestors of elem
  anc = robin.dom(elem).ancestors();
  expect(anc.includes(elem)).toBe(false);
  expect(anc.length).toBe(3);
});

test("dom: findAncestors", () => {
  const root: RootNode = robin.parse(data, "XML");
  // find the ancestors of the element named 'bar'
  let anc = robin.dom(root).findAncestors("bar");
  expect(anc.length).toBe(3);
  // find the ancestors of the comment with value 'okay'
  anc = robin
    .dom(root)
    .findAncestors({ comment: { value: "OKay", match: "exact-ignoreCase" } });
  expect(anc.length).toBe(3);
  // find the ancestors of the comment with value '        Foo'
  anc = robin.dom(root).findAncestors({
    comment: { value: "foo", match: "partial-ignoreCase", trim: true },
  });
  expect(anc.length).toBe(3);
  // find the ancestors of the comment with value 'FOO'
  anc = robin
    .dom(root)
    .findAncestors({ comment: { value: "0xdeadbeef", match: "exact" } });
  expect(anc.length).toBe(0);
  // find the ancestors of the comment with value '        foo'
  anc = robin.dom(root).findAncestors({ comment: "        foo" });
  expect(anc.length).toBe(3);
});

test("dom: descendants", () => {
  const root: RootNode = robin.parse(data, "XML");
  // get the descendants of root
  let desc = robin.dom(root).descendants();
  expect(desc.length).toBe(32);
  expect(desc.includes(root)).toBe(false);
  const elem = <ElementNode>robin.dom(root).find("bar");
  expect(elem).not.toBeNull();
  expect(elem.name.qname).toBe("bar");
  // get the descendants of elem
  desc = robin.dom(elem).descendants();
  expect(desc.length).toBe(1);
  expect(desc.includes(elem)).toBe(false);
});

test("dom: findDescendants", () => {
  const root: RootNode = robin.parse(data, "XML");
  // find the descendants of the element named 'bar'
  let desc = robin.dom(root).findDescendants("bar");
  expect(desc.length).toBe(1);
  expect(robin.dom(root).findDescendants("fox").length).toBe(0);
  // find the descendants of the comment with value 'okay'
  desc = robin
    .dom(root)
    .findDescendants({ comment: { value: "OKay", match: "exact-ignoreCase" } });
  expect(desc.length).toBe(0);
  // find the descendants of the text with value 'not so bad'
  desc = robin.dom(root).findDescendants({
    text: { value: "not so bad", match: "exact-ignoreCase" },
  });
  expect(desc.length).toBe(0);
  // find the descendants of the text with value 'not so bad'
  desc = robin.dom(root).findDescendants({ text: "not so bad" });
  expect(desc.length).toBe(0);
  // find the descendants of the text with value 'not so bad'
  desc = robin.dom(root).findDescendants({
    text: { value: "not so bad", match: "partial", trim: true },
  });
  expect(desc.length).toBe(0);
});

test("dom: previousSibling", () => {
  const root: RootNode = robin.parse(data, "XML");
  const elem = <ElementNode>(
    robin.dom(root).find({ filter: DOMFilter.AttributeFilter({ id: "2" }) })
  );
  expect(elem).not.toBeNull();
  const previous = robin.dom(elem).previousSibling();
  expect(previous).not.toBeNull();
  expect(previous).toBeInstanceOf(TextNode);
  expect(robin.dom(root).previousSibling()).toBeNull();
});

test("dom: nextSibling", () => {
  const root: RootNode = robin.parse(data, "XML");
  const elem = robin
    .dom(root)
    .find<ElementNode>({ filter: DOMFilter.AttributeFilter({ id: "2" }) })!;
  expect(elem).not.toBeNull();
  const next = robin.dom(elem).nextSibling();
  expect(next).not.toBeNull();
  expect(next).toBeInstanceOf(TextNode);
  expect(robin.dom(root).nextSibling()).toBeNull();
});

test("dom: findPreviousSibling", () => {
  const root: RootNode = robin.parse(data, "XML");
  const previous = robin
    .dom(root)
    .findPreviousSibling({ filter: DOMFilter.AttributeFilter({ id: "2" }) });
  expect(previous).not.toBeNull();
  expect(previous).toBeInstanceOf(TextNode);
  expect(robin.dom(root).findPreviousSibling("tools")).toBeNull();
  expect(robin.dom(root).findPreviousSibling("fox")).toBeNull();
});

test("dom: findNextSibling", () => {
  const root: RootNode = robin.parse(data, "XML");
  const next = robin
    .dom(root)
    .findNextSibling({ filter: DOMFilter.AttributeFilter({ id: "2" }) });
  expect(next).not.toBeNull();
  expect(next).toBeInstanceOf(TextNode);
  expect(robin.dom(root).findNextSibling("tools")).toBeNull();
  expect(robin.dom(root).findNextSibling("fox")).toBeNull();
});

test("dom: siblings", () => {
  const root: RootNode = robin.parse(data, "XML");
  // get the siblings of root
  let sib = robin.dom(root).siblings();
  expect(sib.length).toBe(0);
  const elem = robin.dom(root).find<ElementNode>("bar")!;
  expect(elem).not.toBeNull();
  // get the siblings of elem
  sib = robin.dom(elem).siblings();
  expect(sib.includes(elem)).toBe(false);
  expect(sib.length).toBe(12);
});

test("dom: findSiblings", () => {
  const root: RootNode = robin.parse(data, "XML");
  expect(robin.dom(root).findSiblings("bar").length).toBe(12);
  expect(robin.dom(root).findSiblings("tools").length).toBe(0);
  expect(robin.dom(root).findSiblings("fx").length).toBe(0);
});

test("dom: findAttribute", () => {
  const root: RootNode = robin.parse(data, "XML");
  // get the attribute 'none' from element 'bar'
  let attr = robin.dom(root).findAttribute("bar", "none");
  expect(attr).toBeNull();
  attr = robin.dom(root).findAttribute("funny", "existNot");
  expect(attr).toBeNull();
  // get the attribute (with name) 'mode' from the element 'tool'
  attr = <AttributeNode>robin.dom(root).findAttribute("tool", "mode");
  expect(attr).not.toBeNull();
  expect(attr).toBeInstanceOf(AttributeNode);
  expect(attr.name.qname).toBe("mode");
  expect(attr.value).toBe("xml");
});

test("dom: findAttributes", () => {
  const root: RootNode = robin.parse(data, "XML");
  // get all attributes from the element 'bar'
  expect(robin.dom(root).findAttributes("bar").length).toBe(0);
  expect(robin.dom(root).findAttributes("tools").length).toBe(0);
  // get all attributes from the element 'tool'
  const attrs = robin.dom(root).findAttributes("tool");
  expect(attrs.length).toBe(2);
  attrs.every((n: RNodeT) => expect(n).toBeInstanceOf(AttributeNode));
  expect(robin.dom(root).findAttributes("fx").length).toBe(0);
});

test("dom: extractComments", () => {
  expect(robin.dom(robin.parse(data, "XML")).extractComments().length).toBe(2);
});

test("dom: extractTexts", () => {
  jest.spyOn(console, "warn").mockImplementation();
  expect(
    robin.dom(robin.parse(data, "XML")).extractTexts().length
  ).toBeGreaterThan(5);
  // script & style text is excluded
  let markup =
    "  <p> some <script>let i = 10; </script><style> padding-left: 10; </style> value </p>";
  let texts = robin.dom(robin.parse(markup, "HTML")).extractTexts();
  expect(texts.length).toBe(2);
  expect(texts.map((t: TextNode) => t.value)).toEqual([" some ", " value "]);
  markup = "<![CDATA[stuff]]><p> some value </p>";
  texts = robin.dom(robin.parse(markup, "XML")).extractTexts();
  expect(texts.length).toBe(2);
  expect(texts.map((t: TextNode) => t.value)).toEqual([
    "stuff",
    " some value ",
  ]);
});

test("dom: comment", () => {
  const dom = robin.dom(robin.parse(data, "XML"));
  expect(dom.comment()).toBe("        foo\nokay");
  expect(dom.comment("|")).toBe("        foo|okay");
});

test("dom: extractTexts", () => {
  const root: RootNode = robin.parse(data, "XML");
  const elem = <ElementNode>robin.dom(root).find("a:fun");
  expect(robin.dom(elem).text()).toBe("not so bad");
  expect(robin.dom(root).text("\n").length).toBeGreaterThan(50);
});

test("dom: insertBefore", () => {
  const root: RootNode = robin.parse(data, "XML");
  expect(robin.dom(root).insertBefore(root)).toBe(false);
  const rootElem = <ElementNode>root.rootElement;
  const count = rootElem.children.length;
  const d = new DOM();
  // insert element
  const newElem: ElementNode = d.createElement("new");
  const elem = robin.dom(root).find<ElementNode>("tool")!;
  expect(elem).not.toBeNull();
  expect(robin.dom(elem).insertBefore(newElem)).toBe(true);
  expect(newElem.parent).toBe(rootElem);
  expect(rootElem.children.length).toBe(count + 1);
  expect(robin.dom(elem).previousSibling()).toBe(newElem);
  // insert text
  const newText: TextNode = d.createText("new text");
  expect(newText).not.toBeNull();
  expect(robin.dom(elem).insertBefore(newText)).toBe(true);
  expect(newText.parent).toBe(rootElem);
  expect(rootElem.children.length).toBe(count + 2);
  expect(robin.dom(elem).previousSibling()).toBe(newText);
});

test("dom: insertAfter", () => {
  const root: RootNode = robin.parse(data, "XML");
  expect(robin.dom(root).insertAfter(root)).toBe(false);
  const rootElem = <ElementNode>root.rootElement;
  const count = rootElem.children.length;
  const newComm: CommentNode = robin.dom(root).createComment("sweet sensation");
  const elem = robin.dom(root).find<ElementNode>("tool")!;
  expect(elem).not.toBeNull();
  expect(robin.dom(elem).insertAfter(newComm)).toBe(true);
  expect(newComm.parent).toBe(rootElem);
  expect(rootElem.children.length).toBe(count + 1);
  expect(robin.dom(elem).nextSibling()).toBe(newComm);
});

test("dom: setElementName", () => {
  const root: RootNode = robin.parse(data, "XML");
  const elem = <ElementNode>robin.dom(root).find("tool");
  expect(elem.name.qname).toBe("tool");
  expect(elem.name.lname).toBe("tool");
  expect(elem.name.pname).toBe("");
  expect(robin.dom(root).setElementName("pie", "fish")).toBe(false);
  expect(robin.dom(elem).setElementName("pie", "fish")).toBe(true);
  expect(elem.name.qname).toBe("fish:pie");
  expect(elem.name.pname).toBe("fish");
  expect(elem.name.lname).toBe("pie");
});

test("dom: setNamespace", () => {
  const root: RootNode = robin.parse(data, "XML");
  const ns = robin.dom(root).createNamespace("fish", "some uri");
  const elem = <ElementNode>robin.dom(root).find("tool");
  expect(elem.name.qname).toBe("tool");
  expect(elem.namespace).toBeNull();
  expect(elem.isNamespaced).toBe(false);
  expect(robin.dom(root).setNamespace(ns)).toBe(false);
  expect(robin.dom(elem).setNamespace(ns)).toBe(true);
  expect(elem.name.qname).toBe("fish:tool");
  expect(elem.namespace).toBe(ns);
  expect(elem.isNamespaced).toBe(true);
  const attr = <AttributeNode>elem.getAttributeNode("id");
  expect(attr).not.toBeNull();
  expect(attr.name.qname).toBe("id");
  expect(robin.dom(attr).setNamespace(ns)).toBe(true);
  expect(attr.name.qname).toBe("fish:id");
});

test("dom: addAttribute", () => {
  const root: RootNode = robin.parse(data, "XML");
  const attr = robin
    .dom(root)
    .createAttribute("the-value", "the-name", "the-ns-prefix");
  const elem = robin.dom(root).find<ElementNode>("tool")!;
  expect(elem.attributes.size).toBe(2);
  expect(robin.dom(root).addAttribute(attr)).toBe(false);
  expect(robin.dom(elem).addAttribute(attr)).toBe(true);
  expect(elem.getAttributeNode("the-ns-prefix:the-name")).toBe(attr);
  expect(elem.attributes.size).toBe(3);
});

test("dom: setRootNodeName", () => {
  const root: RootNode = robin.parse(data, "XML");
  expect(root.name).toBe("Document"); // default name for a doc parsed into a RootNode
  expect(robin.dom(root.rootElement!).setRootNodeName("Robin")).toBe(false);
  expect(robin.dom(root).setRootNodeName("Robin")).toBe(true);
  expect(root.name).toBe("Robin");
});

test("dom: setRootElement", () => {
  const root: RootNode = robin.parse(data, "XML");
  expect(root.name).toBe("Document");
  const elem = robin.dom(root).createElement("test");
  const rootElem = robin.dom(root).find<ElementNode>("tools")!;
  expect(root.rootElement).toBe(rootElem);
  expect(robin.dom(rootElem).setRootElement(elem)).toBe(false);
  // root element can only be set on a RootNode
  expect(robin.dom(root).setRootElement(elem)).toBe(true);
  expect(root.rootElement).toBe(elem);
});

test("dom: addNamespace", () => {
  const root: RootNode = robin.parse(data, "XML");
  const ns = robin.dom(root).createNamespace("fish", "some uri");
  const elem = robin.dom(root).find<ElementNode>("tool")!;
  expect(elem.name.qname).toBe("tool");
  expect(elem.namespace).toBeNull();
  expect(elem.namespaces.length).toBe(0);
  // can only add namespace to ElementNode
  expect(robin.dom(root).addNamespace(ns)).toBe(false);
  expect(robin.dom(elem).addNamespace(ns)).toBe(true);
  expect(elem.namespaces.length).toBe(1);
  expect(elem.name.qname).toBe("tool");
  expect(elem.namespace).toBeNull();
});

test("dom: addChild", () => {
  const root: RootNode = robin.parse(data, "XML");
  expect(robin.dom(root).insertAfter(root)).toBe(false);
  let elem = robin.dom(root).find<ElementNode>("tool")!;
  let count = elem.children.length;
  // add comment
  const newComm: CommentNode = robin.dom(root).createComment("sweet sensation");
  expect(elem).not.toBeNull();
  expect(newComm.parent).toBeUndefined();
  expect(robin.dom(newComm).addChild(elem)).toBe(false); // a comment can have no child
  expect(robin.dom(elem).addChild(root)).toBe(false); // a RootNode cannot be a child
  expect(elem.hasComment).toBe(false);
  expect(robin.dom(elem).addChild(newComm)).toBe(true);
  expect(newComm.parent).toBe(elem);
  expect(elem.children.length).toBe(count + 1);
  expect(elem.hasComment).toBe(true);
  // add attribute
  const newAttr: AttributeNode = robin
    .dom(root)
    .createAttribute("sweet", "sensation");
  elem = robin.dom(root).find<ElementNode>("bar")!;
  count = elem.attributes.size;
  expect(newAttr.parent).toBeUndefined();
  expect(elem.hasAttribute).toBe(false);
  expect(robin.dom(elem).addChild(newAttr)).toBe(true);
  expect(newAttr.parent).toBe(elem);
  expect(elem.attributes.size).toBe(count + 1);
  expect(elem.hasAttribute).toBe(true);
  expect(elem.getAttributeNode("sensation")).toBe(newAttr);
  // add namespace
  const newNs: NamespaceNode = robin
    .dom(root)
    .createNamespace("sweet", "some uri");
  count = elem.namespaces.length;
  expect(elem.isNamespaced).toBe(false);
  expect(newNs.parent).toBeUndefined();
  expect(robin.dom(elem).addChild(newNs)).toBe(true);
  expect(newNs.parent).toBe(elem);
  expect(elem.namespaces.length).toBe(count + 1);
  expect(elem.isNamespaced).toBe(true);
  expect(elem.namespaces.includes(newNs)).toBe(true);
  // add element
  const newElem: ElementNode = robin.dom(root).createElement("bitter");
  count = elem.children.length;
  expect(newElem.parent).toBeUndefined();
  expect(robin.dom(elem).addChild(newElem)).toBe(true);
  expect(newElem.parent).toBe(elem);
  expect(elem.children.length).toBe(count + 1);

  // add child to root
  // comment
  count = root.children.length;
  expect(robin.dom(root).addChild(newComm)).toBe(true);
  expect(newComm.parent).toBe(root);
  expect(root.children.length).toBe(count + 1);
  // add element
  count = root.rootElement!.children.length;
  expect(robin.dom(root).addChild(newElem)).toBe(true);
  expect(newElem.parent).toBe(root.rootElement);
  expect(root.rootElement!.children.length).toBe(count + 1);
  root.rootElement = null;
  // can't add element if no root element exists in the document
  expect(robin.dom(root).addChild(newElem)).toBe(false);
  // can't add any of these to a RootNode
  expect(robin.dom(root).addChild(newAttr)).toBe(false);
  expect(robin.dom(root).addChild(newNs)).toBe(false);
  // add pi
  count = root.children.length;
  const newPi: PINode = robin.dom(root).createPI("fox", "some stringy value");
  expect(robin.dom(root).addChild(newPi)).toBe(true);
  expect(root.children.length).toBe(count + 1);
  expect(newPi.parent).toBe(root);
  // can't add a RootNode
  expect(robin.dom(root).addChild(robin.dom(root).createRoot("Fake"))).toBe(
    false
  );
});

test("dom: drop", () => {
  const root: RootNode = robin.parse(data, "XML");
  let elem = robin.dom(root).find<ElementNode>("bar")!;
  // add comment
  const newComm: CommentNode = robin.dom(root).createComment("sweet sensation");
  expect(robin.dom(newComm).drop()).toBe(false);
  expect(robin.dom(elem).addChild(newComm)).toBe(true);
  expect(elem.children.includes(newComm)).toBe(true);
  // drop the child
  expect(robin.dom(newComm).drop()).toBe(true);
  expect(elem.children.includes(newComm)).toBe(false);
  elem = <ElementNode>robin.dom(root).find("bar");
  expect(robin.dom(elem.children[0]).drop()).toBe(true);

  // false
  const newAttr: AttributeNode = robin
    .dom(root)
    .createAttribute("sweet", "sensation");
  expect(robin.dom(elem).addChild(newAttr)).toBe(true);
  // attributes can't be dropped automatically.
  expect(robin.dom(newAttr).drop()).toBe(false);
  const newNs: NamespaceNode = robin
    .dom(root)
    .createNamespace("sweet", "sensation");
  expect(robin.dom(elem).addChild(newNs)).toBe(true);
  // namespaces can't be dropped automatically.
  expect(robin.dom(newNs).drop()).toBe(false);
});

test("dom: dropChild", () => {
  const root: RootNode = robin.parse(data, "XML");
  // get element 'random'
  const elem = <ElementNode>robin.dom(root).find("random");
  const count = elem.children.length;
  const filterFn = (name: string) => (n: RNodeT) =>
    isElement(n) && n.name.qname === name;
  expect(robin.dom(elem).dropChild(filterFn("foobar"), true)).toBe(false);
  expect(robin.dom(elem).dropChild(filterFn("foobar"))).toBe(false);
  // drop element 'bar' - a child element of element 'random'
  expect(robin.dom(elem).dropChild(filterFn("bar"))).toBe(true);
  expect(elem.children.length).toBe(count - 1);
});

test("dom: dropChildren", () => {
  const root: RootNode = robin.parse(data, "XML");
  // get element 'tools'
  const elem = <ElementNode>robin.dom(root).find("tools");
  const count = elem.children.length;
  const filterFn = (name: string) => (n: RNodeT) =>
    isElement(n) && n.name.qname === name;
  expect(robin.dom(elem).dropChildren(filterFn("foobar"))).toBe(false);
  expect(robin.dom(elem).dropChildren(filterFn("foobar"))).toBe(false);
  // drop all 'tool' elements
  expect(robin.dom(elem).dropChildren(filterFn("tool"), true)).toBe(true);
  expect(elem.children.length).toBe(count - 4);
});

test("dom: dropAttribute", () => {
  const root: RootNode = robin.parse(data, "XML");
  const elem = <ElementNode>robin.dom(root).find("tool");
  const count = elem.attributes.size;
  expect(robin.dom(root).dropAttribute("fox")).toBe(false);
  expect(robin.dom(elem).dropAttribute("fox")).toBe(false);
  expect(robin.dom(elem).dropAttribute("id")).toBe(true);
  expect(elem.attributes.size).toBe(count - 1);
});
