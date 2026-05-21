#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const scanRoots = ['src', 'public/admin'];
const scannedExtensions = new Set([
  '.astro',
  '.css',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.ts',
  '.yaml',
  '.yml',
]);
const uploadReferencePattern = /\/uploads\/[^\s"'`)<>{}\]]+/g;
const failures = [];
const references = new Map();
let scannedFiles = 0;

function pass(message) {
  console.log(`PASS ${message}`);
}

function fail(message) {
  failures.push(message);
  console.log(`FAIL ${message}`);
}

function shouldScan(filePath) {
  return scannedExtensions.has(path.extname(filePath));
}

function normalizeReference(reference) {
  return reference
    .split(/[?#]/)[0]
    .replace(/[.,;:]+$/, '');
}

function addReference(filePath, reference) {
  const normalized = normalizeReference(reference);
  if (!normalized.startsWith('/uploads/')) return;

  const key = `${filePath}\0${normalized}`;
  if (!references.has(key)) {
    references.set(key, { filePath, reference: normalized });
  }
}

function scanFile(filePath) {
  scannedFiles += 1;
  const source = fs.readFileSync(filePath, 'utf8');
  const matches = source.matchAll(uploadReferencePattern);

  for (const match of matches) {
    addReference(filePath, match[0]);
  }
}

function walk(relativeDir) {
  const absoluteDir = path.join(root, relativeDir);
  if (!fs.existsSync(absoluteDir)) return;

  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      walk(relativePath);
      continue;
    }

    if (entry.isFile() && shouldScan(relativePath)) {
      scanFile(relativePath);
    }
  }
}

console.log('New Afro content asset integrity');

for (const scanRoot of scanRoots) {
  walk(scanRoot);
}

console.log(`Scanned ${scannedFiles} source files.`);
console.log(`Found ${references.size} unique /uploads references.`);

for (const { filePath, reference } of references.values()) {
  const publicPath = path.join(root, 'public', reference);
  if (!fs.existsSync(publicPath)) {
    fail(`${filePath}: ${reference} is missing at public${reference}`);
  }
}

console.log('\n== Summary ==');
if (failures.length) {
  for (const failure of failures) console.log(`- ${failure}`);
  process.exit(1);
}

pass('all referenced upload assets exist under public/uploads');
