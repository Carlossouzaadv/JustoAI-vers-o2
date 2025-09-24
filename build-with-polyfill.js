#!/usr/bin/env node

// Set up self polyfill before anything else runs
if (!global.self) {
  global.self = global;
}

// Continuously ensure self is defined
const originalSetImmediate = setImmediate;
setImmediate = function(...args) {
  if (!global.self) {
    global.self = global;
  }
  return originalSetImmediate.apply(this, args);
};

// Load and run next build
const { spawn } = require('child_process');
const path = require('path');

console.log('Starting build with self polyfill...');

const child = spawn('npm', ['run', 'build'], {
  stdio: 'inherit',
  cwd: process.cwd(),
  shell: true,
  env: {
    ...process.env,
    NODE_ENV: 'production'
  }
});

child.on('exit', (code) => {
  process.exit(code);
});

child.on('error', (err) => {
  console.error('Build failed:', err);
  process.exit(1);
});