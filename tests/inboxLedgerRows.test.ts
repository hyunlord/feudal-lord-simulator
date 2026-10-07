import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { checkInboxLedger, fixLedgerForm, formatLedgerResult, ledgerForm, ledgerOk } from "../scripts/checks/inboxLedger.mjs";

// One ledger row per image (png, jpg, jpeg, webp, gif, svg) under assets-inbox/, judged whenever a range touches assets-inbox/ (11ca755e moved 8
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

    put("assets-inbox/retired/old.png", "o"); put("assets-inbox/w1/b.jpg", "version https://git-lfs.github.com/spec/v1\noid sha256:" + "b".repeat(64) + "\nsize 900\n"); put("assets-inbox/w1/loop.gif", "g"); put("assets-inbox/w1/mask.svg", "<svg/>");
    const noRow = checkInboxLedger({ base, head: commit(), cwd: dir });
    assert.deepEqual([noRow.rows, noRow.images, noRow.unledgered.sort()], [1, 5, ["retired/old.png", "w1/b.jpg", "w1/loop.gif", "w1/mask.svg"]]);
    assert.equal(ledgerOk(noRow), false); assert.match(formatLedgerResult(noRow), /NOROW retired\/old\.png/);

    put("assets-inbox/INBOX_LEDGER.csv", `${header}retired,retired/old.png,22,retired,,,\r\nw1,w1/a.png,00,confirmed,,,\r\nw1,w1/b.jpg,11,confirmed,,,\r\nw1,w1/loop.gif,33,confirmed,,,\r\nw1,w1/mask.svg,44,confirmed,,,\r\n`);
    const rowed = checkInboxLedger({ base, head: commit(), cwd: dir });
    assert.ok(ledgerOk(rowed)); assert.match(formatLedgerResult(rowed), /5 image\(s\) under assets-inbox\/, one row each/);

    git("rm", "-q", "assets-inbox/w1/a.png");
    const gone = checkInboxLedger({ base, head: commit(), cwd: dir });
    assert.deepEqual(gone.fileless, ["w1/a.png"]); assert.match(formatLedgerResult(gone), /NOFILE w1\/a\.png/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// New inbox JPG/JPEGs go through Git LFS (27 batch folders keep pre-2026-10-03 JPGs plain, and a new JPG put there
// lands plain too); a new image over 1 MB outside LFS is a warning. A moved or copied file is not new.
test("a new inbox JPG outside LFS fails, a large plain image warns, a moved plain JPG passes", () => {
  const dir = mkdtempSync(join(tmpdir(), "fls-inbox-lfs-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
  const put = (path: string, text: string) => { mkdirSync(join(dir, dirname(path)), { recursive: true }); writeFileSync(join(dir, path), text); };
  const pointer = (oid: string, size: number) => `version https://git-lfs.github.com/spec/v1\noid sha256:${oid.repeat(64)}\nsize ${size}\n`;
  const ledger = (...files: string[]) => put("assets-inbox/INBOX_LEDGER.csv", `wave,file,sha256,status,replaced_by,verdict_note,installed_by\r\n${files.map((file, i) => ({ file, row: `w,${file},${i},confirmed,,,\r\n` })).sort((x, y) => x.file < y.file ? -1 : 1).map(({ row }) => row).join("")}`);   // in form: sorted by file (check 6)
  const commit = () => { git("add", "-A"); git("commit", "-qm", "c"); return git("rev-parse", "HEAD"); };
  try {
    git("init", "-q"); git("config", "user.email", "t@t"); git("config", "user.name", "t");
    put("assets-inbox/old/a.jpg", "plain old jpg"); ledger("old/a.jpg");
    const base = commit();

    put("assets-inbox/new/b.jpg", "plain new jpg"); put("assets-inbox/new/c.jpeg", pointer("c", 5000)); ledger("old/a.jpg", "new/b.jpg", "new/c.jpeg");
    const plain = checkInboxLedger({ base, head: commit(), cwd: dir });
    assert.deepEqual(plain.plainJpegs, ["new/b.jpg"]); assert.equal(ledgerOk(plain), false);
    assert.match(formatLedgerResult(plain), /NOTLFS new\/b\.jpg/);

    git("rm", "-q", "assets-inbox/new/b.jpg"); put("assets-inbox/new/b.jpg", pointer("b", 4000));
    put("assets-inbox/new/big.png", "x".repeat(2 ** 20 + 1)); put("assets-inbox/new/big-lfs.png", pointer("d", 9 * 2 ** 20));
    ledger("old/a.jpg", "new/b.jpg", "new/c.jpeg", "new/big.png", "new/big-lfs.png");
    const large = checkInboxLedger({ base, head: commit(), cwd: dir });
    assert.deepEqual(large.plainJpegs, []); assert.ok(ledgerOk(large));
    assert.deepEqual(large.largePlain, [{ file: "new/big.png", bytes: 2 ** 20 + 1 }]);
    assert.match(formatLedgerResult(large), /warning: new\/big\.png is 1\.00 MB and not in Git LFS/);

    const before = git("rev-parse", "HEAD");
    mkdirSync(join(dir, "assets-inbox/retired")); git("mv", "assets-inbox/old/a.jpg", "assets-inbox/retired/a.jpg");
    ledger("retired/a.jpg", "new/b.jpg", "new/c.jpeg", "new/big.png", "new/big-lfs.png");
    const moved = checkInboxLedger({ base: before, head: commit(), cwd: dir });
    assert.deepEqual([moved.plainJpegs, moved.largePlain, ledgerOk(moved)], [[], [], true]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// Check 6 (user order 2026-10-08, decision RR11): every row ends in CRLF and the rows are in byte order of the file
// column. Render B's install commits wrote LF rows appended at the end. It fails a range that changes the ledger and
// only warns the others; --fix-form (fixLedgerForm) puts it right changing nothing but the order and the line ends.
test("the ledger keeps CRLF rows sorted by file: an LF row or an appended row fails the range that changes the ledger, and the fix only reorders and re-ends rows", () => {
  const dir = mkdtempSync(join(tmpdir(), "fls-inbox-form-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
  const put = (path: string, text: string) => { mkdirSync(join(dir, dirname(path)), { recursive: true }); writeFileSync(join(dir, path), text); };
  const commit = () => { git("add", "-A"); git("commit", "-qm", "c"); return git("rev-parse", "HEAD"); };
  const header = "wave,file,sha256,status,replaced_by,verdict_note\r\n";
  try {
    git("init", "-q"); git("config", "user.email", "t@t"); git("config", "user.name", "t"); git("config", "core.autocrlf", "false");
    put("assets-inbox/INBOX_LEDGER.csv", `${header}a,a/1.png,00,confirmed,,"note, with comma"\r\nb,b/1.png,11,confirmed,,\r\n`);
    put("assets-inbox/a/1.png", "1"); put("assets-inbox/b/1.png", "2");
    const base = commit();
    assert.deepEqual(ledgerForm(`${header}a,a/1.png,00,confirmed,,\r\n`), { notCrlf: [], unsorted: [] });

    // An install commit the way render B wrote them: its row appended at the end, with LF.
    put("assets-inbox/aa/2.png", "3");
    put("assets-inbox/INBOX_LEDGER.csv", `${header}a,a/1.png,00,confirmed,,"note, with comma"\r\nb,b/1.png,11,confirmed,,\r\naa,aa/2.png,22,confirmed,,\n`);
    const appended = checkInboxLedger({ base, head: commit(), cwd: dir });
    assert.deepEqual(appended.form.notCrlf, [4]);
    assert.deepEqual(appended.form.unsorted, [{ line: 4, file: "aa/2.png", after: "b/1.png" }]);
    assert.equal(ledgerOk(appended), false);
    const text = formatLedgerResult(appended);
    assert.match(text, /FORM 1 row\(s\) of assets-inbox\/INBOX_LEDGER\.csv end in LF, not CRLF: line 4/);
    assert.match(text, /FORM 1 row\(s\) out of the file column's byte order: line 4 aa\/2\.png \(after b\/1\.png\)/);
    assert.match(text, /Fix: node scripts\/checks\/inboxLedger\.mjs --fix-form/);
    assert.match(text, /LC_ALL=C sort -t, -k2,2/);

    // A range that leaves the ledger alone only warns.
    const formed = git("show", "HEAD:assets-inbox/INBOX_LEDGER.csv");
    put("src/x.ts", "export {};\n");
    const elsewhere = checkInboxLedger({ base: git("rev-parse", "HEAD"), head: commit(), cwd: dir });
    assert.ok(ledgerOk(elsewhere)); assert.match(formatLedgerResult(elsewhere), /warning: FORM 1 row\(s\) out of the file column's byte order/);

    // The fix: the same rows, sorted, every one ending in CRLF; a field's quoted comma untouched.
    const fixed = fixLedgerForm(`${formed}\n`);
    assert.equal(fixed, `${header}a,a/1.png,00,confirmed,,"note, with comma"\r\naa,aa/2.png,22,confirmed,,\r\nb,b/1.png,11,confirmed,,\r\n`);
    put("assets-inbox/INBOX_LEDGER.csv", fixed);
    const repaired = checkInboxLedger({ base, head: commit(), cwd: dir });
    assert.ok(ledgerOk(repaired)); assert.deepEqual(repaired.form, { notCrlf: [], unsorted: [], strict: true });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
