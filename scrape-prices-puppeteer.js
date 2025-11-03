import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import notifier from "node-notifier";
import fetch from "node-fetch"; // install via: npm install node-fetch
import nodemailer from "nodemailer";

let TEST_MODE = false; // وضعیت جاری اسکریپر

async function fetchTestMode() {
  try {
    const res = await fetch("http://localhost:3000/get-test-mode");
    const data = await res.json();
    TEST_MODE = data.testMode;
  } catch (err) {
    console.warn("⚠️ Could not fetch test mode:", err.message);
  }
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT || 465),
  secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const EMAIL_TO = process.env.EMAIL_TO || "you@example.com";



async function sendEmail(subject, message) {
  try {
    await transporter.sendMail({
      from: '"Price Tracker" <shaqayeqtourang@gmail.com>',
      to: EMAIL_TO,
      subject,
      text: message,
    });
    console.log("📧 Email sent successfully");
  } catch (err) {
    console.warn("⚠️ Email send failed:", err.message);
  }
}



const CHECK_INTERVAL = .5 * 60 * 1000; // every 30 seconds
const productUrls = [
  "https://www.digikala.com/product/dkp-20235097/",
  "https://www.digikala.com/product/dkp-20762973/",
  "https://www.digikala.com/product/dkp-13867812/",

];


async function notifyDashboard(data) {
  try {
    await fetch("http://localhost:3000/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch (err) {
    console.warn("⚠️ Could not send notification:", err.message);
  }
}

const HISTORY_DIR = path.join(process.cwd(), "price_history");
const ALERT_LOG_PATH = path.join(HISTORY_DIR, "alerts.log");

if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR);

const LAUNCH_OPTIONS = {
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
};

//  Convert to local Tehran time
function getLocalTime() {
  return new Intl.DateTimeFormat("en-IR", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
}

function extractProductId(url) {
  const match = url.match(/dkp-(\d+)/);
  return match ? match[1] : null;
}

function persianToEnglishDigits(str = "") {
  const map = { "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9" };
  return str.replace(/[۰-۹]/g, d => map[d]);
}

function extractNumberFromPriceString(s = "") {
  const normalized = persianToEnglishDigits(s).replace(/[٬,.\s]/g, "");
  const match = normalized.match(/\d+/);
  return match ? parseInt(match[0]) : null;
}

async function scrapeProductData(page, url) {
  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForSelector("h1", { timeout: 10000 });
  const title = await page.$eval("h1", el => el.textContent.trim());
  await page.waitForSelector('[data-theme-animation="price-container"]', { timeout: 15000 });
  const rawPrice = await page.$eval('[data-theme-animation="price-container"]', el => el.textContent.trim());
  let price = extractNumberFromPriceString(rawPrice);

  // testing mode (increase and decrease)
  if (TEST_MODE) {
    // 
    const productId = extractProductId(url);
    const baseFile = path.join(HISTORY_DIR, `dkp-${productId}.json`);
    let lastPrice = 400000;

    if (fs.existsSync(baseFile)) {
      try {
        const history = JSON.parse(fs.readFileSync(baseFile, "utf8"));
        if (history.length > 0) lastPrice = history[history.length - 1].price;
      } catch {}
    }

    
    const delta = (Math.random() * 0.2 - 0.1) * lastPrice; // -10% تا +10%
    price = Math.max(100000, Math.round(lastPrice + delta));



    // return { title, rawPrice: fakePrice.toString(), price: fakePrice };
  }

  return { title, rawPrice: price.toString(), price };
}



function saveHistoryFiles(productId, history) {
  const jsonPath = path.join(HISTORY_DIR, `dkp-${productId}.json`);
  const csvPath = path.join(HISTORY_DIR, `dkp-${productId}.csv`);
  fs.writeFileSync(jsonPath, JSON.stringify(history, null, 2), "utf8");

  const header = "title,price,timestamp\n";
  const rows = history.map(r => `"${r.title.replace(/"/g, '""')}",${r.price},"${r.timestamp}"`);
  fs.writeFileSync(csvPath, header + rows.join("\n"), "utf8");
}

function logAlertToFile(message) {
  const time = getLocalTime();
  const logEntry = `[${time}] ${message}\n`;
  fs.appendFileSync(ALERT_LOG_PATH, logEntry, "utf8");
}


async function appendPriceIfChanged(productId, title, newPrice) {
  const jsonPath = path.join(HISTORY_DIR, `dkp-${productId}.json`);
  let history = [];

  // خواندن تاریخچه قبلی
  if (fs.existsSync(jsonPath)) {
    try { history = JSON.parse(fs.readFileSync(jsonPath, "utf8")) || []; }
    catch { history = []; }
  }

  const lastEntry = history[history.length - 1];
  const lastPrice = lastEntry ? lastEntry.price : null;

  // اگر قیمت تغییر کرده باشد
  if (newPrice && newPrice !== lastPrice) {
    const record = { title, price: newPrice, timestamp: getLocalTime() };
    history.push(record);
    saveHistoryFiles(productId, history);

    let diffText = '';
    if (lastPrice) {
      const diff = newPrice - lastPrice;
      const changeType = diff > 0 ? "افزایش" : "کاهش";
      diffText = `${title} ${changeType} ${Math.abs(diff).toLocaleString("en-US")} تومان (از ${lastPrice.toLocaleString("en-US")} → ${newPrice.toLocaleString("en-US")})`;

      console.log(diffText);
      logAlertToFile(diffText);

      // ارسال به داشبورد برای همه تغییرات
      await notifyDashboard({
        title,
        message: diffText,
        productId: `dkp-${productId}`,
        oldPrice: lastPrice,
        newPrice,
      });

      // نوتیف و ایمیل فقط برای کاهش قیمت
      if (diff < 0) {
        notifier.notify({
          title: "💰 Price Drop Alert",
          message: `${title}\n↓ ${Math.abs(diff).toLocaleString("en-US")} Toman`,
          sound: true,
        });
        await sendEmail(
          `Price Drop Alert: ${title}\nhttps://www.digikala.com/product/dkp-${productId}/`,
          diffText
        );
      }
    } else {
      console.log(`✅ اولین ثبت قیمت برای ${title}: ${newPrice.toLocaleString("en-US")} Toman`);
    }
  } else {
    console.log(`ℹ️ تغییر قیمتی برای ${title} ثبت نشد`);
  }
}


async function checkAllProducts(browser) {
  await fetchTestMode(); // هر بار وضعیت واقعی سرور را دریافت می‌کنیم

  const page = await browser.newPage();
  for (const url of productUrls) {
    const productId = extractProductId(url);
    if (!productId) continue;

    try {
      const { title, price } = await scrapeProductData(page, url);
      if (!price) continue;
      await appendPriceIfChanged(productId, title, price);
    } catch (err) {
      console.error(`❌ Error while scraping ${url}:`, err.message);
    }
  }
  await page.close();
}

async function main() {
  const browser = await puppeteer.launch(LAUNCH_OPTIONS);
  console.log("🚀 Digikala Auto Price Tracker started...\n");

  await checkAllProducts(browser);

  setInterval(async () => {
    await checkAllProducts(browser);
  }, CHECK_INTERVAL);
}

main();
