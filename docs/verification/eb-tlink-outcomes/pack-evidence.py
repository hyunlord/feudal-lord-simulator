from pathlib import Path
import gzip, hashlib, io, json, sys, tarfile
source, destination, seed_arg = map(str, sys.argv[1:])
source, destination = Path(source), Path(destination)
seed = int(seed_arg)
paths = [source / f'seed-{seed}.json', *sorted((source / f'seed-{seed}').iterdir())]
assert paths and all(p.is_file() for p in paths)
manifest = json.loads((source / f'seed-{seed}' / 'manifest.json').read_text())
assert manifest['seed'] == seed and manifest['valid'] and manifest['replayVerified']
sha = lambda b: hashlib.sha256(b).hexdigest()
rows = []
buffer = io.BytesIO()
with tarfile.open(fileobj=buffer, mode='w') as archive:
    for path in paths:
        raw = path.read_bytes()
        name = path.relative_to(source).as_posix()
        member = tarfile.TarInfo(name)
        member.size = len(raw)
        member.mode = 0o644
        archive.addfile(member, io.BytesIO(raw))
        rows.append({'path': name, 'bytes': len(raw), 'sha256': sha(raw)})
compressed = gzip.compress(buffer.getvalue(), compresslevel=9, mtime=0)
assert len(compressed) < 3_000_000, 'Review evidence size; do not split to evade the budget'
with tarfile.open(fileobj=io.BytesIO(compressed), mode='r:gz') as archive:
    assert archive.getnames() == [r['path'] for r in rows]
    for row in rows:
        raw = archive.extractfile(row['path']).read()
        assert len(raw) == row['bytes'] and sha(raw) == row['sha256']
output = destination / f'seed-{seed}'
output.mkdir(parents=True, exist_ok=False)
(output / 'evidence.tar.gz').write_bytes(compressed)
record = {'seed': seed, 'sourceRevision': manifest['sourceRevision'], 'archive': 'evidence.tar.gz', 'archiveBytes': len(compressed), 'archiveSha256': sha(compressed), 'members': rows, 'verified': 'Every member re-read from gzip/tar and matched to original bytes; no data filtering.'}
(output / 'archive.json').write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps({k:v for k,v in record.items() if k != 'members'}))
