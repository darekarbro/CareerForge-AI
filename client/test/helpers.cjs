const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/login' });
for (const name of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'MutationObserver', 'Event', 'CustomEvent',
  'File', 'FileReader', 'Blob', 'localStorage']) globalThis[name] = dom.window[name];
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = require('react');
const swc = require('next/dist/build/swc');
const root = path.resolve(__dirname, '../src') + path.sep;
const originalExtension = Module._extensions['.js'], originalLoad = Module._load;
const router = { query: {}, pathname: '/dashboard', push: async () => {}, replace: async () => {} };
const sockets = [];
const icons = new Proxy({}, { get: () => (props) => React.createElement('svg', { ...props, 'aria-hidden': true }) });
class FakeSocket {
  constructor(options) { this.options = options; this.handlers = new Map(); this.sent = []; this.disconnected = false; }
  on(name, callback) { if (!this.handlers.has(name)) this.handlers.set(name, new Set()); this.handlers.get(name).add(callback); return this; }
  off(name, callback) { this.handlers.get(name)?.delete(callback); return this; }
  emit(...args) { this.sent.push(args); return this; }
  trigger(name, value) { for (const callback of this.handlers.get(name) || []) callback(value); }
  removeAllListeners() { this.handlers.clear(); return this; }
  disconnect() { this.disconnected = true; return this; }
}
Module._load = function(request, parent, isMain) {
  if (request === 'lucide-react') return icons;
  if (request === 'socket.io-client') return { io: (_url, options) => {
    const socket = new FakeSocket(options); sockets.push(socket); return socket;
  } };
  if (request === 'next/router') return { useRouter: () => router };
  if (request === 'next/link') return { __esModule: true, default: ({ children, href, ...props }) =>
    React.createElement('a', { ...props, href: typeof href === 'string' ? href : href.pathname }, children) };
  return originalLoad.call(this, request, parent, isMain);
};
Module._extensions['.js'] = (module, filename) => {
  if (!filename.startsWith(root)) return originalExtension(module, filename);
  const { code } = swc.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'classic' } }, target: 'es2022' },
    module: { type: 'commonjs' },
  });
  module._compile(code, filename);
};
const load = (name) => require(path.join(root, name));
const api = load('services/api.js').default;
const auth = load('store/authStore.js').useAuthStore;
const resumes = load('store/resumeStore.js').useResumeStore;
const socket = load('services/socket.js');
const { render, screen, fireEvent, waitFor, cleanup, act } = require('@testing-library/react');
function respond(data, extra = {}) { return { status: 200, data: { success: true, data, ...extra } }; }
function session(id = 'userA') {
  auth.getState().setSession('token-' + id, { id, name: 'User ' + id, email: id + '@example.test', targetRolePreference: 'Fullstack Developer' });
}
function reset() {
  cleanup(); auth.getState().logout(); localStorage.clear();
  router.query = {}; router.pathname = '/dashboard';
  api.get = async (url) => {
    if (url === '/notifications') return respond([], { unreadCount: 0 });
    if (url === '/processing-jobs/health/providers') return respond({ activeProvider: 'deterministic-fallback' });
    throw new Error('Unexpected GET ' + url);
  };
  api.post = async (url) => { throw new Error('Unexpected POST ' + url); };
  api.put = async (url) => { throw new Error('Unexpected PUT ' + url); };
  api.delete = async () => respond({});
}
module.exports = { React, load, api, auth, resumes, socket, sockets, router, respond, session, reset,
  render, screen, fireEvent, waitFor, cleanup, act };
