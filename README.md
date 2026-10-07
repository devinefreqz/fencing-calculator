# Fencing Calculator

Mobile-first web app for Colourbond fencing measurements (AU). Live: https://devinefreqz.github.io/fencing-calculator/

## Tools

### Step-downs
Panels stay level, posts stay plumb. Fall is taken in equal vertical steps at each bay.

```
step height = total fall ÷ (posts − 1)
```

### Post spacing
Equal centres along the run — never over your max bay.

```
bays = ceil(length ÷ max bay)
centres = length ÷ bays
posts = bays + 1
```

### Materials take-off
Panels, posts + caps, and rails (no concrete).

```
panels = ceil(run length ÷ panel cover width)
posts  = from max bay (as above) or entered directly
caps   = posts (optional)
rail pieces = rails per bay × bays
total rail length = run length × rails per bay
```

Panels cover the run by effective cover width (brands vary). Rails are counted as per-bay pieces; total length is the continuous-track equivalent.

## Open locally

No build step. Open `index.html` or:

```bash
python3 -m http.server 8080
```

## Files

| File | Role |
|------|------|
| `index.html` | Structure & copy (AU English) |
| `styles.css` | Mobile-first layout & theme |
| `app.js` | All three tools |
