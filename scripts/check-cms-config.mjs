import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const root = process.cwd();
const configPath = path.join(root, 'public/admin/config.yml');
const failures = [];

function fail(message) {
  failures.push(message);
  console.log(`FAIL ${message}`);
}

function pass(message) {
  console.log(`PASS ${message}`);
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    fail(`${label} must be ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    return;
  }

  pass(label);
}

function assertExists(relativePath, label) {
  if (!exists(relativePath)) {
    fail(`${label} missing at ${relativePath}`);
    return;
  }

  pass(`${label}: ${relativePath}`);
}

function collectMediaFolders(fields = [], folders = new Set()) {
  for (const field of fields) {
    if (!field || typeof field !== 'object') continue;
    if (field.media_folder) folders.add(field.media_folder);
    if (field.field) collectMediaFolders([field.field], folders);
    if (Array.isArray(field.fields)) collectMediaFolders(field.fields, folders);
  }
  return folders;
}

function collectionByName(config, name) {
  return (config.collections || []).find((collection) => collection.name === name);
}

console.log('New Afro CMS config integrity');

let config;
try {
  config = yaml.load(fs.readFileSync(configPath, 'utf8'));
  pass('CMS config parses as YAML');
} catch (error) {
  fail(`CMS config does not parse: ${error.message}`);
  config = {};
}

console.log('\n== Backend ==');
assertEqual(config.backend?.name, 'github', 'backend.name');
assertEqual(config.backend?.repo, 'newafro/website', 'backend.repo');
assertEqual(config.backend?.branch, 'staging', 'backend.branch');
assertEqual(config.backend?.base_url, 'https://decap-oauth.newafro.com', 'backend.base_url');
assertEqual(config.backend?.auth_endpoint, '/auth', 'backend.auth_endpoint');
assertEqual(config.site_url, 'https://preview.newafro.com', 'site_url');
assertEqual(config.display_url, 'https://preview.newafro.com', 'display_url');
assertEqual(config.publish_mode, 'editorial_workflow', 'publish_mode');

console.log('\n== Global media ==');
assertExists(config.media_folder || '', 'global media_folder');

const expectedCollections = {
  blog: {
    folder: 'src/content/blog',
    previewRoute: 'src/pages/blog/[...slug].astro',
    requiredFields: ['title', 'date', 'draft', 'body'],
  },
  events: {
    folder: 'src/content/events',
    previewRoute: 'src/pages/event-details-registration/[slug].astro',
    requiredFields: ['title', 'date_label', 'start_date', 'location', 'status', 'draft'],
  },
  artists: {
    folder: 'src/content/artists',
    requiredFields: ['name', 'short_bio', 'draft', 'body'],
  },
};

console.log('\n== Collections ==');
for (const [name, expected] of Object.entries(expectedCollections)) {
  const collection = collectionByName(config, name);
  if (!collection) {
    fail(`collection ${name} missing`);
    continue;
  }

  pass(`collection ${name} exists`);
  assertEqual(collection.folder, expected.folder, `${name}.folder`);
  assertEqual(collection.create, true, `${name}.create`);
  assertEqual(collection.extension, 'md', `${name}.extension`);
  assertEqual(collection.format, 'frontmatter', `${name}.format`);
  assertExists(expected.folder, `${name} content folder`);

  if (expected.previewRoute) {
    assertExists(expected.previewRoute, `${name} preview route`);
  }

  const fieldNames = new Set((collection.fields || []).map((field) => field.name));
  for (const fieldName of expected.requiredFields) {
    if (!fieldNames.has(fieldName)) {
      fail(`${name} field missing: ${fieldName}`);
    } else {
      pass(`${name} field: ${fieldName}`);
    }
  }

  for (const folder of collectMediaFolders(collection.fields)) {
    assertExists(folder, `${name} media folder`);
  }
}

console.log('\n== Summary ==');
if (failures.length) {
  for (const failure of failures) console.log(`- ${failure}`);
  process.exit(1);
}

console.log('CMS config is ready for editor onboarding.');
