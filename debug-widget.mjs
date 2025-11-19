import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: false,
  devtools: true, // Auto-open DevTools
  slowMo: 500 // Slow down to see what's happening
});

const context = await browser.newContext();
const page = await context.newPage();

console.log('Opening http://localhost:5173...');
await page.goto('http://localhost:5173');

console.log('\n=== Browser opened with DevTools ===');
console.log('1. 로그인해주세요');
console.log('2. Widget Builder 탭으로 가세요');
console.log('3. 리소스 카드 클릭해서 preview 열어보세요');
console.log('4. DevTools Console에서 로그 확인하세요');
console.log('5. iframe 우클릭 > "Inspect" 해서 iframe 내부 확인하세요\n');
console.log('Press Ctrl+C to close browser and exit\n');

// Keep the script running
await new Promise(() => {});
