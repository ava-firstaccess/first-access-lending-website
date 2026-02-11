import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';

async function takeScreenshot() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  console.log('Loading page...');
  await page.goto('https://first-access-lending-website.vercel.app', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });
  
  console.log('Taking screenshot...');
  const screenshot = await page.screenshot({
    type: 'png',
    fullPage: false,
    clip: { x: 0, y: 0, width: 1920, height: 1200 }
  });
  
  const filename = `/Users/ava/.openclaw/workspace/fal-fonts-${Date.now()}.png`;
  writeFileSync(filename, screenshot);
  console.log(`Screenshot saved: ${filename}`);
  
  await browser.close();
}

takeScreenshot().catch(console.error);
