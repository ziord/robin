---
layout: default
title: Using Robin
parent: High-level APIs
nav_order: 2
---

# Using Robin
{: .no_toc }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

# Parsing

The `Robin` class provides an API that makes it easy and straight-forward to parse XML/HTML. It is also highly [configurable](#configurations).
The code snippets below shows how to parse XML and HTML.

## XML
In order to parse XML data, simply supply the `XML` parse-mode to the `Robin` constructor:

**In JavaScript**
{: .fs-3 }

```javascript
const { Robin } = require("@ziord/robin");
// parse the markup using XML parse-mode
new Robin("<tag>some xml markup</tag>", "XML");
```

**In TypeScript**
{: .fs-3 }

```typescript
import { Robin } from "@ziord/robin";
// parse the markup using HTML parse-mode
new Robin("<tag>some xml markup</tag>", "XML");
```

## HTML
Use the `HTML` parse-mode when parsing HTML:

**In JavaScript**
{: .fs-3 }

```javascript
const { Robin } = require("@ziord/robin");
// parse the markup using HTML parse-mode
new Robin("<p>some html markup</p>", "HTML");
```
TypeScript pretty much follows the same.
{: .fs-3 }

## parse()

Robin also includes a handy way for parsing documents which can foster re-usability of the `Robin` object:
```javascript
// passing a markup string to the constructor is completely optional
const robin = new Robin();
robin.parse("<p>some html markup</p>", "HTML");
```

If no parse-mode is provided, the default mode used is `XML`:

```javascript
const robin = new Robin();
robin.parse("<p>some markup</p>"); // XML parse-mode would be used here
```

## Mode Differences

There are a few differences between parsing in `XML` and `HTML` modes. The table below highlights these differences.

| XML mode                                                                                                             | HTML mode                                                                                                                        |
|:---------------------------------------------------------------------------------------------------------------------|:---------------------------------------------------------------------------------------------------------------------------------|
| All [namespaces](https://www.w3.org/TR/xml-names/) (default and prefixed) are processed and checked for correctness. | There are no namespaces except the default `xhtml` namespace. Prefixed namespaces are parsed as regular elements.                |
| Namespaced attributes are checked for well-formedness.                                                               | There are no namespaced attributes                                                                                               |
| Text cannot contain element markers (`<`) except in a `CDATA` section.                                               | Text can contain element markers as long as the next token isn't a valid [NameStartChar](https://www.w3.org/TR/xml/#NT-NameStartChar) |

## Configurations

The parser is highly configurable. You can configure its behaviour which would affect the way a document is parsed.
Here's a quick example:

**In JavaScript**
{: .fs-3 }

```javascript
const { Robin } = require("@ziord/robin");
// skip comments found in the document
new Robin("<tag>some markup</tag>", "HTML", { preserveComment: false });
```

Some configurations available and the parse-modes applicable are listed below:

| Configuration <Type>                                            | Effect                                                                                                                                  | Default Value | Mode Applicable    |
|:----------------------------------------------------------------|:----------------------------------------------------------------------------------------------------------------------------------------|:--------------|:-------------------|
| `preserveSpace`    &nbsp; <sub><sub>`boolean`</sub></sub>       | Preserve whitespaces around elements, comments, etc. as text                                                                            | `true`        | `HTML` and `XML`   |
| `preserveComment`  &nbsp; <sub><sub>`boolean`</sub></sub>       | Preserve comments found in the document                                                                                                 | `true`        | `HTML` and `XML`   |
| `preserveCdata`   &nbsp; <sub><sub>`boolean`</sub></sub>        | Preserve CDATA sections found in the document                                                                                           | `true`        | `HTML` and `XML`   |
| `preserveDtdStructure`   &nbsp; <sub><sub>`boolean`</sub></sub> | Preserve the original structure of the DTD. The structure is shortened if set to `false`                                                | `false`       | `HTML` and `XML`   |
| `documentName`    &nbsp; <sub><sub>`string`</sub></sub>         | Name of the document node (RootNode). This will be displayed if rendering the parsed document with the option  `showToplevelDocument`   | `Document`    | `HTML` and `XML`   |
| `allowMissingNamespaces`   &nbsp; <sub><sub>`boolean`</sub></sub> | Prevent the parser from throwing an error when the delcaration for namespaces referenced within elements and attributes cannot be found | `false`       | `XML`      |
| `showWarnings`      &nbsp; <sub><sub>`boolean`</sub></sub> | Show warnings reported by the parser                                                                                                    | `true`        | `HTML` and `XML`      |
| `allowDefaultNamespaceBindings`  &nbsp; <sub><sub>`boolean`</sub></sub> | Allow elements and attributes bind to the nearest default namespace, if not already bound to a namespace.                               | `true`        | `XML`       |
| `ensureUniqueNamespacedAttributes`   &nbsp; <sub><sub>`boolean`</sub></sub>  | Ensure namespaced attributes declared in an element are unique                                                                          | `true`        | `XML`        |

You can pass in multiple configuration values in one go. In the snippet below, CDATA sections and comments will be skipped completely by the parser during parsing.
This implies that there would be no comments/CDATA sections in the root (`RootNode`) returned by the parser.

**In TypeScript**
{: .fs-3 }

```typescript
import { Robin } from "@ziord/robin";
// skip CDATA sections and comments found in the document
const robin = new Robin("<tag><![CDATA[some fancy]]>some <!--ok-->markup</tag>", "HTML", { preserveCdata: false, preserveComment: false });

// .parse() also accepts configuration options 
robin.parse("<tag><![CDATA[some fancy]]>some <!--ok-->markup</tag>", "HTML", { preserveCdata: false, preserveComment: false });
```

# Obtaining Roots

After parsing the document, the `getRoot()` method is a handy way to obtain the document node. It returns a `RootNode` object and so does `.parse()`.
([See other available node types](#nodes)).

**In TypeScript**
{: .fs-3 }

```typescript
import { Robin, RootNode } from "@ziord/robin";
const robin = new Robin("<tag>some markup</tag>", "HTML");
// obtain the document/root node
const root: RootNode = robin.getRoot();
// .parse() also returns a RootNode object
const someRoot: RootNode = robin.parse("<tag><![CDATA[some fancy]]>some <!--ok-->markup</tag>", "HTML");
```

# Rendering
All [node types](#nodes) expose a `.prettify()` method which is used in rendering such node. For instance, the following snippet renders `root` (which is a `RootNode`):

```javascript
// pretty-print the document
console.log(root.prettify()); 
```

`Robin` also exposes a `.prettify()` method and a `prettyPrint()` method for pretty printing nodes.
Use `.prettify()` when the document string is passed to the `Robin` constructor directly for parsing:

```javascript
// parse a document: <tag>some markup</tag>
const robin = new Robin("<tag>some markup</tag>");
// pretty print the parsed document
console.log(robin.prettify());
```

Use `.prettyPrint()` when pretty-printing a standalone [node](#nodes):
```javascript
// parse a document: <tag>some markup</tag>
const robin = new Robin("<tag>some markup</tag>");
// obtain the document/root node (RootNode)
const root = robin.getRoot(); 
// pretty print a node
console.log(robin.prettyPrint(root));
```

## Configurations
It is possible to configure the renderer, when `prettify`ing or `prettyPrint`ing a [node](#nodes). 

```javascript
const robin = new Robin("<a></a>");
// in prettify()
console.log(robin.prettify({ showToplevelDocument: true }));
// renders:
// <Document>
//  <a/>
// </Document>

// in prettyPrint()
console.log(robin.prettyPrint(robin.getRoot(), { showToplevelDocument: true, cleanupEmptyElement: false }));
// renders:
// <Document>
//   <a></a>
// </Document>
```

The render configurations available and their effects are listed below:

| Configuration                                                  | Effect                                                                                | Default Value | Mode Applicable    |
|:---------------------------------------------------------------|:--------------------------------------------------------------------------------------|:--------------|:-------------------|
| `indentSize`    &nbsp; <sub><sub>`number`</sub></sub>          | Indentation size for nested nodes (elements, comments, texts, etc.)                   | `2`           | `HTML` and `XML`   |
| `showToplevelDocument`  &nbsp; <sub><sub>`boolean`</sub></sub> | Display the document name as the top level container for the parsed document          | `false`       | `HTML` and `XML`   |
| `transposeText`   &nbsp; <sub><sub>`boolean`</sub></sub>       | Perform text transpositions when rendering (for example `&amp;` -> `&`)               | `true`        | `HTML` and `XML`   |
| `strictTranspose`   &nbsp; <sub><sub>`boolean`</sub></sub>     | Apply strict transformations when `transposeText` is set to `true`                    | `false`       | `HTML` and `XML`   |
| `cleanupEmptyElement`    &nbsp; <sub><sub>`boolean`</sub></sub> | Represent empty elements as self-enclosing (for example: `<a></a>` -> `<a/>`          | `true`        | `HTML` and `XML`   |
| `toFile`   &nbsp; <sub><sub>`boolean`</sub></sub>              | Transpose texts with the notion that the transformed text is to be written to a file  | `false`       | `HTML` and `XML`      |
| `quoteStyle`      &nbsp; <sub><sub>`string`</sub></sub>        | Quote style for attributes within elements. Acceptable values are`double` or `single` | `double`      | `HTML` and `XML`      |


# Nodes

There are a number of node types available in Robin. The parser transforms a document string into one or more of these node objects, which one can easily interact with.
The table below highlights the node types and the parse-mode in which they are available:

| Node Type                                                | Description                                                                                     | Example                                              | Available In     |
|:---------------------------------------------------------|:------------------------------------------------------------------------------------------------|:-----------------------------------------------------|:-----------------|
| `ElementNode`                                            | An XML/HTML element                                                                             | `<element></element>`                                | `HTML` and `XML` |
| `TextNode`                                               | A piece of text in the document                                                                 | `some fancy text`                                    | `HTML` and `XML` |
| `AttributeNode`                                          | An attribute declared in an element                                                             | `<fox a="5" id="10"/>`                               | `HTML` and `XML` |
| `NamespaceNode`  | A namespace declared in an element. (Only _default_ namespaces would be created in `HTML` mode) | `<fox xmlns:a="some-uri" xmlns="some-default-uri"/>` | `HTML` and `XML` |
| `RootNode`     | Virtual node representing the entire document                                                   |                                                      | `HTML` and `XML` |
| `CommentNode`     | A comment in the document                                                                       | `<!--hey I'm a comment-->`                           | `HTML` and `XML` |
| `PINode`        | A processing instruction in the document                                                        | `<?pi some string value?>`                           | `HTML` and `XML` |
| `DTDNode`           | A document type declaration                                                                     | `<!DOCTYPE html>`                                    | `HTML` and `XML` |
| `XMLDeclNode`      | The XML prolog header declaration                                                               | `<?xml version="1.0" encoding="utf-8"?>`             | `XML` |

The `ElementNode` and `RootNode` are known as parent nodes.
A more extensive documentation on each node type can be found [here.](/robin/docs/low-level-apis/nodes)

---

# DOM

One can interact with a parsed document by using a number of _custom_ DOM utilities available in the [DOM API.](/robin/docs/low-level-apis/dom)
These utilities can be used in selecting, updating, deleting, and creating [nodes](#nodes). `Robin` provides a little abstraction over the DOM API by exposing a `.dom()` property with which one can access any of the available DOM utilities.

## .dom()
This is a property of the `Robin` object. It is typically used like so:

```typescript
robin.dom(node);
```
`node` can be any of the [node types](#nodes). `.dom()` returns an instance of the `DOM` class, which provides access to several utilities for interacting with a document.

## Selection
Any of the major node types can be selected using a number of selection utilities available in the DOM API.
Here we discuss the `find`, `findAll`, `findChildren` and `text` methods. Other methods can be found [here.](/robin/docs/low-level-apis/dom)
It is possible to select some nodes directly or through the use of filters. This is exemplified in this section. 

**Note**: All examples in this section are in TypeScript but can as well be done in plain JavaScript. Also, some parts of the code are skipped for brevity.
{: .fs-1 }

### find()
The `find()` method can be used in selecting elements, comments, processing-instructions, and texts (nodes). It returns the first node in the document (in document order) that matches the selection criteria.

**Selecting an Element**
{: .fs-3 }

```ts
import { Robin, ElementNode, RootNode } from "@ziord/robin";

const robin = new Robin("<div id='1'>some value<span id='2'>123456</span></div>", "HTML");
const root: RootNode = robin.getRoot();
// find 'span' element
const element = robin.dom(root).find<ElementNode>("span")!;
// find 'div' element
const element2 = robin.dom(root).find<ElementNode>({ name: "div" })!; // an alternative way of providing the element's name
```

**Selecting a Comment**
{: .fs-3 }

```ts
import { CommentNode } from "@ziord/robin";
// given a document: <fox><!--a comment--></fox>
const comment = robin.dom(root).find<CommentNode>({comment: "a comment"})!; // select the comment node: <!--a comment-->
```

What if you do not want to pass in the entire string-value of the comment when trying to select it? Or perhaps you just wanted to select a comment whose string-value contains a particular string?
This is provided for. You can pass in an object as the value for the `comment` key. This object has the following signature:

```
 {
  value: string;     // the value you would like to match on 
  match: MatchType;  // the type of match. See MatchType below.
  trim?: boolean;    // should whitespace be trimmed off the value of the node with which the match is to be made?
}
```

`MatchType` is given as:
```
MatchType = "partial" | "exact" | "partial-ignoreCase" | "exact-ignoreCase";
```
- `partial` matches a value partially.
- `exact` matches a value exactly.
- `partial-ignoreCase` matches a value partially, ignoring case.
- `exact-ignoreCase` matches a value exactly, ignoring case.

Here's an example use-case:

```ts
// given a document: <fox><!--a comment--></fox>
// select the comment node: <!--a comment-->
const comment = robin.dom(root).find<CommentNode>({ comment: { value: "a", match: "partial" }})!; 
```

Given a document `<foo><!--   some fancy text   --></foo>`. The code below selects the comment node:

```ts
const comment = robin.dom(root).find<CommentNode>(
  { comment: { value: "some fancy text", match: "exact", trim: true }}  // notice trim makes "some fancy text" an exact match
)!; 
```

**Selecting a Text**
{: .fs-3 }

```ts
import { TextNode } from "@ziord/robin";
// given a document: <fox>some text</fox>
const text = robin.dom(root).find<TextNode>({ text: "some text" })!; // select the text node: "some text"
```

Or even better:

```ts
// given a document: <fox>some text</fox>
const text = robin.dom(root).find<TextNode>({ text: {value: "some", match: "partial" }})!; // select the text node: "some text"
```

**Selecting a Processing Instruction**
{: .fs-3 }

```ts
import { PINode } from "@ziord/robin";
// given a document: <fox><?good a pi stuff ?></fox>
const pi = robin.dom(root).find<PINode>({ target: "good" })!; // select the processing instruction with target 'good'
```

Alternatively:

```ts
// given a document: <fox><?good a pi stuff ?></fox>
// select the processing instruction with string-value 'Pi Stuff'
const pi = robin.dom(root).find<TextNode>({ target: { value: "Pi Stuff", match: "partial-ignoreCase" }})!;
```

### findAll()
The `findAll()` method returns an array of all nodes in the document (in document order) that matches the selection criteria.
The code below selects all `div` elements.

```ts
import { ElementNode } from "@ziord/robin";
// returns an array of element nodes
const elems = robin.dom(root).findAll<ElementNode>("div")!;
```
`findAll()` accepts all arguments acceptable by `find()`.

### findChildren()
The `findChildren()` method returns an array of nodes that are children of the first parent node (in document order) which satisfies the selection criteria.
The code below selects all children of the first `div` element.

```ts
import { ElementNode } from "@ziord/robin";
// given a document <html><div>text <!--comment--> another text <p>some paragraph</p></div></html>
// this returns an array of nodes which are the children of the `div` element if found, else an empty array.
const elems = robin.dom(element).findChildren("div")!;
// elems contains nodes:
// [
//  text,
// <!--comment-->,
//  another text,
//  <p>some paragraph</p>
// ]
```
`findChildren()` accepts all arguments acceptable by `find()`.

### text()
The `text()` method returns a string concatenation of all `TextNode`s in an `ElementNode` or `RootNode`.

**In JavaScript**
{: .fs-3 }
```javascript
// given a document <html><div>text <!--comment--> another text <p>some paragraph</p></div></html>
console.log(robin.dom(element).text()); // text  another text some paragraph

// you can also provide a concatenation string argument
console.log(robin.dom(element).text("---")); // text  ---another text ---some paragraph
```
`text()` also accepts a `recursive` second parameter (defaults to `true`) which controls if texts in nested elements should be included or not.

### filters

Sometimes, you may need to select a node based on some particular logic. Up until now, none of the approaches described so far can handle that.
This is why most selection methods accept a `filter` function. Say we want to select all elements having names starting with "d":

**In JavaScript**
{: .fs-3 }
```javascript
const { isElement } = require("@ziord/robin");

robin.dom(root).findAll({filter: (node) => {
  // select all elements with name starting with "d"
  return isElement(node) && node.name.qname.startsWith("d");
  }}
);
```

**In TypeScript**
{: .fs-3 }
```typescript
import { isElement, RNodeT } from "@ziord/robin";
// RNodeT is a union of all the node types
robin.dom(root).findAll({filter: (node: RNodeT) => {
  // select all elements with name starting with "d"
  return isElement(node) && node.name.qname.startsWith("d");
  }}
);
```
Robin provides a number of filters known as `DOMFilters` if you prefer not to write your own. One of such filters (`ElementFilter`) is discussed below.

**ElementFilter**
{: .fw-600 .fs-4 }
This filter is dedicated to selecting elements. Here's a usage example:

```typescript
import { DOMFilter } from "@ziord/robin";
// find all `div` elements
robin.dom(root).findAll({filter: DOMFilter.ElementFilter("div")});
// find all `div` elements having `id` and `class` attributes
robin.dom(root).findAll({filter: DOMFilter.ElementFilter("div", ["id", "class"])});
// find all `div` elements having `id="1"` and `class="2"` attributes
robin.dom(root).findAll({filter: DOMFilter.ElementFilter("div", {id: 1, class: 2})});
```

Other filters available are `AttributeFilter`, `CommentFilter`, `TextFilter`, and `PIFilter`.

## Update

`Robin` also provides utilities for updating nodes in the DOM. In this section we see three of such utilities: `insertBefore`, `insertAfter`, and `addChild`.
See the complete API [here](/robin/docs/low-level-apis/dom).

**Note**: All examples in this section are in TypeScript but can as well be done in plain JavaScript. Also, some parts of the code are skipped for brevity.
{: .fs-1 }

### insertBefore()

Just as the name suggests, `insertBefore` inserts one node before another node in the DOM. Here's an example:

```typescript
// insert `divElem` element before `sectionElem` element in the DOM
const isInserted: boolean = robin.dom(sectionElem).insertBefore(divElem);
```

### insertAfter()

This is quite the reverse of `insertBefore`. `insertAfter` inserts one node after another node in the DOM. Here's an example:

```typescript
// insert `divElem` element after `sectionElem` element in the DOM
const isInserted: boolean = robin.dom(sectionElem).insertAfter(divElem);
```

### addChild()

`addChild` adds one node as the child of another node in the DOM, provided the other node is a parent node (`ElementNode | RootNode`). Here's an example:

```typescript
// add `divElem` element as a child of `sectionElem` element in the DOM
const isAdded: boolean = robin.dom(sectionElem).addChild(divElem);
```

## Creation

`Robin` also provides utilities for programmatically creating XML/HTML documents (the DOM and nodes in it). In this section we see three of such utilities: `createElement`, `createAttribute`, and `createComment`.
See the complete API [here](/robin/docs/low-level-apis/dom).

**Note**: All examples in this section are in TypeScript but can as well be done in plain JavaScript. Also, some parts of the code are skipped for brevity.
{: .fs-1 }

### createElement()

`createElement` creates a new element node given its local name and an optional namespace prefix. Here's an example:

```typescript
import { DOM, ElementNode } from "@ziord/robin";
const dom = new DOM();
// create an element `foo`
const fooElement: ElementNode = dom.createElement("foo"); // local-name
console.log(fooElement.prettify());  // <foo/>
// create an element bar:good
const goodElement: ElementNode = dom.createElement("good", "bar"); // local-name, prefix
console.log(goodElement.prettify());  // <bar:good/>
```

### createAttribute()

`createAttribute` creates a new attribute node given its local name, value and an optional namespace prefix. Here's an example:

```typescript
import { DOM, AttributeNode } from "@ziord/robin";
const dom = new DOM();
// create an attribute `id="1"`
const idAttribute1: AttributeNode = dom.createAttribute("id", "1"); // local-name, value
console.log(idAttribute1.prettify());  // id="1"
// create an attribute `simple:id="2"`
const idAttribute2: AttributeNode = dom.createAttribute("id", "2", "simple"); // local-name, value, prefix
console.log(idAttribute2.prettify());  // simple:id="2"
```

### createComment()

`createComment` creates a new comment node given its string value. Here's an example:

```typescript
import { DOM, CommentNode } from "@ziord/robin";
const dom = new DOM();
// create a comment <!--the content of the comment-->
const comment: CommentNode = dom.createComment("the content of the comment"); // value
console.log(comment.prettify());  // <!--the content of the comment-->
```

## Deletion

`Robin` provides utilities for deleting nodes from the DOM. In this section we see three of such utilities: `drop`, `dropChildren`, and `dropAttribute`.
See the complete API [here](/robin/docs/low-level-apis/dom).

**Note**: All examples in this section are in TypeScript but can as well be done in plain JavaScript. Also, some parts of the code are skipped for brevity.
{: .fs-1 }

### drop()

`drop` drops the current node from the DOM. This severs the connection of that node to other nodes in the DOM. Here's an example:

```typescript
import { RParentNodeT } from "@ziord/robin";
const parent = <RParentNodeT>robin.dom(element).parent;
console.log("before:", parent.prettify());
const isDropped: boolean = robin.dom(element).drop();
console.log("isDropped:", isDropped);
console.log("after:", parent.prettify());
```

### dropChildren()

`dropChildren` works like `drop()` but drops all descendant nodes matching a given criteria. Here's an example:

```typescript
// `RNodeT` type is the union of all node types
import { RParentNodeT, RNodeT, isElement } from "@ziord/robin";
// `someParent` could be an ElementNode or a RootNode
console.log("before:", someParent.prettify());
// drop elements starting with "p"
const filter = (node: RNodeT) => {
  return isElement(node) && node.name.qname.startsWith("p");
}
const isDropped: boolean = robin.dom(someParent).dropChildren(filter);
console.log("isDropped:", isDropped);
console.log("after:", someParent.prettify());
```

`dropChildren` recursively searches for nodes that satisfy the `filter` criteria. If you wish to disable this recursive search, simply set `recursive` to `false`.

```typescript
robin.dom(someElement).dropChildren(filter, false); // recursive=false
```

### dropAttribute()

`dropAttribute` drops an attribute node from its parent element, and therefore the DOM. Here's an example:

```typescript
// `element` is an ElementNode
console.log("before:", element.prettify());
// drop attribute "id" from `element`
const isDropped: boolean = robin.dom(element).dropAttribute("id");
console.log("isDropped:", isDropped);
console.log("after:", element.prettify());
```

---

# XPath

One can also interact with a parsed document by using a number of utilities available in the XPath API. 
These utilities can _only_ be used in selecting all kinds of nodes. Robin provides a little abstraction over the XPath API by exposing a `.path()` property with which one can access any of the available XPath utilities.

## .path()
This is a property of the `Robin` object. It is typically used like so:

```typescript
robin.path(node);
```
`node` must be a `RootNode`. However, if you supply an `ElementNode` you must provide a second `boolean` parameter - `allowCopy`.
If set to `true`, the element would be cloned, and the clone attached to a synthetic `RootNode`. If set to `false`, the XPath engine would try to locate the actual `RootNode` using the element provided. 
If the `RootNode` is not found, the engine would error. <br/> 
`.path()` returns an instance of the `XPath` class, which provides access to methods for interacting with a document.

## Selection
Any of the node types can be selected using a number of selection utilities available in the XPath API.
The API provides a `query`, `queryAll`, and `queryOne` methods. See [the API](/robin/docs/low-level-apis/xpath) for more information.

**Note**: All examples in this section are in TypeScript but can as well be done in plain JavaScript. Also, some parts of the code are skipped for brevity.
{: .fs-1 }

### query()
The `query()` method accepts an XPath expression as a `string` and returns an `XDataCType` - which could be a `number`, `boolean`, `string` or `Set` of nodes (nodeset).

```ts
import { CommentNode, XNodeSet } from "@ziord/robin";
// given a document: <fox><!--a comment--></fox>
// select all comments in the document -  returns a set of comments
const comment = XNodeSet<CommentNode>robin.path(root).query("//comment()");
```

### queryOne()
The `queryOne()` method accepts an XPath expression as a `string` and returns an `XReturnType` (which could be a `number`, `boolean`, `string` or a particular node type) or `null` if nothing was found.

```ts
import { ElementNode } from "@ziord/robin";
// given a document: <fox><!--a comment--></fox>
// select one element in the document 
const element = robin.path(root).queryOne<ElementNode>("//*")!;
```

### queryAll()
The `queryAll()` method accepts an XPath expression as a `string` and returns an `XReturnType[]` (which could be an array of `number`, `boolean`, `string` or a type of node) or an empty array if nothing was found.

```ts
import { ElementNode } from "@ziord/robin";
// given a document: <fox><foo></foo><bar/></fox>
// select all elements in the document 
const elements = robin.path(root).queryAll<ElementNode>("//*")!; // ElementNode[]
```
