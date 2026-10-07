# Regenerate src/data/exercise_library.json from hasaneyldrm/exercises-dataset (MIT data).
#   git clone --depth 1 https://github.com/hasaneyldrm/exercises-dataset
#   python3 scripts/build-library.py exercises-dataset/data/exercises.json src/data/exercise_library.json
# Text only. The dataset images/GIFs are (c) Gym visual and are NOT redistributed here.
import json, re, sys
src, out = sys.argv[1], sys.argv[2]
TARGET = {'abs':'Abs','pectorals':'Chest','biceps':'Biceps','glutes':'Glutes','delts':'Shoulders',
  'triceps':'Triceps','upper back':'Mid Back','lats':'Lats','calves':'Calves','quads':'Quads',
  'forearms':'Forearms','cardiovascular system':'Cardio','hamstrings':'Hamstrings','spine':'Lower Back',
  'traps':'Traps','adductors':'Adductors','serratus anterior':'Serratus','abductors':'Abductors',
  'levator scapulae':'Neck'}
SECONDARY = {'shoulders':'Shoulders','hamstrings':'Hamstrings','forearms':'Forearms','triceps':'Triceps',
  'biceps':'Biceps','quadriceps':'Quads','calves':'Calves','glutes':'Glutes','core':'Core','chest':'Chest',
  'hip flexors':'Hip Flexors','obliques':'Obliques','lower back':'Lower Back','rhomboids':'Mid Back',
  'trapezius':'Traps','upper back':'Mid Back','traps':'Traps','deltoids':'Shoulders','rear deltoids':'Rear Delts',
  'brachialis':'Brachialis','back':'Back','rotator cuff':'Rotator Cuff','latissimus dorsi':'Lats','soleus':'Calves',
  'wrists':'Forearms','upper chest':'Upper Chest','wrist flexors':'Forearms','wrist extensors':'Forearms',
  'abdominals':'Abs','grip muscles':'Forearms','lower abs':'Abs','lats':'Lats','groin':'Adductors',
  'inner thighs':'Adductors','shins':'Shins','sternocleidomastoid':'Neck'}
EQUIP = {'body weight':'Bodyweight','dumbbell':'Dumbbell','cable':'Cable','barbell':'Barbell',
  'olympic barbell':'Barbell','ez barbell':'EZ Bar','trap bar':'Trap Bar','leverage machine':'Machine',
  'sled machine':'Machine','smith machine':'Smith Machine','band':'Band','resistance band':'Band',
  'kettlebell':'Kettlebell','weighted':'Weighted','stability ball':'Stability Ball','assisted':'Assisted',
  'medicine ball':'Medicine Ball','rope':'Rope','roller':'Roller','wheel roller':'Roller','bosu ball':'Bosu Ball'}
def title(n):
  return re.sub(r"(^|[\s(/-])([a-z])", lambda m: m.group(1)+m.group(2).upper(), n)
rows = []
for x in json.load(open(src)):
  prim = TARGET.get(x['target'])
  if not prim: raise SystemExit('unmapped target ' + x['target'])
  sec = []
  for m in x.get('secondary_muscles') or []:
    v = SECONDARY.get(m)
    if v and v != prim and v not in sec: sec.append(v)
  steps = [s.strip() for s in x['instruction_steps']['en'] if s.strip() and not re.match(r'(?i)repeat\b', s.strip())]
  rows.append({'i': x['id'], 'n': title(x['name'].strip()), 'b': x['body_part'],
    'e': EQUIP.get(x['equipment'], 'Other'), 'p': prim, 's': sec, 'c': steps})
rows.sort(key=lambda r: r['n'].lower())
json.dump(rows, open(out, 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(rows))
