const express = require("express");
const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const cors = require("cors");
require("dotenv").config();
const app = express();
app.use(cors());

app.get("/nbc-rate", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const dateFilter = req.query.date || today;

    const browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--single-process",
        "--no-zygote",
      ],
      executablePath:
        process.env.NODE_ENV === "production"
          ? process.env.PUPEPTEER_EXECUTTABLE_PATH
          : puppeteer.executablePath(),
    });

    const page = await browser.newPage();

    // Set user agent
    await page.setUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36"
    );

    // Increase the navigation timeout to 60 seconds (60000 milliseconds)
    await page.goto(
      "https://www.nbc.gov.kh/english/economic_research/exchange_rate.php"
    );

    await page.waitForTimeout(2000);

    await page.$eval(
      "#datepicker",
      (datepicker, dateFilter) => {
        datepicker.value = dateFilter;
      },
      dateFilter
    );

    await page.click('input[name="view"]');
    await page.waitForTimeout(2000);

    const content = await page.content();
    const $ = cheerio.load(content);

    const exchangeRates = [];

    $("table.tbl-responsive tr").each((index, element) => {
      if (index > 0) {
        const columns = $(element).find("td");
        const currency = columns.eq(0).text().trim();
        const Symbol = columns.eq(1).text().trim();
        const unit = columns.eq(2).text().trim();
        const bid = columns.eq(3).text().trim();
        const ask = columns.eq(4).text().trim();

        exchangeRates.push({ currency, Symbol, unit, bid, ask });
      }
    });

    const officialExchangeRateRow = $('td:contains("Official Exchange Rate")');
    const officialExchangeRateText = officialExchangeRateRow.text();
    const officialExchangeRateMatch = officialExchangeRateText.match(/(\d+)/);
    const officialExchangeRate = officialExchangeRateMatch
      ? parseInt(officialExchangeRateMatch[1])
      : null;

    await browser.close();

    const response = {
      ok: true,
      value: exchangeRates,
      officialExchangeRate,
      date: dateFilter,
    };

    res.json(response);
  } catch (error) {
    console.error("Error:", error);

    if (error instanceof puppeteer.errors.TimeoutError) {
      res.status(500).json({ error: "Timeout Error" });
    } else if (error.message === "Navigating frame was detached") {
      // Handle detached frame error
      res.status(500).json({ error: "Frame detached error" });
    } else {
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

app.get("/nssf-exr-rate", (req, res) => {
    scrapeNSSF()
      .then(function (data) {
        res.send(data);
      })
      .catch(function (e) {
        res.status(500, {
          error: e,
        });
      });
  });
  
  app.get("/exr-rate", (req, res) => {
    scrapeExchangeRate()
      .then(function (data) {
        res.send(data);
      })
      .catch(function (e) {
        res.status(500, {
          error: e,
        });
      });
  });

  
async function scrapeNSSF() {
    try {
      // Launch the browser and open a new blank page
      const browser = await puppeteer.launch({ headless: "new" });
      const page = await browser.newPage();
      // Navigate the page to a URL
      await page.goto("https://www.nssf.gov.kh/language/en");
  
      let data = await page.evaluate(() => {
        let text = document.querySelector(
          "div.nssf-blockcontent > div > ul > li:nth-child(1) > a:nth-child(3)"
        ).innerText;
        let splitText = text.split(" ");
        let exchangeRate = splitText[splitText.length - 2];
        let month =
          new Date(Date.parse(splitText[2] + " 1, 2000")).getMonth() + 1;
        let exchangeMonth = splitText[3] + "-" + month;
        return {
          exchange_month: exchangeMonth,
          exchange_rate: exchangeRate,
          data: text,
        };
      });
      await browser.close();
      return data;
    } catch (e) {
      console.log(e);
      browser.close();
    }
  }
  
  async function scrapeExchangeRate() {
    try {
      // Launch the browser and open a new blank page
      const browser = await puppeteer.launch({ headless: "new" });
      const page = await browser.newPage();
      // Navigate the page to a URL
      await page.goto("https://www.tax.gov.kh/en/exchange-rate");
  
      let data = await page.evaluate(() => {
        let rows = Array.from(document.querySelectorAll("#data-container tr"));
        let lists = Array.from(rows, (row) => {
          let cols = row.querySelectorAll("td");
          return {
            exchange_date: cols[0].innerText.split("\n")[0],
            exchange_symbol: cols[1].innerText,
            exchange_rate: cols[2].innerText,
          };
        });
        return {
          current_exchange_rate: {
            exchange_date: document.querySelector(".current-date").innerText,
            exchange_rate: document
              .querySelector(".moul")
              .innerText.split(" ")[0],
          },
          exchange_lists: lists,
        };
      });
      await browser.close();
      return data;
    } catch (e) {
      console.log(e);
      browser.close();
    }
  }
  