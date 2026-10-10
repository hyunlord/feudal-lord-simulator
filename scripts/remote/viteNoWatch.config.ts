// The dev server with file watching off, for audits that only need its transforms (?pseudo-long=1), not hot reload:
// a watched run folder costs thousands of inotify watches, and the DGX's 65536 (max_user_watches) ran out when two
// sessions' servers watched their run folders at once (ENOSPC). Vite 8: `server.watch: null` disables the watcher.
//   node_modules/.bin/vite --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port <port> --strictPort
// RR26 measured (a′): when the geometry audit records what the server reads (FLS_TRACE_DIR), the files Vite bundled the
// config from are written to <dir>/<pid>.config — Rolldown reads them natively, out of the recorder's sight.
import { appendFileSync } from "node:fs";
import type { Plugin, UserConfig } from "vite";
import base from "../../vite.config";

const traceConfig: Plugin = {
  name: "fls-trace-config",
  configResolved(resolved) {
    const dir = process.env.FLS_TRACE_DIR;
    if (dir) try { appendFileSync(`${dir}/${process.pid}.config`, resolved.configFileDependencies.map(file => `${file}\n`).join("")); } catch { /* the record misses them: the gate sees no config files and the measurement is checked complete */ }
  },
};

const config: UserConfig = { ...base, plugins: [...(base.plugins ?? []), traceConfig], server: { ...base.server, watch: null } };
export default config;
