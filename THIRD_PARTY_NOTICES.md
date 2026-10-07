# Third-party notices

Get Gym Done — Web bundles data from the projects below. Each keeps its own license.

## Body diagram geometry — MuscleMap

`src/data/body_paths.json` (the front/back body outlines every muscle map is drawn
from) is converted from [**MuscleMap**](https://github.com/melihcolpan/MuscleMap) by
Melih Colpan. MuscleMap ships its path data as Swift source; the paths were converted
to JSON by `scripts/build-body-paths.py`, its sub-group shapes were dropped, and
nothing else about the artwork was changed.

```
MIT License

Copyright (c) 2026 Melih Colpan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Exercise library — exercises-dataset

`src/data/exercise_library.json` (1,324 exercise names, body parts, equipment, target
and secondary muscles, and English instructions) is derived from
[**hasaneyldrm/exercises-dataset**](https://github.com/hasaneyldrm/exercises-dataset)
by `scripts/build-library.py`, which maps its muscle and equipment names onto this
app's vocabulary and drops the generic "repeat for reps" step.

Only the dataset's **text data** is used; that part is MIT-licensed. The dataset's
exercise **images and GIFs are © Gym visual (https://gymvisual.com/)**, are not covered
by its MIT license, and are **not** included in or loaded by this app.

```
MIT License

Copyright (c) 2026 Hasan Emir Yıldırım

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation and data files (the "Software"),
to deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Feature ideas — openGym

Several features (muscle-balance map, estimated 1RM, screen wake lock, importers from
other trackers, the equipment filter, bodyweight goal line) were inspired by
[openGym](https://github.com/DuarteSantos8/openGym) (as forked at
[arvids-unavailable/openGym](https://github.com/arvids-unavailable/openGym)). openGym is AGPL-3.0; no openGym
code or assets are included here — the features were implemented independently for
this codebase.
