const cheerio = require("cheerio");
const puppeteer = require("puppeteer");
const fetch = require("node-fetch");

const url =
  "https://onlineonly.christies.com/s/mapping-modern-contemporary-art/lots/1911";

/*
create data in the following structure
auctionResults = [
    {
        lot: "",
        primary: "",
        secondary: "",
        realized: ""
    }, 
    ...
]
*/

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      var totalHeight = 0;
      var distance = 100;
      var timer = setInterval(() => {
        var scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}
async function fetchCurrencyRate(from) {
  let url =
    "https://api.exchangeratesapi.io/latest?symbols=USD," + from + "&base=USD";

  const res = await fetch(url);
  const json = await res.json();
  console.log(json);
  return json.rates;
}

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(url);
  await page.setViewport({
    width: 1200,
    height: 800,
  });

  await page.waitForTimeout(500);
  await page.click("#onetrust-accept-btn-handler");
  await autoScroll(page);
  //   await page.screenshot({
  //     path: "auction-page.png",
  //     fullPage: true,
  //   });

  const html = await page.content();
  const $ = await cheerio.load(html);
  const currency = $(".chr-auction-header__sale-wrapper > .chr-body-bold")
    .text()
    .substr(0, 3);

  const exchangeRate = await fetchCurrencyRate(currency);

  let auctionResults = [];
  $(".chr-lot-tiles__wrapper")
    .children()
    .each((i, elem) => {
      const lot = $(elem).find(".chr-lot-number").first().text().substr(4);
      const primary = $(elem)
        .find(".chr-lot-tile__primary-title")
        .find("span")
        .text();
      const secondary = $(elem).find(".chr-lot-tile__secondary-title").text();
      // leaving out estimate, for some reason doesnt show on render
      //const estimate = $(elem)
      //     .find(".chr-lot-tile__static-information")
      //     .children()
      //     .each((j, e) => {
      //       console.log("childrenname: ", $(e).attr("class"));
      //     });

      const realizedInfo = $(elem)
        .find(".chr-lot-tile__dynamic-section .chr-lot-tile__price-value")
        .text();
      const realizedPrice = parseInt(realizedInfo.substr(4).replace(",", ""));
      const realizedCurrency = realizedInfo.substr(0, 3);

      const realizedUSD = Math.round(
        realizedPrice / exchangeRate[realizedCurrency]
      );
      auctionResults.push({
        lot: lot,
        primary: primary,
        secondary: secondary,
        realized: realizedInfo,
        realizedCurrency: realizedCurrency,
        realizedPrice: realizedPrice,
        realizedUSD: realizedUSD,
      });
    });
  console.log(auctionResults);
  await browser.close();
})();
