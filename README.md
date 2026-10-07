# Fencing Calculator

Mobile-first web app for fencing measurements. **v1** is a Colourbond step-down calculator for Australian site use.

Colourbond fences stay plumb and level — they don’t rake with the ground. Fall is taken in **equal vertical steps** at each bay.

## Formula

```
step height = total fall ÷ (posts − 1)
```

- Number of steps = number of bays = posts − 1  
- Panels stay level; posts stay plumb  
- Step heights are shown to the nearest millimetre for site use

## Open locally

No build step. Either:

1. **Double-click / open** `index.html` in a browser, or  
2. From this folder, serve it:

```bash
cd /workspace/fencing-calculator
python3 -m http.server 8080
```

Then open http://localhost:8080

## Live site

Once GitHub Pages is enabled: https://devinefreqz.github.io/fencing-calculator/

## Files

| File         | Role                          |
|--------------|-------------------------------|
| `index.html` | Structure & copy (AU English) |
| `styles.css` | Mobile-first layout & theme   |
| `app.js`     | Step-down maths & diagram     |

## v1 features

- Total fall in **mm** or **m**
- Count by **posts** or **bays** (kept in sync)
- Live equal step height, drop table, and stepped diagram
- Rounding note when fall doesn’t divide evenly into whole millimetres
- Shell nav for future tools (Materials, Post spacing — Coming soon)

## Assumptions

- High end is Post 1 (0 cumulative drop); drop increases toward the low end  
- Rounding is to the nearest 1 mm when working from millimetres  
- Bays = posts − 1 always
