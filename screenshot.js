const { chromium, devices } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const destDir = "C:\\Users\\azure\\.gemini\\antigravity-ide\\brain\\0d814a22-7052-4356-bf2d-87b2852433e2\\scratch";
  
  // iPhone 13 Pro Max viewport
  const context = await browser.newContext(devices['iPhone 13 Pro Max']);
  const page = await context.newPage();
  
  try {
    console.log("Navigating to register page...");
    await page.goto('http://localhost:3000/register', { waitUntil: 'load' });
    
    console.log("Registering test user...");
    await page.fill('input[type="text"]', 'Test User');
    await page.fill('input[type="email"]', 'test2@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Wait for navigation to the main app
    await page.waitForTimeout(4000);
    
    console.log("Taking iPhone screenshot of main app...");
    await page.screenshot({ path: path.join(destDir, 'mobile-screenshot.png') });
    
    console.log("Toggling sidebar...");
    const menuButton = await page.$('.mobile-only');
    if (menuButton) {
      await menuButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(destDir, 'mobile-sidebar-open.png') });
      
      // Close sidebar
      await page.mouse.click(10, 10);
      await page.waitForTimeout(500);
    }
    
    console.log("Clicking an email (if any) to open detail pane...");
    const emailItem = await page.$('.email-item');
    if (emailItem) {
      await emailItem.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(destDir, 'mobile-detail-pane.png') });
    }
    
    // Tablet View
    console.log("Testing iPad layout...");
    const context2 = await browser.newContext(devices['iPad Pro 11']);
    const page2 = await context2.newPage();
    
    // Should be logged in because of cookies? No, different context.
    // Let's just login again
    await page2.goto('http://localhost:3000/login', { waitUntil: 'load' });
    await page2.fill('input[type="email"]', 'test2@example.com');
    await page2.fill('input[type="password"]', 'password123');
    await page2.click('button[type="submit"]');
    await page2.waitForTimeout(4000);
    
    await page2.screenshot({ path: path.join(destDir, 'ipad-screenshot.png') });
    console.log("Done.");
  } catch (error) {
    console.error("Error during screenshot:", error);
  } finally {
    await browser.close();
  }
})();
