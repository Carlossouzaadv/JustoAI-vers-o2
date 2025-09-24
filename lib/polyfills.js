// Polyfills for Node.js environment
if (typeof globalThis.self === 'undefined') {
  globalThis.self = globalThis;
}

if (typeof global.self === 'undefined') {
  global.self = global;
}