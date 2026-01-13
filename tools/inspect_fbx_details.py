import sys, re
from pathlib import Path
p = Path(r"c:\Users\alawl\Desktop\Game Dev Projects\ltg game\backup\Lightgun-game-websockets\public\assets\models\model.fbx")
if not p.exists():
    print('FILE_NOT_FOUND', p)
    sys.exit(2)

data = p.read_bytes()
runs = re.findall(rb'[\x20-\x7E]{4,}', data)
seen = set()
matches = []
for i,r in enumerate(runs):
    try:
        s = r.decode('utf-8')
    except:
        s = r.decode('latin1')
    low = s.lower()
    if any(k in low for k in ('take','clip','animstack','animationstack','take_','activeanimstack','motion sequence','retargeted','mixamo','anim')):
        matches.append((i,s))

# collapse near-duplicates by content
uniq = []
for i,s in matches:
    if s not in seen:
        seen.add(s)
        # capture binary context around this run for clues
        # find byte index of this run in data
        idx = data.find(s.encode('utf-8'))
        start = max(0, idx-120)
        end = min(len(data), idx+len(s.encode('utf-8'))+120)
        context = data[start:end]
        try:
            ctext = context.decode('utf-8',errors='replace')
        except:
            ctext = str(context)
        uniq.append((s, ctext))

print('Found %d unique text matches related to animations or clips:\n' % len(uniq))
for s,ctext in uniq:
    print('---')
    print('MATCH:', s)
    print('CONTEXT SNIPPET:\n')
    # print cleaned lines
    for line in ctext.splitlines():
        if any(x in line.lower() for x in ('take','clip','animation','anim','time','stack','mixamo','motion','take_')):
            print(line)
    print('\n')

# Also output a compact list of likely animation names
candidates = []
for s,_ in uniq:
    # extract substrings that look like names: words with letters/numbers/_- and length 3-80
    for m in re.finditer(r'[A-Za-z0-9_\-\.]{3,80}', s):
        tok = m.group(0)
        if any(k in tok.lower() for k in ('take','clip','anim','mixamo')) or tok.lower().startswith('t'):
            candidates.append(tok)

candidates = list(dict.fromkeys(candidates))
print('Candidate names:')
for c in candidates:
    print('-', c)
