const isBookmarksPage = () => /\/i\/bookmarks/.test(location.pathname);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

function postFromArticle(article) {
  const statusLink = [...article.querySelectorAll('a[href*="/status/"]')]
    .find(link => /\/status\/\d+/.test(link.getAttribute('href') || ""));
  if (!statusLink) return null;
  const url = new URL(statusLink.href, location.origin).href.split("?")[0];
  const textNode = article.querySelector('[data-testid="tweetText"]');
  const text = (textNode ? textNode.innerText : article.innerText).replace(/\s+/g, " ").trim();
  if (!text) return null;
  const time = article.querySelector('time');
  const profileLink = [...article.querySelectorAll('a[href^="/"]')]
    .find(link => /^\/[A-Za-z0-9_]+$/.test(link.getAttribute('href') || ""));
  const author = profileLink ? profileLink.getAttribute('href').slice(1) : "Unknown";
  return { id: url, url, text, author, date: time?.dateTime || "", indexedAt: Date.now(), haystack: `${text} ${author}`.toLowerCase() };
}

let collectionInFlight = null;
function collectVisible() {
  if (collectionInFlight) return collectionInFlight;
  collectionInFlight = (async () => {
    if (!isBookmarksPage()) return 0;
    const candidates = [...document.querySelectorAll('article')].map(postFromArticle).filter(Boolean);
    if (!candidates.length) {
      const { bookmarks = [] } = await chrome.storage.local.get("bookmarks");
      return bookmarks.length;
    }
    const { bookmarks = [] } = await chrome.storage.local.get("bookmarks");
    const byId = new Map(bookmarks.map(item => [item.id, item]));
    candidates.forEach(item => byId.set(item.id, { ...byId.get(item.id), ...item }));
    const next = [...byId.values()].sort((a, b) => b.indexedAt - a.indexedAt);
    await chrome.storage.local.set({ bookmarks: next, lastIndexedAt: Date.now() });
    return next.length;
  })();
  return collectionInFlight.finally(() => { collectionInFlight = null; });
}

let collectionQueued = false;
function scheduleCollection() {
  if (collectionQueued) return;
  collectionQueued = true;
  setTimeout(() => {
    collectionQueued = false;
    collectVisible();
  }, 300);
}

let syncing = false;
async function syncAll() {
  if (syncing || !isBookmarksPage()) return;
  syncing = true;
  let noNewPostsPasses = 0, previousTotal = 0, total = 0;
  try {
    window.scrollTo({ top: 0, behavior: "auto" });
    await pause(900);
    for (let pass = 0; pass < 500 && noNewPostsPasses < 12; pass += 1) {
      total = await collectVisible();
      await chrome.storage.local.set({ syncState: { phase: "indexing", count: total, pass: pass + 1, startedAt: Date.now() } });
      window.scrollBy({ top: Math.round(window.innerHeight * 1.5), behavior: "smooth" });
      await pause(900);
      noNewPostsPasses = total <= previousTotal ? noNewPostsPasses + 1 : 0;
      previousTotal = total;
    }
    await collectVisible();
    const { bookmarks = [] } = await chrome.storage.local.get("bookmarks");
    await chrome.storage.local.set({ syncState: { phase: "complete", count: bookmarks.length, finishedAt: Date.now() } });
  } catch (error) {
    await chrome.storage.local.set({ syncState: { phase: "error", message: error.message } });
  } finally { syncing = false; }
}

chrome.runtime.onMessage.addListener(message => { if (message.type === "START_SYNC") syncAll(); });
if (isBookmarksPage()) {
  collectVisible();
  new MutationObserver(scheduleCollection).observe(document.documentElement, { childList: true, subtree: true });
}
