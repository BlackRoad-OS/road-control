#!/usr/bin/env node
// Validation script for road-control
// Checks HTML, CSS, and JS files for common issues

const fs = require('fs');
const path = require('path');

let errors = 0;
let warnings = 0;

function error(file, msg) {
  console.error(`ERROR [${file}]: ${msg}`);
  errors++;
}

function warn(file, msg) {
  console.warn(`WARN  [${file}]: ${msg}`);
  warnings++;
}

function ok(msg) {
  console.log(`  OK  ${msg}`);
}

// Check that required files exist
const requiredFiles = [
  'public/index.html',
  'public/css/style.css',
  'public/js/app.js',
];

console.log('=== BlackRoad Control Panel - Validation ===\n');

console.log('--- File existence ---');
for (const file of requiredFiles) {
  const fullPath = path.join(__dirname, '..', file);
  if (!fs.existsSync(fullPath)) {
    error(file, 'File not found');
  } else {
    ok(file);
  }
}

// Validate HTML
console.log('\n--- HTML validation ---');
const html = fs.readFileSync(path.join(__dirname, '..', 'public/index.html'), 'utf8');

if (!html.includes('<!DOCTYPE html>')) {
  error('index.html', 'Missing DOCTYPE');
} else {
  ok('DOCTYPE present');
}

if (!html.includes('<meta charset="UTF-8">')) {
  error('index.html', 'Missing charset meta tag');
} else {
  ok('Charset meta tag present');
}

if (!html.includes('<meta name="viewport"')) {
  error('index.html', 'Missing viewport meta tag');
} else {
  ok('Viewport meta tag present');
}

if (!html.includes('style.css')) {
  error('index.html', 'Missing CSS link');
} else {
  ok('CSS linked');
}

if (!html.includes('app.js')) {
  error('index.html', 'Missing JS script');
} else {
  ok('JS linked');
}

// Check all onclick handlers reference functions that should exist in JS
const onclickMatches = html.match(/onclick="([^"]+)"/g) || [];
const js = fs.readFileSync(path.join(__dirname, '..', 'public/js/app.js'), 'utf8');

console.log('\n--- Function references ---');
for (const onclick of onclickMatches) {
  const funcName = onclick.match(/onclick="(\w+)\(/)?.[1];
  if (funcName && !js.includes(`function ${funcName}`)) {
    error('app.js', `Function ${funcName}() referenced in HTML but not defined in JS`);
  } else if (funcName) {
    ok(`${funcName}() defined`);
  }
}

// Validate CSS
console.log('\n--- CSS validation ---');
const css = fs.readFileSync(path.join(__dirname, '..', 'public/css/style.css'), 'utf8');

if (!css.includes(':root')) {
  warn('style.css', 'Missing :root CSS variables');
} else {
  ok(':root variables defined');
}

const openBraces = (css.match(/{/g) || []).length;
const closeBraces = (css.match(/}/g) || []).length;
if (openBraces !== closeBraces) {
  error('style.css', `Mismatched braces: ${openBraces} open, ${closeBraces} close`);
} else {
  ok(`Balanced braces (${openBraces} blocks)`);
}

// Validate JS
console.log('\n--- JS validation ---');

try {
  // Basic syntax check - try to parse as a module-like structure
  new Function(js);
  ok('JavaScript syntax valid');
} catch (e) {
  error('app.js', `JavaScript syntax error: ${e.message}`);
}

// Check for common issues
if (js.includes('innerHTML') && !js.includes('escapeHtml')) {
  warn('app.js', 'Using innerHTML without escapeHtml helper - potential XSS');
}

// Summary
console.log('\n=== Results ===');
console.log(`Errors:   ${errors}`);
console.log(`Warnings: ${warnings}`);

if (errors > 0) {
  console.log('\nValidation FAILED');
  process.exit(1);
} else {
  console.log('\nValidation PASSED');
  process.exit(0);
}
