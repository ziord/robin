
<p align="center">
    <p align="center">
        <img src="https://github.com/ziord/robin/blob/master/docs/assets/robin_img.png" alt="robin img"> 
    </p>
    <p align="center">
        <a href="https://github.com/ziord/robin/actions">
            <img alt="ci status" src="https://github.com/ziord/robin/actions/workflows/node.js.yml/badge.svg?style=plastic">
        </a>
        <a href="https://www.typescriptlang.org/">
            <img alt="built with TypeScript" src="https://img.shields.io/badge/built%20with-TypeScript-blue.svg?style=plastic">
        </a>
        <a href="https://github.com/ziord/robin/blob/master/LICENSE.txt">
            <img alt="robin license" src="https://img.shields.io/github/license/ziord/robin?style=plastic">
        </a>
        <a href="https://github.com/ziord/robin/issues" >
            <img alt="issues" src="https://img.shields.io/github/issues/ziord/robin?style=plastic">
        </a>
        <a href="https://github.com/ziord/robin/stargazers">
            <img alt="stars" src="https://img.shields.io/github/stars/ziord/robin?style=plastic">
        </a>
        <a href="https://github.com/ziord/robin/network/members">
            <img alt="forks" src="https://img.shields.io/github/forks/ziord/robin?style=plastic">
        </a>
        <a href=""><img src="https://wakatime.com/badge/user/d428bbee-8cff-4d0f-9e46-7c57e2a8032e/project/9d7c1f69-dd34-4f27-a25d-60fbfa716192.svg" alt="wakatime"></a>
    </p>
</p>

Robin is an XML parser and processing library that supports a sane version of HTML. It features a set of DOM utilities, including support for XPath 1.0 for interacting with and manipulating XML/HTML documents. Typical use-cases would be processing XML or HTML files, web scraping, etc.
Worthy to note that robin is a non-validating parser, which means that DTD structures are not used for validating the markup document.

## Quick Start

All samples below are for the Node.js runtime.

#### Parsing a Document

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
<br/>

#### Finding an Element Using the DOM API

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
<br/>

#### Finding an Element Using XPath

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
<br/>

#### Finding an Attribute

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
<br/>

#### Finding a Text

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
<br/>

#### Finding a Comment

TypeScript

```ts
import { CommentNode } from "@ziord/robin";
// find a comment
const comment = robin.dom(robin.getRoot()).find<CommentNode>({comment: { value: "some part of the comment", match: "partial" }})!; // match: "partial" | "exact" | "partial-ignoreCase" | "exact-ignoreCase"
console.log(comment.stringValue());
```
<br/>

#### Extracting Texts From an Element

JavaScript
```js
// get the element's textual content
let text = robin.dom(element).text(); // string
console.log(text);

// alternatively
text = element.stringValue();
console.log(text);
```

See the [web scraper example](https://github.com/ziord/robin/blob/master/examples) for more usage.


## Documentation

This is still a work in progress. Take a look at the [examples](https://github.com/ziord/robin/blob/master/examples) for now.

## Quick Questions

If you have little questions that you feel isn't worth opening an issue for, use [the project's discussions.](https://github.com/ziord/robin/discussions)


## Installation

Simply run the following command in your terminal:
```
npm install @ziord/robin
```

## Contributing

Contributions are welcome! See the [contribution guidelines](https://github.com/ziord/robin/blob/master/CONTRIBUTING.md) to learn more. Thanks!


## Reporting Bugs/Requesting Features

Please [open an issue.](https://github.com/ziord/robin/issues) Checkout the [issue template.](https://github.com/ziord/robin/blob/master/.github/ISSUE_TEMPLATE)


## License

Robin is distributed under the [MIT License](https://github.com/ziord/robin/blob/master/LICENSE.txt).