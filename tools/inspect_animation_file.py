import sys, re
from pathlib import Path

if len(sys.argv) < 2:
    print('Usage: inspect_animation_file.py <path-to-fbx>')
    sys.exit(2)

p = Path(sys.argv[1])
if not p.exists():
    print('FILE_NOT_FOUND', p)
    sys.exit(2)

data = p.read_bytes()
# find printable ASCII runs
runs = re.findall(rb'[\x20-\x7E]{4,200}', data)
keywords = ('anim','animation','take','pose','stack','clip','mixamo','hips','spine','walk','shoot','pistol','aim','take')
seen = set()
found = []
for r in runs:
    try:
        s = r.decode('utf-8')
    except:
        s = r.decode('latin1')
    low = s.lower()
    if any(k in low for k in keywords):
        if s not in seen:
            seen.add(s)
            found.append(s)

print(f'File: {p}\nFound {len(found)} matching strings:\n')
for s in found:
    print('-', s)

# print header
print('\n---HEADER START---')
print(data[:512])
print('---HEADER END---')
