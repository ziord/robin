import {
  Render,
  Robin,
  RootNode,
  CommentNode,
  ElementNode,
  AttributeNode,
  NamespaceNode,
  PINode,
} from "../src";

declare function loadData(filename?: string): string;

test("render RootNode - indentSize", () => {
  const robin = new Robin("<f>some data</f>");
  const root: RootNode = robin.getRoot();
  const render = new Render({ indentSize: 4 });
  const rend: string = render.render(root);
  expect(rend).toBe("<f>\n    some data\n</f>");
  expect(render.renderRootNode(root)).toBe(rend);
});

test("render RootNode - showToplevelDocument", () => {
  const robin = new Robin("<f>some data</f>");
  const root: RootNode = robin.getRoot();
  const render = new Render({ showToplevelDocument: true });
  const rend: string = render.render(root);
  expect(rend).toBe("<Document>\n  <f>\n    some data\n  </f>\n</Document>");
  expect(render.renderRootNode(root)).toBe(rend);
  render.updateConfig({ showToplevelDocument: false }); // default
  expect(render.renderRootNode(root)).toBe("<f>\n  some data\n</f>");
  render.updateConfig({ showToplevelDocument: true });
  root.name = "Robin"; // change name
  expect(render.renderRootNode(root)).toBe(
    "<Robin>\n  <f>\n    some data\n  </f>\n</Robin>"
  );
});

test("render RootNode - transposeText", () => {
  const robin = new Robin(
    "<f a='fan' b='<foxes>'>some value &amp; \"data, &gt; '</f>"
  );
  let root: RootNode = robin.getRoot();
  const render = new Render({ transposeText: true });
  expect(render.render(root)).toBe(
    '<f a="fan" b="<foxes>">\n  some value & "data, > \'\n</f>'
  );
  render.updateConfig({ transposeText: false });
  expect(render.render(root)).toBe(
    '<f a="fan" b="<foxes>">\n  some value &amp; "data, &gt; \'\n</f>'
  );
  render.updateConfig({ toFile: true, transposeText: true });
  expect(render.render(root)).toBe(
    '<f a="fan" b="<foxes>">\n  some value &amp; "data, &gt; \'\n</f>'
  );
  render.updateConfig({ strictTranspose: true });
  // the `'` in the markup text, and <> in the attribute value would be escaped
  // when strictTranspose flag is on
  expect(render.render(root)).toBe(
    '<f a="fan" b="&lt;foxes&gt;">\n  some value &amp; &quot;data, &gt; &apos;\n</f>'
  );
  // a warning is issued because non-whitespace text is found outside a root element
  jest.spyOn(console, "error").mockImplementation();
  const spy: jest.SpyInstance = jest
    .spyOn(console, "warn")
    .mockImplementation();
  expect(() => robin.parse("# gib")).toThrow();
  root = robin.parse("<![CDATA[some < > & &# <data]]>");
  expect(spy).toHaveBeenCalled();
  expect(render.render(root)).toBe(
    "<![CDATA[some &lt; &gt; &amp; &amp;# &lt;data]]>"
  );
  // toFile - true
  root = robin.parse("<p>& &#123; &#x25;</p>");
  expect(render.render(root)).toBe("<p>\n  &amp; &#123; &#x25;\n</p>");
  root = robin.parse("<p>&&&</p>");
  expect(render.render(root)).toBe("<p>\n  &amp;&amp;&amp;\n</p>");
  // toFile - false
  render.updateConfig({ toFile: false });
  root = robin.parse("<p>&quot;c&#244;t&#233;&quot; &gt; ponmo</p>");
  expect(render.render(root)).toBe('<p>\n  "côté" > ponmo\n</p>');
  root = robin.parse("<p>&&&</p>");
  expect(render.render(root)).toBe("<p>\n  &&&\n</p>");
});

test("render RootNode - strictTranspose", () => {
  jest.spyOn(console, "error").mockImplementation();
  const robin = new Robin(
    "<f a='fan' b='<foxes>'>some value &lt; \" &amp; data, &gt; '</f>"
  );
  let root: RootNode = robin.getRoot();
  const render = new Render({ transposeText: true, strictTranspose: true });
  expect(render.render(root)).toBe(
    `<f a="fan" b="<foxes>">\n  some value < " & data, > '\n</f>`
  );
  root = robin.parse("<f> &#xlt </f>");
  // should error during strictTranspose
  render.updateConfig({ toFile: true });
  expect(() => render.render(root)).toThrow();
  render.updateConfig({ strictTranspose: false });
  expect(() => render.render(root)).not.toThrow();
  root = robin.parse("<f> &leTTer </f>");
  // should error during strictTranspose
  render.updateConfig({ strictTranspose: true });
  expect(() => render.render(root)).toThrow();
  render.updateConfig({ strictTranspose: false });
  expect(() => render.render(root)).not.toThrow();
  // should error during strictTranspose - invalid character reference
  root = robin.parse("<f> &#lt </f>");
  render.updateConfig({ strictTranspose: true });
  expect(() => render.render(root)).toThrow();
  render.updateConfig({ toFile: false });
  expect(() => render.render(root)).toThrow();
  render.updateConfig({ strictTranspose: false });
  expect(() => render.render(root)).not.toThrow();
});

