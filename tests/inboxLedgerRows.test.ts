import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { checkInboxLedger, formatLedgerResult, ledgerOk } from "../scripts/checks/inboxLedger.mjs";

// One ledger row per PNG/JPG under assets-inbox/, judged whenever a range touches assets-inbox/ (11ca755e moved 8
// retired sprites in without rows and passed).
test("an inbox change needs the images and the ledger's file column to be the same set", () => {
  const dir = mkdtempSync(join(tmpdir(), "fls-inbox-rows-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
  const put = (path: string, text: string) => { mkdirSync(join(dir, dirname(path)), { recursive: true }); writeFileSync(join(dir, path), text); };
  const header = "wave,file,sha256,status,replaced_by,verdict_note,installed_by\r\n";
  const commit = () => { git("add", "-A"); git("commit", "-qm", "c"); return git("rev-parse", "HEAD"); };
  try {
    git("init", "-q"); git("config", "user.email", "t@t"); git("config", "user.name", "t");
    put("assets-inbox/INBOX_LEDGER.csv", `${header}w1,w1/a.png,00,confirmed,,,\r\n`); put("assets-inbox/w1/a.png", "a"); put("assets-inbox/w1/notes.md", "n");
    const base = commit();
    put("src/x.ts", "export {};\n");
    const elsewhere = checkInboxLedger({ base, head: commit(), cwd: dir });
    assert.equal(elsewhere.images, null); assert.ok(ledgerOk(elsewhere));

    put("assets-inbox/retired/old.png", "o"); put("assets-inbox/w1/b.jpg", "b");
    const noRow = checkInboxLedger({ base, head: commit(), cwd: dir });
    assert.deepEqual([noRow.rows, noRow.images, noRow.unledgered.sort()], [1, 3, ["retired/old.png", "w1/b.jpg"]]);
    assert.equal(ledgerOk(noRow), false); assert.match(formatLedgerResult(noRow), /NOROW retired\/old\.png/);

    put("assets-inbox/INBOX_LEDGER.csv", `${header}w1,w1/a.png,00,confirmed,,,\r\nw1,w1/b.jpg,11,confirmed,,,\r\nretired,retired/old.png,22,retired,,,\r\n`);
    const rowed = checkInboxLedger({ base, head: commit(), cwd: dir });
    assert.ok(ledgerOk(rowed)); assert.match(formatLedgerResult(rowed), /3 image\(s\) under assets-inbox\/, one row each/);

    git("rm", "-q", "assets-inbox/w1/a.png");
    const gone = checkInboxLedger({ base, head: commit(), cwd: dir });
    assert.deepEqual(gone.fileless, ["w1/a.png"]); assert.match(formatLedgerResult(gone), /NOFILE w1\/a\.png/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
