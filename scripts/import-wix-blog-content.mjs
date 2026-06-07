#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BLOG_DIR = path.join(ROOT, 'src/content/blog');
const MANIFEST = path.join(ROOT, 'public/reference/newafro-net/manifest.json');
const REPORT_DIR = path.join(ROOT, 'reports/wix-content');
const REPORT_PATH = path.join(REPORT_DIR, 'blog-import-report.json');

const SKIP_EXACT = new Set([
  'Skip to Main Content',
  'Recent Posts',
  'See All',
  'All Posts',
  'Our Work',
  'Work with us',
  'Information',
  'Imprint',
  'Privacy Policy',
  'Terms and Conditions (T&C)',
  'Subscribe Now',
  'Join our newsletter',
  'HOME',
  'THE AGENCY',
  'COMMUNITY',
  'THE ARCHIVE',
  'PROJECTS',
  'EVENTS',
]);

function readFrontmatter(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { data: {}, body: raw };
  return {
    data: yaml.load(match[1]) || {},
    body: raw.slice(match[0].length),
  };
}

function writeMarkdown(file, data, body) {
  const frontmatter = yaml.dump(data, {
    lineWidth: 120,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false,
  }).trim();
  fs.writeFileSync(file, `---\n${frontmatter}\n---\n\n${body.trim()}\n`);
}

function slugFromUrl(url) {
  const pathname = new URL(url).pathname.replace(/\/$/, '');
  return decodeURIComponent(pathname.split('/').pop() || '');
}

