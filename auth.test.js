const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const storage = {};
const fakeDocument = {
  getElementById() {
    return {
      value: '',
      textContent: '',
      innerHTML: '',
      classList: { toggle() {}, add() {}, remove() {} },
      setAttribute() {},
      addEventListener() {},
      querySelectorAll() { return []; },
      querySelector() { return null; },
      closest() { return null; },
      nextElementSibling: null,
      reset() {},
      style: {},
      hidden: false,
      dataset: {},
      focus() {},
      disabled: false
    };
  },
  querySelectorAll() { return []; },
  querySelector() { return null; },
  addEventListener() {}
};

global.window = { supabase: { createClient: () => ({ from: () => ({ insert: async () => ({ error: null }) }) }) };
global.document = fakeDocument;
global.localStorage = {
  getItem(key) { return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null; },
  setItem(key, value) { storage[key] = String(value); },
  removeItem(key) { delete storage[key]; }
};
global.navigator = { clipboard: { writeText: async () => {} } };
global.crypto = {
  getRandomValues(array) {
    for (let i = 0; i < array.length; i += 1) {
      array[i] = i + 1;
    }
    return array;
  },
  subtle: {
    digest: async () => new Uint8Array(32).fill(1).buffer
  }
};

const context = {
  window: global.window,
  document: global.document,
  localStorage: global.localStorage,
  navigator: global.navigator,
  crypto: global.crypto,
  console,
  URL,
  FormData,
  Date,
  Intl,
  Math,
  Number,
  String,
  Array,
  Object,
  setTimeout,
  clearTimeout
};

const code = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
vm.runInNewContext(code, context);

assert.equal(typeof context.createAuthManager, 'function', 'Le gestionnaire d\'authentification doit exister.');
assert.equal(typeof context.getCurrentAuthUser, 'function', 'La méthode de session courante doit exister.');
console.log('Auth tests: OK');
