## Project Architecture

This page provides a quick glimpse into the project's current implementation and design approach.

Below is an overview of the project architecture:
<br/>

<p align="center">
    <img src="https://github.com/ziord/robin/blob/master/docs/assets/architecture_img_1.png" alt="architecture-image-1">
</p>

<br/>

The parser is flexible and stand-alone, and would parse XML and HTML documents into a single (root) node. The root node produced from the parser can be served to the XPath engine, which would perform XPath queries on it, and also the DOM API which provides several convenience utilities for interacting with the parsed document.
The Robin API provides an abstraction over both the XPath and DOM APIs, making it easier to utilize either or both.


### XPath
A parsed document can be queried using the xpath engine which supports the xpath 1.0 specification with some exclusions mentioned [below](#xpath-non-supported). The engine receives an XPath query string and a node object, as input and produces an `XDataCType (number | string | boolean | nodeset)`, as its output/result. The query string is parsed into an AST (Abstract Syntax Tree) which is then evaluated along with the node object received.

<p align="center">
    <img src="https://github.com/ziord/robin/blob/master/docs/assets/architecture_img_2.png" alt="architecture-image-2">
</p>

<a name='xpath-non-supported'></a>
XPath features not supported include:
- Normalization of attribute values
- Normalization of namespace URIs.

Bonus feature supported includes:
- Comments (from xpath 2.0)


### DOM
The DOM interface provides useful functions for manipulating the (parsed) XML and HTML documents which can be used in tandem with the XPath interface resulting in a powerful combination.


### Operations
* XPath:
    *Operations*
    - Selection
        -   enables selection of any kind of node, wherever they are in the document.
            It can also be used to select nodes, based on some complex logic. It does not allow deletion or update however.
    - Arithmetic evaluation and expression computation
        - supports computation of arbitrary expressions supported by the XPath 1.0 specification.

* DOM:
    *Operations* 
    - Creation, Selection, Update, Deletion
        - It allows selection of nodes anywhere in the document.
        - It also exposes a number of utilities that enable selection, creation, update, and deletion of nodes. XML/HTML documents can be created programmatically using these features.
