# ProTotype

A calm, account-free typing speed test built with React, Vite, Express, and optional MongoDB.

## Run locally

```sh
npm install
npm run dev
```

Open the Vite URL printed in the terminal. The Express API runs on port 4000.

## Data storage

Typing history is saved in this browser's `localStorage` by default, with no account or server required. To also persist sessions in MongoDB, set `MONGODB_URI` in your environment before starting the server. The browser remains the primary local history store.

```sh
# PowerShell example
$env:MONGODB_URI = "mongodb://127.0.0.1:27017/prototype"
npm run dev
```

## Controls

- Choose 30 or 60 seconds and Easy, Medium, or Hard.
- Click the passage and type to start the clock.
- Press Tab, then Enter to restart with a fresh passage.
- Correct characters earn a small sparkle; incorrect characters shake the passage.
