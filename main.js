"use strict";

const puppeteer = require("puppeteer");

const sendEmail = require("./utils/sendEmail");

const timeout = 1000 * 60 * 3;
const seenUrls = [];
const criterias = [
  {
    description: "General",
    url: "https://www.imot.bg/779kqe",
  },
  {
    description: "Under 1100 euro/sqm",
    url: "https://www.imot.bg/77bjz3",
  },
];

const getNewAds = async criteria => {
  const { url, description } = criteria;
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox"],
  });

  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });

  const ads = await page.evaluate(() => {
    const links = [
      ...document.querySelectorAll(
        "body > div:nth-child(1) > table:nth-child(4) > tbody > tr:nth-child(1) > td:nth-child(1) > table"
      ),
    ];

    let lastNewBuildingIndex = 0;

    [...links].reverse().find((link, index) => {
      if (link.classList.contains("novaSgrada")) {
        lastNewBuildingIndex = links.length - index;
        return true;
      }

      return false;
    });

    const getAdData = ad => ({
      url: ad.querySelector("a[href]").href,
      pic: ad.querySelector(".photoLink img").src,
      price: ad.querySelector(".price").textContent.trim(),
      preview: ad.querySelector("tr:nth-child(3) td").textContent.trim(),
    });

    let hasVipBuildings = false;
    let hasTopBuildings = false;
    let hasFirstRegularBuilding = false;

    noNewBuildingsAds = links.slice(lastNewBuildingIndex);

    return noNewBuildingsAds.map(ad => {
      const isLegitAd = Boolean(ad.querySelector("tbody tr:nth-child(2)"));

      if (!isLegitAd) {
        return;
      }

      return getAdData(ad);
    });
  });

  await browser.close();

  return { ads, description };
};

let isInitialRun = true;

const watchForChanges = () => {
  const criteriaPromises = criterias.map(criteria =>
    getNewAds(criteria).then(({ ads, description }) => {
      ads.forEach(({ url, preview, price, pic }) => {
        if (!seenUrls.includes(url)) {
          seenUrls.push(url);

          !isInitialRun &&
            sendEmail({
              text: `${preview}\n${pic}\n\n ---------------------------- \n ${url}`,
              subject: `${price} / ${description}`,
            });
        }
      });

      return criteria;
    })
  );

  Promise.all(criteriaPromises)
    .then(() => {
      isInitialRun = false;

      setTimeout(() => {
        watchForChanges();
      }, timeout);
    })
    .catch(error => {
      sendEmail({
        subject: `Stepbro, I'm stuck`,
        text: error,
      });
    });
};

watchForChanges();

console.log("here");
