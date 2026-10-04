import type { UserConfig } from "vite";
import base from "./vite.config";
const config: UserConfig = { ...base, server: { ...base.server, watch: null, fs: { allow: ["/home/hyunlord/fls-art-review/astra-nat5-two-revisions-20261004", "/home/hyunlord/fls-runs/engine-LME9b-ta13-2a71fc4/node_modules"] } } };
export default config;
