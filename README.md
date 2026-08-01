# Threadfinder

Threadfinder is a Manifest V3 Chrome extension that turns an X/Twitter Bookmarks timeline into a searchable, browser-local index. It does not need your X password, a backend, or an API key.

## Install locally

1. Open `chrome://extensions` in Chrome and enable **Developer mode**.
2. Choose **Load unpacked** and select this project folder.
3. Pin **Threadfinder**, open the extension, then press **Sync**.
4. Sign into X if prompted. Threadfinder opens your Bookmarks page, indexes posts as it scrolls, and returns searchable results in the popup.

The index lives in Chrome's persistent local extension storage and survives browser restarts. **Clear index** removes it from this browser. The extension requests Chrome's unlimited-storage permission so large bookmark archives are not constrained by the normal extension-storage quota.

## What it searches

- Full post text
- Author handles
- Hashtags and phrases contained in posts

X's official help documents how to save and view a private bookmark timeline, but does not document native search within that timeline. Threadfinder provides that local search layer.
