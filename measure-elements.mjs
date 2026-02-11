import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:18800'
  });
  const pages = await browser.pages();
  const page = pages[0];
  
  await page.setViewport({ width: 1280, height: 800 });
  
  // Wait for elements to be visible
  await page.waitForSelector('img[alt="First Access Lending"]');
  await page.waitForSelector('a[href="/heloc"]');
  
  // Measure logo
  const logoSize = await page.evaluate(() => {
    const logo = document.querySelector('img[alt="First Access Lending"]');
    const rect = logo.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
  
  // Measure button
  const buttonSize = await page.evaluate(() => {
    const button = document.querySelector('a[href="/heloc"]');
    const rect = button.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
  
  console.log('Logo size:', logoSize);
  console.log('Button size:', buttonSize);
  console.log('Logo height vs Button height:', 
    `${((logoSize.height / buttonSize.height) * 100).toFixed(1)}%`);
  
  await browser.disconnect();
})();
