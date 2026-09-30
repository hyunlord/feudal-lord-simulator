// UI-AUDIT-1 fix A: the project's Vite config without the file watcher, for one-shot DGX captures. Several dev servers
// at once (other sessions' runs plus a before / after pair) pass the DGX's 65536 inotify watches (ENOSPC, the server
// dies at start); a capture never needs a reload. Copied next to a base worktree's own config to serve that tree.
import { mergeConfig, type UserConfig } from "vite";
import config from "../vite.config";

export default mergeConfig(config as UserConfig, { server: { watch: null } });
