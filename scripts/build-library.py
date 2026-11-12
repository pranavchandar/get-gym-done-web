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
# The dataset's own instructions are wrong for a few moves; these replace them.
CUE_FIXES = {
  '0631': ['Hang from the bar with a false grip, palms facing away, arms straight.',
           'Pull explosively, driving the bar toward your lower chest rather than your chin.',
           'As the bar reaches your chest, roll your wrists over it and lean your chest forward over the bar.',
           'Press down into a straight-arm support above the bar, like the top of a dip.',
           'Lower back through the transition under control to a dead hang.'],
  '0558': ['Hang from the bar with a false grip, palms facing away.',
           'Swing: hollow then arch, and use the swing to drive your hips toward the bar.',
           'Pull the bar to your lower chest and snap your chest over the bar.',
           'Press out to a straight-arm support above the bar.',
           'Lower under control back to a hang.'],
  '1759': ['Stand on one leg with the other leg held straight out in front of you, arms forward for balance.',
           'Sit your hips back and down, keeping the standing heel flat and the knee tracking over the toes.',
           'Lower all the way until your hamstring rests on your calf, keeping the free leg off the floor.',
           'Drive through the whole foot to stand back up without letting the free leg touch down.'],
  '0544': ['Hold a kettlebell at your chest and stand on one leg, the other leg straight out in front.',
           'Sit your hips back and down, keeping the standing heel flat and the knee over the toes.',
           'Lower all the way down, using the bell as a counterweight to stay upright.',
           'Drive through the whole foot to stand back up without letting the free leg touch down.'],
}
def fix_name(n):
  # The dataset mis-decodes the degree sign ("45в°").
  return n.replace('\u0432\u00b0', '\u00b0')
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
  steps = CUE_FIXES.get(x['id'], steps)
  rows.append({'i': x['id'], 'n': fix_name(title(x['name'].strip())), 'b': x['body_part'],
    'e': EQUIP.get(x['equipment'], 'Other'), 'p': prim, 's': sec, 'c': steps})
rows.sort(key=lambda r: r['n'].lower())
json.dump(rows, open(out, 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(rows))
