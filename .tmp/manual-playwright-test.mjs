import { chromium } from "playwright";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage();
await page.goto("https://example.com", { waitUntil: "domcontentloaded" });
console.log(JSON.stringify({ title: await page.title() }));
await browser.close();
