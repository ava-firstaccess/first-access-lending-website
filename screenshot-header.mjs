import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:18800'
  });
  const pages = await browser.pages();
  const page = pages[0];
  
  await page.setViewport({ width: 1280, height: 800 });
  
  // Take screenshot of just the header area (top 120px)
  await page.screenshot({ 
    path: 'header-screenshot.png',
    clip: { x: 0, y: 0, width: 1280, height: 120 }
  });
  
  await browser.disconnect();
  console.log('Header screenshot saved');
})();
