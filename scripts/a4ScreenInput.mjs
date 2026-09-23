#!/usr/bin/env node
// Player-facing Chrome CDP adapter. Commands deliberately expose pixels and input only.
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const args = parseArgs(process.argv.slice(2));
const command = args._[0];
if (command === 'help' || command === undefined) {
  process.stdout.write('Usage: node scripts/a4ScreenInput.mjs screenshot --out FILE.jpg [--cdp-port 9223]\n'
    + '       node scripts/a4ScreenInput.mjs click --x N --y N\n'
    + '       node scripts/a4ScreenInput.mjs drag --from-x N --from-y N --to-x N --to-y N [--steps 12]\n'
    + '       node scripts/a4ScreenInput.mjs key --key Escape|Enter|Space|ArrowLeft|A|0\n'
    + '       node scripts/a4ScreenInput.mjs wheel --x N --y N --delta-y N [--delta-x 0]\n');
  process.exit(command === 'help' ? 0 : 2);
}
if (!['screenshot', 'click', 'drag', 'key', 'wheel'].includes(command)) throw new Error('Unsupported screen command');

function parseArgs(argv) {
  const parsed = { _: [] };
  for (let index = 0; index < argv.length; index++) {
    const word = argv[index];
    if (!word.startsWith('--')) { parsed._.push(word); continue; }
    if (word.length === 2 || index + 1 >= argv.length || argv[index + 1].startsWith('--')) throw new Error(`Missing value for ${word}`);
    const name = word.slice(2);
    if (Object.hasOwn(parsed, name)) throw new Error(`Duplicate flag: ${word}`);
    parsed[name] = argv[++index];
  }
  return parsed;
}

function integer(name, minimum, maximum) {
  const value = Number(args[name]);
  if (args[name] === undefined || !Number.isInteger(value) || value < minimum || value > maximum) throw new Error(`Invalid --${name}`);
  return value;
}

function optionalInteger(name, fallback, minimum, maximum) {
  return args[name] === undefined ? fallback : integer(name, minimum, maximum);
}

class Cdp {
  constructor(url) { this.url = url; this.serial = 0; this.pending = new Map(); }
  async open() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolveOpen, rejectOpen) => {
      const timeout = setTimeout(() => rejectOpen(new Error('CDP open timed out')), 10000);
      this.socket.addEventListener('open', () => { clearTimeout(timeout); resolveOpen(); }, { once: true });
      this.socket.addEventListener('error', event => { clearTimeout(timeout); rejectOpen(new Error(`CDP open error: ${event.message ?? 'unknown'}`)); }, { once: true });
    });
    this.socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id === undefined) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      clearTimeout(pending.timeout);
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`CDP ${pending.method}: ${message.error.message}`));
      else pending.resolve(message.result);
    });
    this.socket.addEventListener('close', () => {
      for (const pending of this.pending.values()) { clearTimeout(pending.timeout); pending.reject(new Error('CDP closed')); }
      this.pending.clear();
    });
  }
  send(method, params) {
    const id = ++this.serial;
    return new Promise((resolveSend, rejectSend) => {
      const timeout = setTimeout(() => { this.pending.delete(id); rejectSend(new Error(`CDP ${method} timed out`)); }, 20000);
      this.pending.set(id, { resolve: resolveSend, reject: rejectSend, timeout, method });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  close() { this.socket?.close(); }
}

async function screenTarget() {
  const port = optionalInteger('cdp-port', 9223, 1, 65535);
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!response.ok) throw new Error(`CDP target list HTTP ${response.status}`);
  const prefix = args['url-prefix'] ?? 'http://127.0.0.1:4173/';
  const pages = (await response.json()).filter(target => target.type === 'page' && target.url.startsWith(prefix)
    && target.webSocketDebuggerUrl && (!args['target-id'] || target.id === args['target-id']));
  if (pages.length !== 1) throw new Error(`Expected one screen at ${prefix}, found ${pages.length}; use --target-id if necessary`);
  const cdp = new Cdp(pages[0].webSocketDebuggerUrl);
  await cdp.open();
  return cdp;
}

function jpegSize(bytes) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('Capture is not JPEG');
  for (let at = 2; at < bytes.length - 9;) {
    if (bytes[at] !== 0xff) throw new Error('Invalid JPEG marker');
    while (bytes[at] === 0xff) at++;
    const marker = bytes[at++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    const length = bytes.readUInt16BE(at);
    if (length < 2 || at + length > bytes.length) throw new Error('Invalid JPEG section length');
    if ((marker >= 0xc0 && marker <= 0xcf) && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: bytes.readUInt16BE(at + 3), width: bytes.readUInt16BE(at + 5) };
    }
    at += length;
  }
  throw new Error('JPEG dimensions unavailable');
}