function titleToSlug(title) {
  return String(title || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function findExistingFile(slug, title) {
  const exact = path.join(BLOG_DIR, `${slug}.md`);
  if (fs.existsSync(exact)) return exact;

  const files = fs.readdirSync(BLOG_DIR).filter((file) => file.endsWith('.md'));
  const wantedTitleSlug = titleToSlug(title).slice(0, 60);
  for (const file of files) {
    const full = path.join(BLOG_DIR, file);
    const { data } = readFrontmatter(full);
    const fileTitleSlug = titleToSlug(data.title).slice(0, 60);
    if (fileTitleSlug && fileTitleSlug === wantedTitleSlug) return full;
  }

  return exact;
}

function parseMeta(bodyText, title) {
  const lines = bodyText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const titleIndex = lines.findIndex((line) => line === title);
  const author = titleIndex >= 0 ? lines[titleIndex + 1] : '';
  const dateText = titleIndex >= 0 ? lines[titleIndex + 2] : '';
  const date = parseDisplayDate(dateText);
  return { author, dateText, date };
}

function parseDisplayDate(value) {
  const match = String(value || '').match(/^([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})$/);
  if (!match) return '';
  const months = {
    jan: '01',
    feb: '02',
    mar: '03',
    apr: '04',
    may: '05',
    jun: '06',
    jul: '07',
    aug: '08',
    sep: '09',
    oct: '10',
    nov: '11',
    dec: '12',
  };
  const month = months[match[1].toLowerCase()];
  if (!month) return '';
  return `${match[3]}-${month}-${String(match[2]).padStart(2, '0')}`;
}

function shouldSkipBlock(block) {
  const text = block.text.trim();
  if (!text) return true;
  if (SKIP_EXACT.has(text)) return true;
  if (/^Updated:/i.test(text)) return true;
  if (/^\d+\s+comments?$/i.test(text)) return true;
  if (/^\d+\s+likes?/i.test(text)) return true;
  if (/Post not marked as liked/i.test(text)) return true;
  return false;
}

function shouldStopBlock(block) {
  const text = block.text.trim();
  return text === 'Recent Posts' || /^\d+\s+comments?$/i.test(text);
}

function markdownFromBlocks(blocks, title) {
  const parts = [];
  const seen = new Set();

  for (const block of blocks) {
    const text = block.text.trim();
    if (shouldStopBlock(block)) break;
    if (!text || text === title || shouldSkipBlock(block)) continue;
    if (/^\w{3}\s+\d{1,2},\s+\d{4}$/.test(text)) continue;
    if (/^\d+\s+min read$/i.test(text)) continue;
    const key = text.replace(/\s+/g, ' ');
    if (seen.has(key)) continue;
    seen.add(key);

    if (block.tag === 'h2') {
      parts.push(`## ${text}`);
    } else if (block.tag === 'h3') {
      parts.push(`### ${text}`);
    } else {
      parts.push(text);
    }
  }

  return parts.join('\n\n');
}

function descriptionFromBlocks(blocks, title) {
  for (const block of blocks) {
    if (shouldStopBlock(block)) break;
    const text = block.text.trim();
    if (block.tag !== 'p' || text === title || shouldSkipBlock(block)) continue;
    if (/^\w{3}\s+\d{1,2},\s+\d{4}$/.test(text)) continue;
    if (/^\d+\s+min read$/i.test(text)) continue;
    return text;
  }
  return '';
}

async function extractPost(context, entry) {
  const page = await context.newPage();
  await page.goto(entry.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);

  const extracted = await page.evaluate(() => {
    const clean = (value) => String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .trim();

    const blocks = [];
    const seen = new Set();
    for (const el of document.querySelectorAll('h1,h2,h3,p,li')) {
      const text = clean(el.innerText || el.textContent || '');
      if (!text) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 80 || rect.height < 5) continue;
      const key = `${el.tagName}:${text.replace(/\s+/g, ' ')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      blocks.push({ tag: el.tagName.toLowerCase(), text, y: Math.round(rect.y) });
    }

    const images = [...document.images]
      .map((img) => ({
        src: img.currentSrc || img.src,
        alt: clean(img.alt),
        width: img.naturalWidth,
        height: img.naturalHeight,
        y: Math.round(img.getBoundingClientRect().y),
      }))
      .filter((img) => img.width > 100 && img.height > 100);

    return {
      title: document.querySelector('h1')?.textContent?.trim() || document.title,
      documentTitle: document.title,
      bodyText: document.body?.innerText || '',
      blocks,
      images,
    };
  });

  await page.close();
  return extracted;
}

async function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const entries = manifest.pages.filter((page) => page.category === 'Blog posts');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1200 },
    userAgent: 'newafro-wix-content-importer',
  });

  const report = [];
  for (const entry of entries) {
    const slug = slugFromUrl(entry.url);
    const existingFile = findExistingFile(slug, entry.title);
    const targetFile = path.join(BLOG_DIR, `${slug}.md`);
    const existing = fs.existsSync(existingFile) ? readFrontmatter(existingFile) : { data: {} };
    const extracted = await extractPost(context, entry);
    const meta = parseMeta(extracted.bodyText, extracted.title);
    const body = markdownFromBlocks(extracted.blocks, extracted.title);

    if (!body || body.length < 80) {
      report.push({
        slug,
        sourceUrl: entry.url,
        status: 'skipped',
        reason: 'no substantial body extracted',
      });
      continue;
    }

    const data = {
      title: extracted.title,
      description: descriptionFromBlocks(extracted.blocks, extracted.title),
      date: meta.date || existing.data.date || new Date().toISOString().slice(0, 10),
      author: meta.author || existing.data.author || 'New Afro',
      category: existing.data.category || 'Article',
      tags: existing.data.tags || [],
      hero_image: existing.data.hero_image,
      hero_alt: existing.data.hero_alt || extracted.title,
      gallery: existing.data.gallery || [],
      draft: false,
    };

    Object.keys(data).forEach((key) => data[key] === undefined && delete data[key]);

    if (existingFile !== targetFile && fs.existsSync(existingFile)) {
      fs.renameSync(existingFile, targetFile);
    }

    writeMarkdown(targetFile, data, body);
    report.push({
      slug,
      sourceUrl: entry.url,
      status: 'imported',
      file: path.relative(ROOT, targetFile),
      title: data.title,
      author: data.author,
      date: data.date,
      paragraphs: body.split(/\n\n+/).length,
      sourceImages: extracted.images.length,
      localHero: data.hero_image || '',
      localGalleryCount: data.gallery.length,
    });
    console.log(`imported ${slug}`);
  }

  await browser.close();
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`wrote ${path.relative(ROOT, REPORT_PATH)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
