const smtpTransport = require("nodemailer-smtp-transport");
const nodemailer = require("nodemailer");
const puppeteer = require("puppeteer");

const timeout = 1000 * 60 * 3;
const url = "https://www.imot.bg/779kqe";
let lastLinkUrl = null;

const getNewAd = async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });

  const ad = await page.evaluate(() => {
    const links = [
      ...document.querySelectorAll(
        "body > div:nth-child(1) > table:nth-child(4) > tbody > tr:nth-child(1) > td:nth-child(1) table"
      ),
    ];

    const hasNewBuildings = Boolean(
      links.find((link) => link.classList.contains("novaSgrada"))
    );

    let result = null;

    if (hasNewBuildings) {
      let hasPassedNewBuildings = false;

      result = links.find((link) => {
        const isNewBuilding = link.classList.contains("novaSgrada");

        if (!hasPassedNewBuildings && isNewBuilding) {
          hasPassedNewBuildings = true;
        } else if (hasPassedNewBuildings && !isNewBuilding) {
          return link;
        }

        return false;
      });
    } else {
      result = links.filter(
        (link) => !link.classList.contains("novaSgrada")
      )[0];
    }

    return {
      link: result.querySelector("a[href]").href,
      pic: result.querySelector(".photoLink img").src,
      price: result.querySelector(".price").textContent.trim(),
      preview: result.querySelector("tr:nth-child(3) td").textContent.trim(),
    };
  });

  await browser.close();

  return ad;
};

const sendEmailWith = async ({ link, pic, price, preview }) => {
  const transporter = nodemailer.createTransport(
    smtpTransport({
      service: "gmail",
      host: "smtp.gmail.com",
      auth: {
        user: "mirka.dimitrov@gmail.com",
        pass: "fvkhkpscizopchqr",
      },
    })
  );

  const mailOptions = {
    from: "mirka.dimitrov@gmail.com",
    to: "mariyan_dimitrov@yahoo.com",
    subject: price,
    text: `${preview}\n${link}\n\n ---------------------------- \n ${pic}`,
  };

  transporter.sendMail(mailOptions);
};

let isInitialRun = true;

const watchForChanges = () => {
  getNewAd().then((ad) => {
    const { link } = ad;

    if (link !== lastLinkUrl) {
      lastLinkUrl = link;
      !isInitialRun && sendEmailWith(ad);
    }

    isInitialRun = false;

    setTimeout(() => {
        watchForChanges();
    }, timeout)
  });
};

watchForChanges();
