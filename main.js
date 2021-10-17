"use strict";

const puppeteer = require("puppeteer");

const sendEmail = require("./utils/sendEmail");

const adminEmail = "mariyan_dimitrov@yahoo.com";

const timeout = 1000 * 60 * 3;
const seenUrls = [];
const criterias = [
  {
    description: "General",
    url: "https://www.imot.bg/78lfo3",
    emails: [adminEmail],
    hasCriteriaExpired: false,
  },
  {
    description: "Under 1100 euro/sqm",
    url: "https://www.imot.bg/78lfq3",
    emails: [adminEmail],
    hasCriteriaExpired: false,
  },
  {
    description: "General two rooms",
    url: "https://www.imot.bg/78lfux",
    emails: [adminEmail],
    hasCriteriaExpired: false,
  },
  {
    description: "Two rooms Under 1100 euro/sqm",
    url: "https://www.imot.bg/78lfst",
    emails: [adminEmail],
    hasCriteriaExpired: false,
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

const watchForChanges = async () => {
  try {
    const criteriaPromises = criterias.map(
      criteria => () =>
        getNewAds(criteria).then(({ ads, description, url, emails, hasCriteriaExpired }) => {
          if (ads.length) {
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
          } else if (!hasCriteriaExpired) {
            const criteriaIndex = criterias.findIndex(criteria => criteria.url === url);
            criterias[criteriaIndex].hasCriteriaExpired = true;

            sendEmail({
              subject: `Expired "${criteria}"`,
              text: `Criteria expired: ${url}`,
              to: adminEmail,
            });
          }

          return criteria;
        })
    );

    for (const index in criteriaPromises) {
      await criteriaPromises[index]();
    }

    isInitialRun = false;

    setTimeout(() => {
      watchForChanges();
    }, timeout);
  } catch (error) {
    sendEmail({
      subject: "Crawler error",
      text: error,
      to: adminEmail,
    });
  }
};

watchForChanges();
console.log("here");
