#!/usr/bin/env node
/**
 * PDF Export Script for BASTION Documentation
 *
 * Uses Puppeteer to render the docs site and export to PDF.
 *
 * Usage:
 *   node scripts/generate-pdf.js [--serve]
 *
 * Options:
 *   --serve   Start a local server automatically (requires build first)
 *
 * Prerequisites:
 *   npm run build   (build the site first)
 *   npm install puppeteer  (if not already installed)
 */

const puppeteer = require('puppeteer');
const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000';
const OUTPUT_FILE = path.join(__dirname, '..', 'bastion-docs.pdf');

// Ordered list of all doc pages for PDF generation
const DOC_PAGES = [
  '/',
  '/architecture/overview',
  '/architecture/data-model',
  '/capabilities/understand-tab',
  '/capabilities/design-tab',
  '/capabilities/plan-tab',
  '/capabilities/direct-tab',
  '/capabilities/cop-tab',
  '/capabilities/assess-tab',
  '/ai-agents/overview',
  '/ai-agents/agent-catalog',
  '/governance/dao-structure',
  '/governance/authority-model',
  '/blockchain/near-integration',
  '/blockchain/resource-registry',
  '/exercises/scenario-setup',
  '/exercises/training-mode',
  '/deployment/getting-started',
  '/api/rest-endpoints',
];

async function waitForServer(url, maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {
      // Server not ready yet
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error(`Server at ${url} did not start within ${maxRetries} seconds`);
}

async function generatePDF() {
  let serverProcess = null;

  if (process.argv.includes('--serve')) {
    console.log('Starting local server...');
    serverProcess = spawn('npx', ['docusaurus', 'serve', '--port', '3000', '--no-open'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe',
    });
    await waitForServer(BASE_URL);
    console.log('Server ready.');
  }

  try {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    const allContent = [];

    for (const docPage of DOC_PAGES) {
      const url = `${BASE_URL}${docPage}`;
      console.log(`  Rendering: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

      // Extract just the article content
      const content = await page.evaluate(() => {
        const article = document.querySelector('article') || document.querySelector('.main-wrapper');
        if (!article) return '';
        // Remove navigation elements
        article.querySelectorAll('.pagination-nav, .theme-doc-toc-mobile').forEach(el => el.remove());
        return article.innerHTML;
      });

      allContent.push(content);
    }

    // Create a combined page for PDF generation
    const combinedHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>BASTION Documentation</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
            color: #1a1a2e;
            line-height: 1.6;
          }
          h1 { color: #e64a19; border-bottom: 2px solid #ff5722; padding-bottom: 8px; page-break-after: avoid; }
          h2 { color: #bf360c; page-break-after: avoid; }
          h3 { color: #e64a19; page-break-after: avoid; }
          pre { background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto; page-break-inside: avoid; font-size: 13px; }
          code { background: #f5f5f5; padding: 2px 4px; border-radius: 2px; font-size: 90%; }
          pre code { background: none; padding: 0; }
          table { border-collapse: collapse; width: 100%; margin: 16px 0; page-break-inside: avoid; }
          th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
          th { background: #ff5722; color: white; }
          tr:nth-child(even) { background: #fbe9e7; }
          blockquote { border-left: 4px solid #ff5722; margin-left: 0; padding-left: 16px; color: #666; }
          .page-break { page-break-before: always; }
          .cover-page { text-align: center; padding-top: 200px; }
          .cover-page h1 { font-size: 36px; border: none; }
          .cover-page .subtitle { font-size: 14px; color: #666; margin-top: 8px; }
          .cover-page .date { margin-top: 40px; color: #999; }
          img { max-width: 100%; }
          a { color: #e64a19; }
        </style>
      </head>
      <body>
        <div class="cover-page">
          <h1>BASTION</h1>
          <p style="font-size: 18px; color: #e64a19;">Blockchain Autonomous Strategy &amp; Tactical Intelligence Operational Network</p>
          <p class="subtitle">Technical Documentation</p>
          <p class="date">Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          <p style="margin-top: 60px; color: #999;">VitalPoint AI</p>
        </div>
        ${allContent.map((html, i) => `<div class="${i > 0 ? 'page-break' : ''}">${html}</div>`).join('\n')}
      </body>
      </html>
    `;

    await page.setContent(combinedHTML, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: OUTPUT_FILE,
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
      displayHeaderFooter: true,
      headerTemplate: '<div style="font-size:8px; width:100%; text-align:center; color:#999;">BASTION Documentation</div>',
      footerTemplate: '<div style="font-size:8px; width:100%; text-align:center; color:#999;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
    });

    console.log(`\nPDF generated: ${OUTPUT_FILE}`);
    await browser.close();
  } finally {
    if (serverProcess) {
      serverProcess.kill();
    }
  }
}

generatePDF().catch(err => {
  console.error('PDF generation failed:', err);
  process.exit(1);
});
