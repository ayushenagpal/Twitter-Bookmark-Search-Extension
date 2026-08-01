const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

function makeLink(href) { return { href: `https://x.com${href}`, getAttribute: name => name === "href" ? href : null }; }
function makeArticle({ text = "A useful note about local-first tools", url = "/jane/status/123", author = "/jane", date = "2026-07-30T12:00:00.000Z" } = {}) {
  const status = makeLink(url), profile = makeLink(author);
  return {
    innerText: text,
    querySelector(selector) { if (selector === '[data-testid="tweetText"]') return { innerText: text }; if (selector === "time") return { dateTime: date }; return null; },
    querySelectorAll(selector) { if (selector === 'a[href*="/status/"]') return [status]; if (selector === 'a[href^="/"]') return [profile, status]; return []; }
  };
}
function loadContentScript(articles) {
  const store = {};
  const document = { documentElement: {}, querySelectorAll: selector => selector === "article" ? articles : [] };
  const chrome = { storage: { local: { async get(keys) { if (typeof keys === "string") return { [keys]: store[keys] }; return Object.fromEntries(keys.map(key => [key, store[key]])); }, async set(next) { Object.assign(store, next); } } }, runtime: { onMessage: { addListener() {} } } };
  const context = vm.createContext({ chrome, document, location: { pathname: "/not-bookmarks", origin: "https://x.com" }, URL, Date, Map, Promise, RegExp, setTimeout, clearTimeout, MutationObserver: class {} });
  const source = `${fs.readFileSync("content.js", "utf8")}\nglobalThis.__test = { postFromArticle, collectVisible, isBookmarksPage };`;
  vm.runInContext(source, context);
  return { context, store };
}

test("manifest is MV3 and uses persistent unlimited local storage", () => {
  const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
  assert.equal(manifest.manifest_version, 3);
  assert.ok(manifest.permissions.includes("storage"));
  assert.ok(manifest.permissions.includes("unlimitedStorage"));
  assert.equal(manifest.action.default_popup, "popup.html");
});
test("post extraction indexes the post body, author, date, and canonical URL", () => {
  const { context } = loadContentScript([]);
  const post = context.__test.postFromArticle(makeArticle());
  assert.deepEqual({ ...post }, { id: "https://x.com/jane/status/123", url: "https://x.com/jane/status/123", text: "A useful note about local-first tools", author: "jane", date: "2026-07-30T12:00:00.000Z", indexedAt: post.indexedAt, haystack: "a useful note about local-first tools jane" });
});
test("collection persists and de-duplicates bookmark records", async () => {
  const { context, store } = loadContentScript([makeArticle()]);
  context.location.pathname = "/i/bookmarks";
  assert.equal(await context.__test.collectVisible(), 1);
  assert.equal(store.bookmarks.length, 1);
  assert.equal(store.bookmarks[0].author, "jane");
  assert.equal(await context.__test.collectVisible(), 1);
  assert.equal(store.bookmarks.length, 1);
  assert.ok(store.lastIndexedAt > 0);
});
