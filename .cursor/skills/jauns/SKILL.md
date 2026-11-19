---
name: jauns
description: >-
  Publishes a new version of Mūzikas literatūra so the iPhone home screen icon
  updates on https://linda-ame.github.io/muzikas-literatura/ after the app is
  closed and opened again. Use when the user says /jauns, jauns, the home
  screen icon shows an old page, or asks to ship an update of this site.
---

# Jauns

The canonical address is `https://linda-ame.github.io/muzikas-literatura/` with the trailing slash. Do not give the user a different query-string address to keep.

## Publish

1. Change `build.txt` to a new value. The installed page compares it and reloads once.
2. Commit the site files and push `main`. GitHub Pages builds from `main`.
3. `sw.js` loads same-origin files from the network. Do not cache the app shell in the service worker.

Closing and opening the home screen icon loads the new page once that icon already contains this updater. Do not tell the user to delete and re-add the icon for an ordinary update.

A copy saved before the updater existed stays old until that saved page expires and the icon is opened again. GitHub keeps the page for about 10 minutes.
