# Jasmine Air Writer

A small camera-based interactive art experiment.

## Features
- Uses the index fingertip as an air-writing cursor.
- Hand tracking via MediaPipe.
- White jasmine-like flowers form along the path.
- Flowers naturally detach and fall.
- Front/rear camera switching.
- Minimal interface designed to feel like an art piece rather than an AI dashboard.

## Run locally

Open the folder in VS Code and use Live Server, or:

```bash
python -m http.server 5500
```

Then visit `http://localhost:5500`.

Camera access requires localhost or HTTPS.

## GitHub Pages

Upload `index.html`, `style.css`, `app.js`, and `README.md` to a GitHub repository.
Then enable:
Settings → Pages → Deploy from a branch → main → /(root).

GitHub Pages will provide an HTTPS URL.
