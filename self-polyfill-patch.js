// Patch self reference for Node.js environment
// This must be loaded before any modules that use 'self'

const originalRequire = require;

// Override the built-in require to inject our polyfill
require = function patchedRequire(id) {
  // Set self = global before any module loads
  if (!global.self) {
    global.self = global;
  }

  return originalRequire.call(this, id);
};

// Copy all properties from the original require
Object.setPrototypeOf(require, originalRequire);
Object.getOwnPropertyNames(originalRequire).forEach(name => {
  if (name !== 'length' && name !== 'name' && name !== 'prototype') {
    require[name] = originalRequire[name];
  }
});

// Ensure self is available globally
if (!global.self) {
  global.self = global;
}