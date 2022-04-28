---
layout: default
title: Quick Start
nav_order: 2
---

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

# Quick Start

This page delves into the use of the library without going into too many details. For more in-depth descriptions, please take a look at [using the APIs](/robin/docs/high-level-apis).
All code samples below are for the Node.js runtime.

## Parsing a Document

JavaScript
```js
const { Robin } = require("@ziord/robin");

const robin = new Robin("<tag id='1'>some value<data id='2'>123456</data></tag>", "XML"); // use "XML" mode - which is the default mode - for XML documents ("HTML" for HTML documents)

// pretty-printing the document
console.log(robin.prettify());

// alternatively
// const root = new Robin().parse("...some markup...");
// console.log(root.prettify());
```

TypeScript
```ts
import { Robin } from "@ziord/robin";

const robin = new Robin("<div id='1'>some value<span id='2'>123456</span></div>", "HTML"); // mode "HTML" for HTML documents
console.log(robin.prettify());
```

## Finding an Element Using the DOM API

<sub>**By Name**</sub>

JavaScript

```js
// find "data" element
const element = robin.dom(robin.getRoot()).find("data");

// pretty-print the element
console.log(element.prettify());
```

TypeScript

```ts
// find "data" element
import { ElementNode } from "@ziord/robin";

const element = robin.dom(robin.getRoot()).find<ElementNode>("span")!;

// pretty-print the element
console.log(element.prettify());
```

<sub>**By Filters**</sub>

JavaScript

```js
const { DOMFilter } = require("@ziord/robin");

const root = robin.getRoot();
// find the first "data" element
robin.dom(root).find({filter: DOMFilter.ElementFilter("data")});

// find the first element having attribute "id"
robin.dom(root).find({filter: DOMFilter.AttributeFilter("id")});

// find the first element having attributes "id", "foo"
robin.dom(root).find({filter: DOMFilter.AttributeFilter(["id", "foo"])});

// find the first element having attribute "id"="2"
robin.dom(root).find({filter: DOMFilter.AttributeFilter({ id: "2" })});

// find the first "data" element having attribute "id"="2"
robin.dom(root).find({filter: DOMFilter.ElementFilter("data", { id: "2" })});
```
The TypeScript variant pretty much follows the same logic. There are also lots of other utility functions available in the API.

## Finding an Element Using XPath

<sub>**By Queries**</sub>

JavaScript

```js
// find "data" element
const element = robin.path(robin.getRoot()).queryOne("/tag/data");

// pretty-print the element
console.log(element.prettify());
```

TypeScript

```ts
// find "data" element
import { ElementNode } from "@ziord/robin";

const element = robin.path(robin.getRoot()).queryOne<ElementNode>("//span")!;

// pretty-print the element
console.log(element.prettify());
```
The XPath API also provides other utilities such as `query`, and `queryAll`

## Finding an Attribute

<sub>**From an element**</sub>

JavaScript

```js
// find "attributeKey" attribute
const attribute = element.getAttributeNode("attributeKey");
console.log(attribute.prettify());
```

<sub>**From the DOM using the DOM API**</sub>

JavaScript

```js
// find "attributeKey" attribute from any "foo" element
const attribute = robin.dom(robin.getRoot()).findAttribute("foo", "attributeKey");
console.log(attribute.prettify());
console.log("key:", attribute.name.qname, "value:", attribute.value);
```

<sub>**From the DOM using the XPath API**</sub>

TypeScript

```ts
import { AttributeNode } from "@ziord/robin";
// find "attributeKey" attribute from any "foo" element
const attribute = robin.path(robin.getRoot()).queryOne<AttributeNode>("//foo[@attributeKey]/@attributeKey")!;
console.log("key:", attribute.name.qname, "value:", attribute.value);
```

## Finding a Text

<sub>**From the DOM using the DOM API**</sub>

TypeScript

```ts
import { TextNode } from "@ziord/robin";
// find any text
const text = robin.dom(robin.getRoot()).find<TextNode>({text: { value: "some part of the text", match: "partial-ignoreCase" }})!; // match: "partial" | "exact" | "partial-ignoreCase" | "exact-ignoreCase"
console.log(text.stringValue());
```

<sub>**From the DOM using the XPath API**</sub>

TypeScript

```ts
import { TextNode } from "@ziord/robin";
// find any text
const text = robin.path(robin.getRoot()).queryOne<TextNode>("(//text())[1]")!;
console.log(text.stringValue());
console.log(text.prettify());
```

## Finding a Comment

TypeScript

```ts
import { CommentNode } from "@ziord/robin";
// find a comment
const comment = robin.dom(robin.getRoot()).find<CommentNode>({comment: { value: "some part of the comment", match: "partial" }})!; // match: "partial" | "exact" | "partial-ignoreCase" | "exact-ignoreCase"
console.log(comment.stringValue());
```

## Extracting Texts From an Element

JavaScript
```js
// get the element's textual content
let text = robin.dom(element).text(); // string
console.log(text);

// alternatively
text = element.stringValue();
console.log(text);
```
