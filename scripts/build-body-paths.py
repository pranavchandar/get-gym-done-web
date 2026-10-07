# Regenerate src/data/body_paths.json from MuscleMap (MIT) by Melih Colpan.
#   git clone --depth 1 https://github.com/melihcolpan/MuscleMap
#   python3 scripts/build-body-paths.py MuscleMap/Sources/MuscleMap/Data src/data/body_paths.json
# Keeps whole muscles only; MuscleMap sub-groups (upperChest, frontDeltoid, ...) are dropped.
import re, json, sys
src, out = sys.argv[1], sys.argv[2]
SLUG = {'lowerBack':'lower-back','upperBack':'upper-back','hipFlexors':'hip-flexors'}
VB = {('male','front'):'0 95 727 1280',('male','back'):'718 95 727 1280',('female','front'):'0 0 650 1450',('female','back'):'823 0 650 1450'}
res = {}
for g in ('male','female'):
  res[g] = {}
  for side in ('front','back'):
    txt = open(f"{src}/{g.capitalize()}{side.capitalize()}Paths.swift").read()
    parts = {}
    for m in re.finditer(r'BodyPartPathData\(\s*slug:\s*\.(\w+)(.*?)\n\s{8}\)', txt, re.S):
      slug = m.group(1)
      if slug not in SLUG and not slug.islower(): continue  # drop sub-groups (camelCase)
      slug = SLUG.get(slug, slug)
      paths = re.findall(r"\"([Mm][^\"]+)\"", m.group(2))
      parts.setdefault(slug, []).extend(paths)
    res[g][side] = {'vb': VB[(g,side)], 'p': parts}
json.dump(res, open(out,'w'), separators=(',',':'))
for g in res:
  for s in res[g]: print(g, s, sorted(res[g][s]['p']))
