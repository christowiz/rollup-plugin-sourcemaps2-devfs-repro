# Repro: navigating to `/dev` crashes the Vite dev server (macOS)

```sh
pnpm install
pnpm dev
```

Then open `http://localhost:5173/dev` in a browser, or:

```sh
curl -s -o /dev/null -w '%{http_code}\n' -H 'Sec-Fetch-Dest: document' http://localhost:5173/dev
```

Expected: `200` and the app shell, as for any other client-side route (try `/search`). Actual: `500` from `vite:import-analysis` (`File: /dev`, "content contains invalid JS syntax"), then the dev server exits:

```
node:events:505
    throw er; // Unhandled 'error' event
Error: EBADF: bad file descriptor, lstat '/dev/fd/18'
Emitted 'error' event on FSWatcher instance
```

## What happens

Vite treats the extensionless path `/dev` as a module request and passes it to plugin `load` hooks. The plugin's default `readFile` calls `fs.readFile('/dev')`. On macOS devfs permits `read()` on that directory, so it succeeds and the raw directory bytes are returned as module source. The hook then calls `addWatchFile('/dev')`, and the watcher walks `/dev/fd/*` and hits `EBADF`.

The plugin defect (read a directory, return its bytes, watch it) is the same on every Vite version. Two Vite changes since then hide it from most users, which is why this repro pins Vite 7.1.7:

| Vite change | Shipped in | Effect on this bug |
| --- | --- | --- |
| [#20866](https://github.com/vitejs/vite/pull/20866) skip JS responses for `Sec-Fetch-Dest: document` requests | 7.1.8 (2025-10-02) | A browser navigation no longer reaches `load`. Non-document requests for `/dev` still get the 500 and still crash the server. |
| [#23503](https://github.com/vitejs/vite/pull/23503) add an `error` listener to the file watcher | 8.3.2 (2026-10-01) | The `EBADF` is logged as `file watcher error` instead of exiting the process. |

Measured on macOS 15 with `rollup-plugin-sourcemaps2@0.5.9`:

| Vite | Browser navigation to `/dev` | `curl /dev` (non-document) |
| --- | --- | --- |
| 5.4.21, 6.4.4, 7.1.7 | 500, process exits | 500, process exits |
| 7.1.8 to 8.3.1 | 200 | 500, process exits |
| 8.3.2 and later | 200 | 500, watcher error logged, server stays up |

Vite 5.4.21 and 6.4.4 are the current releases of their lines and still crash from a browser.

On Linux the request only fails if the filesystem allows reading a directory; on ext4 `fs.readFile` fails with `EISDIR` and the plugin falls through correctly. The fix (stat before read in the default `readFile`) makes `/dev` return the app shell in every row above.
