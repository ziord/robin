import { Robin, ParseMode, RootNode, RNodeT } from "../src";

declare function loadData(filename?: string): string;

describe("robin api tests", () => {
  test("initializing robin with markup", () => {
    expect(new Robin("<a></a>", "HTML").toString()).toBe("<a/>");
  });

  test("initializing robin without markup", () => {
    expect(new Robin().toString()).toBe("");
  });

  test("Using a wrong parse mode should fail", () => {
    expect(() => new Robin("<foo>not good</foo>", <ParseMode>"XYZ")).toThrow(
      "Unrecognized parse mode. Parse mode should either be 'XML' or 'HTML'"
    );
  });

  test(".parse() should return the root node", () => {
    const markup = "<a>some data<b>other</b></a>";
    const robin = new Robin();
    const root: RootNode = robin.parse(markup);
    expect(root).toEqual(robin.getRoot());
  });

  test("prettify should pretty-print", () => {
    const markup = "<a>some data<b></b></a>";
    const robin = new Robin();
    const root: RootNode = robin.parse(markup);
    const pretty = "<a>\n  some data\n  <b/>\n</a>";
    expect(robin.prettify()).toEqual(pretty);
    expect(robin.prettyPrint(root)).toEqual(pretty);
    expect(new Robin().prettyPrint(null as unknown as RNodeT)).toBe("");
    // default indentation is 2
    const node = robin.parse(loadData());
    expect(robin.dom(node).find("tool")!.prettify({ indentSize: 1 })).toBe(
      '<tool id="1" mode="xml">\n xml parsing\n</tool>'
    );
  });

  test("comments should be ignored", () => {
    const markup = "<a>some data<!--some funny comment--><b></b></a>";
    const robin = new Robin(markup, "XML", { preserveComment: false });
    const pretty = "<a>\n  some data\n  <b/>\n</a>";
    expect(robin.prettify()).toEqual(pretty);
  });

  test("cdata should be ignored", () => {
    const markup = "<a>some data<![CDATA[aha!]]><b></b></a>";
    const robin = new Robin(markup, "XML", { preserveCdata: false });
    const pretty = "<a>\n  some data\n  <b/>\n</a>";
    expect(robin.prettify()).toEqual(pretty);
  });

  test("excess space should be ignored", () => {
    const markup = `
  <?xml version="1.0"?>
  <!DOCTYPE tools>
  <tools>
              
              some content
        <blue></blue>
        this is robin     
  </tools>
  `;
    const robin = new Robin(markup, "XML", { preserveSpace: false });
    const pretty = `
<?xml version="1.0"?>
<!DOCTYPE tools>
<tools>
  some content
  <blue/>
  this is robin
</tools>`;
    expect(robin.prettify()).toEqual(pretty.trim());
  });

  test("empty element rendering", () => {
    const robin = new Robin("<a></a>", "XML", { preserveCdata: false });
    expect(robin.prettify()).toEqual("<a/>");
    const root: RootNode = robin.parse("<p>some foo <div></div></p>", "HTML");
    expect(robin.prettyPrint(root, { cleanupEmptyElement: false })).toBe(
      "<p>\n  some foo\n  <div></div>\n</p>"
    );
  });
});
