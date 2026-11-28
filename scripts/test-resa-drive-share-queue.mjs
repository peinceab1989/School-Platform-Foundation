import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../artifacts/school-platform/public/sw.js", import.meta.url), "utf8");
const databases = new Map();

const indexedDB = {
  open(name) {
    const request = {};
    queueMicrotask(() => {
      let stores = databases.get(name);
      const isNew = !stores;
      if (!stores) {
        stores = new Map();
        databases.set(name, stores);
      }
      const db = {
        objectStoreNames: { contains: (storeName) => stores.has(storeName) },
        createObjectStore: (storeName) => stores.set(storeName, new Map()),
        transaction(storeName) {
          const values = stores.get(storeName);
          assert.ok(values, `Missing IndexedDB store: ${storeName}`);
          const tx = { aborted: false, oncomplete: null, onabort: null, onerror: null };
          const complete = () => queueMicrotask(() => {
            if (!tx.aborted) tx.oncomplete?.();
          });
          tx.objectStore = () => ({
            get(key) {
              const req = { result: undefined, onsuccess: null, onerror: null };
              queueMicrotask(() => {
                req.result = values.get(key);
                req.onsuccess?.();
                complete();
              });
              return req;
            },
            put(value, key) {
              values.set(key, value);
              complete();
            },
            delete(key) {
              values.delete(key);
              complete();
            },
          });
          tx.abort = () => {
            tx.aborted = true;
            queueMicrotask(() => tx.onabort?.());
          };
          return tx;
        },
        close() {},
      };
      request.result = db;
      if (isNew) request.onupgradeneeded?.();
      request.onsuccess?.();
    });
    return request;
  },
};

const listeners = new Map();
const self = {
  location: { origin: "https://resa.test" },
  addEventListener: (name, callback) => listeners.set(name, callback),
  skipWaiting: () => Promise.resolve(),
  clients: { claim: () => Promise.resolve() },
};
const context = vm.createContext({
  self,
  indexedDB,
  File,
  Response,
  URL,
  Promise,
  Date,
  console,
  queueMicrotask,
  setTimeout,
  clearTimeout,
  caches: {
    open: async () => ({ add: async () => {}, match: async () => null }),
    keys: async () => [],
    delete: async () => true,
  },
});
vm.runInContext(source, context, { filename: "sw.js" });

async function share(files) {
  let responsePromise;
  const request = {
    method: "POST",
    url: "https://resa.test/drive-share",
    formData: async () => ({ getAll: () => files }),
  };
  listeners.get("fetch")({
    request,
    respondWith: (promise) => { responsePromise = promise; },
  });
  assert.ok(responsePromise, "Share request should be handled by the service worker");
  return await responsePromise;
}

function queuedFiles() {
  const stores = databases.get("resa-drive-share-inbox");
  const pending = stores?.get("pending")?.get("files");
  return Array.isArray(pending?.files) ? pending.files : [];
}

function file(name, bytes = "x") {
  return new File([bytes], name, { type: "text/plain", lastModified: 1700000000000 });
}

const first = file("first.txt");
const second = file("second.txt");
let response = await share([first]);
assert.match(response.headers.get("location") ?? "", /shared=1/);
response = await share([second]);
assert.match(response.headers.get("location") ?? "", /shared=1/);
assert.equal(JSON.stringify(Array.from(queuedFiles(), (item) => item.name)), JSON.stringify(["first.txt", "second.txt"]));

for (let batch = 0; batch < 3; batch += 1) {
  const files = Array.from({ length: 5 }, (_, index) => file(`batch-${batch}-${index}.txt`));
  response = await share(files);
  assert.match(response.headers.get("location") ?? "", /shared=1/);
}
assert.equal(queuedFiles().length, 17);

response = await share(Array.from({ length: 4 }, (_, index) => file(`overflow-${index}.txt`)));
assert.match(response.headers.get("location") ?? "", /shareError=limit/);
assert.equal(queuedFiles().length, 17, "An overflowing share must not replace or partially alter the waiting queue");

response = await share(Array.from({ length: 6 }, (_, index) => file(`too-many-${index}.txt`)));
assert.match(response.headers.get("location") ?? "", /shareError=limit/);
assert.equal(queuedFiles().length, 17, "An oversized batch must leave the existing queue unchanged");

response = await share([]);
assert.match(response.headers.get("location") ?? "", /shareError=empty/);
assert.equal(queuedFiles().length, 17);

console.log("RESA Drive Android share queue tests passed: append, queue cap, batch cap, empty share and preservation on rejected shares.");
