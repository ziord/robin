/**
 * scraping the first few pages of scrapeme.live/shop
 * info to be scraped:
 * item:
 * name, description, price, image-url, amount-left?
 */

const axios = require("axios");
const { DOMFilter, Robin } = require("../../dist");

const url = "https://scrapeme.live/shop/";
const pages = [url, url + "page/2/", url + "page/3/"];

const extractItemUrls = async (page) => {
  const resp = await axios.get(page);
  const robin = new Robin(resp.data, "HTML");
  // console.log(robin.prettify());
  const elems = robin.dom(robin.getRoot()).findAll({
    filter: DOMFilter.ElementFilter("a", {
      class: "woocommerce-LoopProduct-link woocommerce-loop-product__link",
    }),
  });
  const links = [];
  for (const a of elems) {
    links.push(a.getAttributeNode("href").value);
  }
  return links;
};

const scrapeItem = async (link, robin) => {
  // load page
  const resp = await axios.get(link);
  const root = robin.parse(resp.data, "HTML");
  // console.log(robin.prettify());

  // item name
  const h1 = robin.dom(root).find({
    filter: DOMFilter.ElementFilter("h1", {
      class: "product_title entry-title",
    }),
  });
  const itemName = h1.stringValue().trim();

  // price
  const span = robin.dom(root).find({
    filter: DOMFilter.ElementFilter("p", {
      class: "price",
    }),
  });
  const itemPrice = span.stringValue().trim();

  // description
  const div = robin.dom(root).find({
    filter: DOMFilter.ElementFilter("div", {
      class: "woocommerce-product-details__short-description",
    }),
  });
  const itemDesc = div.stringValue().trim();

  // image
  const imgDiv = robin.dom(root).find({
    filter: DOMFilter.ElementFilter("div", {
      class: "woocommerce-product-gallery__image",
    }),
  });
  const itemImage = robin.dom(imgDiv).find("a").getAttributeNode("href").value;

  // amount left
  const p = robin.dom(root).find({
    filter: DOMFilter.ElementFilter("p", { class: "stock in-stock" }),
  });
  const itemAmountLeft = p.stringValue().trim();
  return {
    name: itemName,
    price: itemPrice,
    image: itemImage,
    description: itemDesc,
    amountLeft: itemAmountLeft,
  };
};

const scrapePage = async (page) => {
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
