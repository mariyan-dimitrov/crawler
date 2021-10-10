"use strict";

const puppeteer = require("puppeteer");

const sendEmail = require("./utils/sendEmail");

const adminEmail = "mariyan_dimitrov@yahoo.com";

const timeout = 1000 * 60 * 3;
const seenUrls = [];
const criterias = [
  {
    description: "General",
    url: "https://www.imot.bg/779kqe",
    emails: [adminEmail],
  },
  {
    description: "Under 1100 euro/sqm",
    url: "https://www.imot.bg/77bjz3",
    emails: [adminEmail],
  },
];

const getNewAds = async criteria => {
  const { url } = criteria;
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox"],
  });

  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });

  const allAds = await page.evaluate(() => {
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

    return links
      .slice(lastNewBuildingIndex)
      .filter(ad => Boolean(ad.querySelector("tbody tr:nth-child(2)")))
      .map(getAdData);
  });

  await browser.close();

  const ads = allAds.filter(ad => ad);

  return { ...criteria, ads };
};

let isInitialRun = true;

const watchForChanges = () => {
  const criteriaPromises = criterias.map(criteria =>
    getNewAds(criteria).then(({ ads, description, emails }) => {
      ads.forEach(({ url, preview, price, pic }) => {
        if (!seenUrls.includes(url)) {
          seenUrls.push(url);

          !isInitialRun &&
            emails.forEach(email => {
              sendEmail({
                subject: `${price} / ${description}`,
                text: `${preview}\n${pic}\n\n ---------------------------- \n ${url}`,
                to: email,
              });
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
        to: adminEmail,
      });
    });
};

watchForChanges();
