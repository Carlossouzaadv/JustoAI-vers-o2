// Global polyfill that runs before any other code
try {
  if (typeof self === 'undefined') {
    global.self = global;
  }
} catch (e) {
  // Ignore errors and just set global.self
  global.self = global;
}

// Also set on globalThis for broader compatibility
if (typeof globalThis !== 'undefined') {
  globalThis.self = globalThis.self || globalThis;
}