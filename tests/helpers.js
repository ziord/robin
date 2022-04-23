import fs from "fs";

global.loadData = (filename) => {
  return fs.readFileSync(`./tests/data/${filename || "sample.xml"}`).toString();
};
