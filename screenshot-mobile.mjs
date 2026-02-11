import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:18800'
  });
  const pages = await browser.pages();
  const page = pages[0];
  
  // Set mobile viewport (iPhone 12 Pro size)
  await page.setViewport({ width: 390, height: 844 });
  
  // Wait a moment for responsive styles to apply
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Take screenshot
  await page.screenshot({ 
    path: 'mobile-view.png',
    clip: { x: 0, y: 0, width: 390, height: 150 }
  });
  
  await browser.disconnect();
  console.log('Mobile screenshot saved');
})();