const keyNames = {
  Escape: ['Escape', 'Escape', 27], Enter: ['Enter', 'Enter', 13], Space: [' ', 'Space', 32],
  Tab: ['Tab', 'Tab', 9], Backspace: ['Backspace', 'Backspace', 8], Delete: ['Delete', 'Delete', 46],
  ArrowLeft: ['ArrowLeft', 'ArrowLeft', 37], ArrowUp: ['ArrowUp', 'ArrowUp', 38],
  ArrowRight: ['ArrowRight', 'ArrowRight', 39], ArrowDown: ['ArrowDown', 'ArrowDown', 40],
};

function keyDefinition(input) {
  if (keyNames[input]) return keyNames[input];
  if (/^[A-Za-z]$/.test(input ?? '')) return [input.toLowerCase(), `Key${input.toUpperCase()}`, input.toUpperCase().charCodeAt(0)];
  if (/^[0-9]$/.test(input ?? '')) return [input, `Digit${input}`, input.charCodeAt(0)];
  throw new Error('Unsupported key; use a named key, A-Z, or 0-9');
}

async function run(cdp) {
  if (command === 'screenshot') {
    if (!args.out || !/\.jpe?g$/i.test(args.out)) throw new Error('--out must name a .jpg or .jpeg file');
    const image = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 85, captureBeyondViewport: false, fromSurface: true });
    const bytes = Buffer.from(image.data, 'base64');
    const size = jpegSize(bytes);
    if (size.width !== 1600 || size.height !== 1100) throw new Error(`Expected 1600x1100 viewport, got ${size.width}x${size.height}; no file saved`);
    const output = resolve(args.out);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, bytes, { flag: 'wx' });
    process.stdout.write(`${output} JPEG ${size.width}x${size.height} sha256=${createHash('sha256').update(bytes).digest('hex')}\n`);
    return;
  }
  if (command === 'click') {
    const x = integer('x', 0, 1599), y = integer('y', 0, 1099);
    const button = args.button ?? 'left';
    if (!['left', 'right', 'middle'].includes(button)) throw new Error('Unsupported mouse button');
    const buttons = { left: 1, right: 2, middle: 4 }[button];
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button, buttons, clickCount: 1 });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button, buttons: 0, clickCount: 1 });
    process.stdout.write(`click ${button} ${x},${y}\n`);
    return;
  }
  if (command === 'drag') {
    const x0 = integer('from-x', 0, 1599), y0 = integer('from-y', 0, 1099);
    const x1 = integer('to-x', 0, 1599), y1 = integer('to-y', 0, 1099);
    const steps = optionalInteger('steps', 12, 2, 100);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0, y: y0, button: 'none', buttons: 0 });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: y0, button: 'left', buttons: 1, clickCount: 1 });
    for (let step = 1; step <= steps; step++) {
      const ratio = step / steps;
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: Math.round(x0 + (x1 - x0) * ratio), y: Math.round(y0 + (y1 - y0) * ratio), button: 'left', buttons: 1 });
      await new Promise(resolveDelay => setTimeout(resolveDelay, 16));
    }
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x1, y: y1, button: 'left', buttons: 0, clickCount: 1 });
    process.stdout.write(`drag ${x0},${y0} -> ${x1},${y1}\n`);
    return;
  }
  if (command === 'key') {
    const [key, code, virtualKey] = keyDefinition(args.key);
    const base = { key, code, windowsVirtualKeyCode: virtualKey, nativeVirtualKeyCode: virtualKey, modifiers: 0 };
    await cdp.send('Input.dispatchKeyEvent', { ...base, type: 'keyDown', ...(key.length === 1 ? { text: key } : {}) });
    await cdp.send('Input.dispatchKeyEvent', { ...base, type: 'keyUp' });
    process.stdout.write(`key ${code}\n`);
    return;
  }
  const x = integer('x', 0, 1599), y = integer('y', 0, 1099);
  const deltaY = integer('delta-y', -10000, 10000);
  const deltaX = optionalInteger('delta-x', 0, -10000, 10000);
  if (deltaX === 0 && deltaY === 0) throw new Error('Wheel delta must be nonzero');
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX, deltaY, button: 'none', buttons: 0 });
  process.stdout.write(`wheel ${x},${y} ${deltaX},${deltaY}\n`);
}

const cdp = await screenTarget();
try { await run(cdp); } finally { cdp.close(); }