test("render RootNode", () => {
  const robin = new Robin("<f>some data</f>");
  const root: RootNode = robin.getRoot();
  const render = new Render();
  const rend: string = render.render(root);
  expect(rend).toBe("<f>\n  some data\n</f>");
  expect(render.renderRootNode(root)).toBe(rend);
});

test("render RootNode - cleanupEmptyElement", () => {
  const robin = new Robin("<g></g>");
  const root: RootNode = robin.getRoot();
  // cleanupEmptyElement - true by default
  const render = new Render();
  expect(render.render(root)).toBe(`<g/>`);
  render.updateConfig({ cleanupEmptyElement: false });
  expect(render.render(root)).toBe(`<g></g>`);
});

test("render CommentNode", () => {
  const data = "<!--some comment-->";
  const robin = new Robin(data);
  const root: RootNode = robin.getRoot();
  const render = new Render();
  const rend: string = render.render(root);
  expect(rend).toBe(data);
  const commentNode = <CommentNode>(
    robin.dom(root).find({ comment: { value: "some", match: "partial" } })
  );
  expect(render.renderCommentNode(commentNode)).toBe(rend);
});

test("render AttributeNode", () => {
  const data = "<a href='//fox'>some link</a>";
  const robin = new Robin(data);
  const root: RootNode = robin.getRoot();
  const render = new Render();
  const attr = (<ElementNode>robin.dom(root).find("a")).getAttributeNode(
    "href"
  ) as AttributeNode;
  expect(render.render(attr)).toBe(`href="//fox"`);
  render.updateConfig({ quoteStyle: "single" });
  expect(render.renderAttributeNode(attr)).toBe(`href='//fox'`);
});

test("render AttributeNode - quoteStyle", () => {
  const robin = new Robin("<g a='apple' b='ball' />");
  let root: RootNode = robin.getRoot();
  const render = new Render({ quoteStyle: "double" });
  expect(render.render(root)).toBe(`<g a="apple" b="ball"/>`);
  root = robin.parse(`<g a="apple" b="ball"/>`);
  render.updateConfig({ quoteStyle: "single" });
  expect(render.render(root)).toBe(`<g a='apple' b='ball'/>`);
  // inner quotes are considered
  root = robin.parse(`<g a="apple" b="there'd be a ball"/>`);
  expect(render.render(root)).toBe(`<g a='apple' b="there'd be a ball"/>`);
  // inner quotes are considered
  root = robin.parse(`<g a='good said "okay"' b='misc'/>`);
  render.updateConfig({ quoteStyle: "double" });
  expect(render.render(root)).toBe(`<g a='good said "okay"' b="misc"/>`);
});

test("render NamespaceNode", () => {
  const data =
    "<a href='//fox' xmlns:x='http://www.w3.org/2001/XMLSchema'>some link</a>";
  const robin = new Robin(data);
  const root: RootNode = robin.getRoot();
  const render = new Render();
  const elem = <ElementNode>robin.dom(root).find("a");
  expect(elem.namespaces.length).toBe(1);
  const ns = <NamespaceNode>elem.namespaces[0];
  expect(render.render(ns)).toBe(`xmlns:x="http://www.w3.org/2001/XMLSchema"`);
  render.updateConfig({ quoteStyle: "single" });
  expect(render.renderNamespaceNode(ns)).toBe(
    `xmlns:x='http://www.w3.org/2001/XMLSchema'`
  );
});

test("render PINode", () => {
  const data = "<?foo some bar?>";
  const robin = new Robin(data);
  const root: RootNode = robin.getRoot();
  const pi = <PINode>root.children[0];
  const render = new Render();
  expect(render.renderPINode(pi)).toBe(`<?foo some bar?>`);
});

test("render html document", () => {
  const data = loadData("sample.html");
  const robin = new Robin(data, "HTML");
  const render = new Render();
  expect(render.render(robin.getRoot())).toContain("html");
});

test("render xml document", () => {
  const data = loadData("sample.xml");
  const robin = new Robin(data, "XML");
  const render = new Render();
  expect(render.render(robin.getRoot())).toContain("tools");
});

test("render xml header", () => {
  const robin = new Robin("<?xml?>", "XML");
  const render = new Render();
  expect(render.render(robin.getRoot())).toBe("<?xml?>");
  expect(render.render(robin.parse("<?xml version='1.0'?>"))).toBe(
    '<?xml version="1.0"?>'
  );
});
