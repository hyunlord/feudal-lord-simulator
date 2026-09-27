import re, json, glob, os
def ts_consts(path):
    """Return {constName: parsed JSON value} for `export const NAME[: T] = <json-ish> [as const];` blocks."""
    t = open(path, encoding='utf-8').read()
    out = {}
    for m in re.finditer(r'export const (\w+)(?:\s*:\s*[^=]+)?\s*=\s*', t):
        start = m.end()
        if t[start] not in '[{': continue
        # brace-match
        depth = 0; i = start; instr = None
        while i < len(t):
            ch = t[i]
            if instr:
                if ch == '\\': i += 2; continue
                if ch == instr: instr = None
            elif ch in '"\'`': instr = ch
            elif ch in '[{': depth += 1
            elif ch in ']}':
                depth -= 1
                if depth == 0: break
            i += 1
        s = t[start:i+1]
        s = re.sub(r'//[^\n]*', '', s)
        s = re.sub(r'([{,]\s*)([A-Za-z_][\w]*)\s*:', r'\1"\2":', s)
        s = re.sub(r',(\s*[}\]])', r'\1', s)
        try: out[m.group(1)] = json.loads(s)
        except Exception as e: out[m.group(1)] = ('ERR', str(e)[:80])
    return out
if __name__ == '__main__':
    for p in sorted(glob.glob('../a1trunk/src/**/*.generated.ts', recursive=True)):
        c = ts_consts(p)
        print(os.path.basename(p), {k: (type(v).__name__ if not (isinstance(v, tuple)) else v) for k, v in c.items()})
