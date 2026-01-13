import sys, re
from pathlib import Path
p = Path(r"c:\Users\alawl\Desktop\Game Dev Projects\ltg game\backup\Lightgun-game-websockets\public\assets\models\model.fbx")
if not p.exists():
    print('FILE_NOT_FOUND', p)
    sys.exit(2)
data = p.read_bytes()
# find printable ASCII runs
runs = re.findall(rb'[\x20-\x7E]{4,}', data)
seen = set()
keywords = ('anim','animation','take','pose','stack','clip','time','node','model','skeleton','skin','deform')
for r in runs:
    try:
        s = r.decode('utf-8')
    except:
        s = r.decode('latin1')
    low = s.lower()
    if any(k in low for k in keywords):
        if s not in seen:
            seen.add(s)
            print(s)
# also print first 512 bytes header
print('\n---HEADER (first 512 bytes)---')
print(data[:512])
print('\n---FOUND %d matching strings---' % len(seen))
