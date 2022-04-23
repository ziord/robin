/**
 * scraping the first few pages of scrapeme.live/shop
 * info to be scraped:
 * item:
 * name, description, price, image-url, amount-left?
 */

import axios from "axios";
import { AttributeNode, ElementNode, Robin, TextNode } from "../../dist";

const url = "https://scrapeme.live/shop/";
const pages: string[] = [url, url + "page/2/", url + "page/3/"];

const extractItemUrls = async (page: string) => {
  const resp = await axios.get(page);
  const robin = new Robin(resp.data, "HTML");
  // console.log(robin.prettify());
  const attrs = robin
    .path(robin.getRoot())
    .queryAll<AttributeNode>(
      "//a[@class='woocommerce-LoopProduct-link woocommerce-loop-product__link']/@href"
    );
  const links = [];
  for (const attr of attrs) {
    links.push(attr.value);
  }
  return links;
};

const scrapeItem = async (link: string, robin: Robin) => {
  // load page
  const resp = await axios.get(link);
  const root = robin.parse(resp.data, "HTML");

  // item name
  const itemName = robin
    .path(root)
    .queryOne<TextNode>("//h1[@class='product_title entry-title']/text()")!
    .stringValue()
    .trim();

  const m: ElementNode = robin.dom(root).find("fox")!;

  // price
  const itemPrice = robin
    .path(root)
    .queryOne<ElementNode>("//p[@class='price']")!
    .stringValue()
    .trim();

  // description=
  const itemDesc = robin
    .path(root)
    .queryOne<TextNode>(
      "//div[@class='woocommerce-product-details__short-description']/p/text()"
    )!
    .stringValue()
    .trim();

  // image
  const itemImage = robin
    .path(root)
    .queryOne<AttributeNode>(
      "//div[@class='woocommerce-product-gallery__image']/a/attribute::href"
    )!.value;

  // amount left
  const itemAmountLeft = robin
    .path(root)
    .queryOne<TextNode>("//p[@class='stock in-stock']/text()")!
    .stringValue()
    .trim();
  return {
    name: itemName,
    price: itemPrice,
    image: itemImage,
    description: itemDesc,
    amountLeft: itemAmountLeft,
  };
};

const scrapePage = async (page: string) => {
  const links = await extractItemUrls(page);
  const data = [];
  const robin = new Robin();
  for (const link of links) {
    data.push(await scrapeItem(link, robin));
  }
  return data;
};

const scrape = async () => {
  console.log("Scraping the first", pages.length, "pages...");
  const result = [];
  let i = 0;
  for (const page of pages) {
    i++;
    result.push(...(await scrapePage(page)));
    console.log("done scraping page", i, "...");
  }
  return result;
};

scrape()
  .then((result) => {
    console.log(result);
    console.log("Found", result.length, "results.", "\ndone!");
  })
  .catch((e) => console.log(e));
