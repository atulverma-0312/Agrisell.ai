# AgriSell AI

Farmer-specific market optimization web app: tells a farmer **where** to sell, **to whom**, and **when**, with an estimated net return, explanation and confidence.

## Pipeline (each stage is a screen in the app)

1. **Farmer Input** – crop, quantity, grade, location
2. **Farmer Constraints** – selling deadline, storage capacity, budget, transport limit
3. **Data Integration** – e-NAM/AGMARKNET, mandis, buyer demand, historical prices, logistics, storage (simulated Uttar Pradesh-only feeds in `src/lib/data.ts`)
4. **Data Processing** – de-duplication, interpolation of missing values, outlier normalization, validation
5. **Optimization Engine (AI)** – price model (trend regression + Holt smoothing ensemble), demand analysis, logistics cost engine, market/buyer matching
6. **Economic Calculation** – revenue − transport − storage − other costs = net return
7. **Option Ranking (AI)** – multi-criteria utility score with confidence
8. **Personalized Output (AI)** – best market/buyer/time/price, auto-generated reason, risk indicator; optional LLM rewrite in Indian languages
9. **Buyer Connection / Transaction** – connect, negotiate, secure, logistics, payment

All engine logic lives in `src/lib/engine.ts`; the optional generative-AI layer is in `src/lib/ai.ts`.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run lint
```

Optional: set `VITE_OPENAI_API_KEY` in `.env` to pre-fill the generative explanation feature (the key can also be entered in the UI; it never leaves the browser).


## Uttar Pradesh scope

All demo data is restricted to Uttar Pradesh: the farmer location dropdown lists all 75 UP districts (`src/lib/up.ts`), and the market/buyer feed (`src/lib/data.ts`) contains only UP mandis, e-NAM centres, FPOs and buyers. Distances are computed per district from approximate coordinates.

## Market Dashboard (final stage)

6-month weekly price history (UP average, range and top markets), profit & loss per market against cost of cultivation, price-growth outlook with 30/60/90-day forecasts and actionable levers, and an interactive Uttar Pradesh district choropleth (`src/lib/up-districts.json`, simplified from the udit-001/india-maps-data Census-2011 boundaries). Clicking a district shows its best market, expected price, net return and profit directly, and can re-run the pipeline with that district as the farmer location.
