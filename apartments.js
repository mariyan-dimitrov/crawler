/* eslint-disable implicit-arrow-linebreak */
const puppeteer = require("puppeteer");
const fs = require("fs");

const sendEmail = require("./utils/sendEmail");

const config = JSON.parse(fs.readFileSync("config.json", "utf8"));
const { adminEmail, emailReceivers, ...auth } = config;
const timeout = 1000 * 60 * 3;

const seenUrls = [];
const criterias = [
  {
    description: "General three rooms",
    url: "https://www.imot.bg/79kmi8",
    emails: emailReceivers,
    hasCriteriaExpired: false,
  },
  {
    description: "General two rooms",
    url: "https://www.imot.bg/79kmm9",
    emails: emailReceivers,
    hasCriteriaExpired: false,
  },
  {
    description: "General under 1100 euro/sqm",
    url: "https://www.imot.bg/79kmha",
    emails: emailReceivers,
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
      // eslint-disable-next-line no-undef
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

  const ads = allAds.filter(Boolean);

  return ads;
};

let isInitialRun = true;

const watchForChanges = async () => {
  try {
    const criteriaPromises = criterias.map(
      criteria => () =>
        getNewAds(criteria).then(ads => {
          const { description, url, emails, hasCriteriaExpired } = criteria;

          if (ads.length) {
            ads.forEach(ad => {
              if (!seenUrls.includes(url)) {
                seenUrls.push(url);

                !isInitialRun &&
                  emails.forEach(email => {
                    sendEmail({
                      subject: `${ad.price} / ${description}`,
                      text: `${ad.preview}\n${ad.pic}\n\n ---------------------------- \n ${url}`,
                      auth,
                      to: email,
                    });
                  });
              }
            });
          } else if (!hasCriteriaExpired) {
            const criteriaIndex = criterias.findIndex(
              currentCriteria => currentCriteria.url === url
            );

            criterias[criteriaIndex].hasCriteriaExpired = true;

            sendEmail({
              subject: "Expired!!!",
              text: `Criteria expired: ${url}`,
              auth,
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
      auth,
      to: adminEmail,
    });
  }
};

watchForChanges();
