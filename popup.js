const $ = selector => document.querySelector(selector);
const input = $("#query");
const results = $("#results");
const status = $("#status");
const indexMeta = $("#index-meta");
let bookmarks = [];

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&gt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function rank(item, words) {
  return words.reduce((score, word) => {
    const re = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    return score + (item.text.toLowerCase().startsWith(word) ? 12 : 0) + (item.haystack.match(re)?.length || 0);
  }, 0);
}

function render() {
  const words = input.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const matching = words.length
    ? bookmarks.filter(item => words.every(word => item.haystack.includes(word))).sort((a, b) => rank(b, words) - rank(a, words))
    : bookmarks.slice(0, 6);
  if (!bookmarks.length) {
    results.innerHTML = `<div class="empty"><span>↗</span><strong>Your archive starts here.</strong><p>Press Sync to open your X Bookmarks and build a local, searchable index.</p></div>`;
    return;
  }
  if (!matching.length) {
    results.innerHTML = `<div class="empty compact"><strong>No signal found.</strong><p>Try a different word, @handle, or phrase.</p></div>`;
    return;
  }
  results.innerHTML = matching.map(item => {
    const date = item.date ? new Date(item.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Saved post";
    return `<a class="result" href="${escapeHtml(item.url)}" target="_blank"><div class="result-meta"><span>@${escapeHtml(item.author)}</span><time>${date}</time></div><p>${escapeHtml(item.text)}</p><span class="arrow">↗</span></a>`;
  }).join("");
}

function updateChromeShortcut(event) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); input.focus(); }
}

async function load() {
  const data = await chrome.storage.local.get(["bookmarks", "lastIndexedAt", "syncState"]);
  bookmarks = data.bookmarks || [];
  indexMeta.textContent = bookmarks.length
    ? `${bookmarks.length.toLocaleString()} posts in your private index${data.lastIndexedAt ? " · updated " + new Date(data.lastIndexedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""}`
    : "No bookmarks indexed yet.";
  const state = data.syncState;
  status.textContent = state?.phase === "indexing" ? `Indexing… ${state.count || 0} posts found` : state?.phase === "opening" ? "Opening your Bookmarks…" : state?.phase === "complete" ? `Index refreshed · ${state.count} posts` : state?.phase === "error" ? `Sync stopped: ${state.message}` : "";
  render();
}

$("#sync").addEventListener("click", async () => { status.textContent = "Opening your Bookmarks…"; await chrome.runtime.sendMessage({ type: "OPEN_AND_SYNC" }); setTimeout(load, 500); });
$("#clear").addEventListener("click", async () => { await chrome.storage.local.remove(["bookmarks", "lastIndexedAt", "syncState"]); await load(); });
input.addEventListener("input", render);
document.addEventListener("keydown", updateChromeShortcut);
chrome.storage.onChanged.addListener(load);
load();
