# Fencing Calculator

Mobile-first web app for fencing measurements. **v1** is a Colourbond step-down calculator for Australian site use.

Colourbond fences stay plumb and level — they don’t rake with the ground. Fall is taken in **equal vertical steps** at each bay.

## Live site

**https://devinefreqz.github.io/fencing-calculator/**

### Enable GitHub Pages (one-time)

Pages isn’t on yet — do either:

**Option A — Deploy from branch (simplest)**  
1. Open [Settings → Pages](https://github.com/devinefreqz/fencing-calculator/settings/pages)  
2. Under **Build and deployment** → **Source**, choose **Deploy from a branch**  
3. Branch: **main** / folder: **/ (root)** → Save  
4. Wait ~1 minute, then open the live URL above

**Option B — GitHub Actions**  
1. Same Pages settings → Source: **GitHub Actions**  
2. Re-run the **Deploy to GitHub Pages** workflow under Actions  
3. When it goes green, open the live URL

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
