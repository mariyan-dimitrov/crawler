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

    console.log("test");

    [...links].reverse().find((link, index) => {
      if (link.classList.contains("novaSgrada")) {
        lastNewBuildingIndex = links.length - index;
        return true;
      }

      return false;
    }) || 3;

    const getAdData = ad => ({
      url: ad.querySelector("a[href]").href,
      pic: ad.querySelector(".photoLink img").src,
      price: ad.querySelector(".price").textContent.trim(),
      preview: ad.querySelector("tr:nth-child(3) td").textContent.trim(),
    });

    const results = [];
    let hasVipBuildings = false;
    let hasTopBuildings = false;
    let hasFirstRegularBuilding = false;

    noNewBuildingsAds = links.slice(lastNewBuildingIndex);

    noNewBuildingsAds.forEach(ad => {
      const isLegitAd = Boolean(ad.querySelector("tbody tr:nth-child(2)"));

      if (!isLegitAd) {
        return;
      }

      const imageTag = ad.querySelector("tr:nth-child(2) > td:nth-child(3) img");
      const isVip = imageTag?.src && imageTag.src.includes("/vip.svg");
      const isTop = imageTag?.src && imageTag.src.includes("/top.svg");

      if (isVip && !hasVipBuildings) {
        results.push({ ...getAdData(ad), isVip });
        hasVipBuildings = true;
      } else if (isTop && !hasTopBuildings) {
        results.push({ ...getAdData(ad), isTop });
        hasTopBuildings = true;
      } else if (!isTop && !isVip && !hasFirstRegularBuilding) {
        results.push(getAdData(ad));
        hasFirstRegularBuilding = true;
      }
    });

    return results;
  });

  await browser.close();

  return { ads, description };
};

let isInitialRun = true;

const watchForChanges = () => {
  const criteriaPromises = criterias.map(criteria =>
    getNewAds(criteria).then(({ ads, description }) => {
      ads.forEach(({ url, preview, price, pic, isVip, isTop }) => {
        if (!seenUrls.includes(url)) {
          seenUrls.push(url);

          !isInitialRun &&
            sendEmail({
              text: `${preview}\n${pic}\n\n ---------------------------- \n ${url}`,
              subject: `${isVip ? "VIP /" : isTop ? "TOP /" : ""} ${price} / ${description} `,
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
      console.log("=============================================");
      console.log(error);
      console.log("=============================================");

      sendEmail({
        text: `Help me, I'm hurt!!!`,
        subject: `Droplet failure`,
      });
    });
};

watchForChanges();
