// The dev server with file watching off, for audits that only need its transforms (?pseudo-long=1), not hot reload:
// a watched run folder costs thousands of inotify watches, and the DGX's 65536 (max_user_watches) ran out when two
// sessions' servers watched their run folders at once (ENOSPC). Vite 8: `server.watch: null` disables the watcher.
//   node_modules/.bin/vite --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port <port> --strictPort
import type { UserConfig } from "vite";
import base from "../../vite.config";

const config: UserConfig = { ...base, server: { ...base.server, watch: null } };
export default config;
