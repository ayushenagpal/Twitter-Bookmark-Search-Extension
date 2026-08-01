const BOOKMARKS_URL = "https://x.com/i/bookmarks";

async function startSync() {
  const tabs = await chrome.tabs.query({ url: ["https://x.com/i/bookmarks*", "https://twitter.com/i/bookmarks*"] });
  const tab = tabs[0] || await chrome.tabs.create({ url: BOOKMARKS_URL, active: true });
  await chrome.storage.local.set({ syncState: { phase: "opening", count: 0, startedAt: Date.now() } });

  const sendStart = async () => {
    try { await chrome.tabs.sendMessage(tab.id, { type: "START_SYNC" }); }
    catch (_) { setTimeout(sendStart, 750); }
  };
  if (tab.status === "complete") sendStart();
  else {
    const onUpdated = (id, change) => {
      if (id === tab.id && change.status === "complete") {
        chrome.tabs.onUpdated.removeListener(onUpdated);
        sendStart();
      }
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
  }
  return { tabId: tab.id };
}

chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message.type === "OPEN_AND_SYNC") {
    startSync().then(respond).catch(error => respond({ error: error.message }));
    return true;
  }
});
