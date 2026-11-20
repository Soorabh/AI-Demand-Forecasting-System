# AI Demand Forecasting System

A B2B sales forecasting app. Upload historical sales (CSV/Excel), describe the business context, and get a **Prophet** forecast with country/state holidays, optionally nudged by an **AI macro adjustment** from Perplexity Sonar (bounded to ±20%).

## 🚀 Features

- **File upload**: CSV and Excel up to 10MB, parsed in the browser for preview and smart column detection
- **Prophet forecasting**: daily, weekly or monthly; 1–365 periods; automatic additive/multiplicative seasonality
- **Holidays**: national holidays for 10 countries, state/province holidays for the US, India and Canada
- **AI macro adjustment**: Perplexity Sonar proposes one bounded % adjustment with a rationale and sources
- **Analysis charts** (echarts): sales per year, per month, and month-by-month overlay across years
- **Accounts**: email/password and Google sign-in; forecasting requires a logged-in user

### Privacy
Raw sales values never leave the server. Perplexity only receives industry, location, frequency, horizon, upcoming holiday names and three summary numbers (recent growth %, year-over-year %, volatility index).

## 🏗️ Architecture

```
Browser (Vue 3 + Vite + Tailwind)
   │  all calls go to /api
   ▼
Node/Express backend  (metainflu/backend, port 5000)
   │  /api/auth/*        → login, register, Google sign-in (MongoDB + JWT)
   │  /api/forecast      → checks JWT, forwards file + params to Python
   │  /api/geo/*         → forwards country/state lookups to Python
   ▼
Python/FastAPI service (backend, port 8000)
      /api/forecast, /api/countries, /api/subdivisions/{code}, /api/ai-adjust
      Prophet + holidays + Perplexity Sonar
```

The browser only ever talks to the Node backend, so the login check on `/api/forecast` can't be bypassed. The Python service is meant to be private (it's a Render private service and is not exposed by the nginx `/api` route).

### Repository layout
```
backend/                      Python forecasting service (FastAPI)
├── main.py                   App, CORS, routers
├── routers/                  forecast.py, ai_adjust.py, geo_data.py
├── services/                 prophet_service.py, holidays_service.py, perplexity_client.py
├── models/schemas.py         Pydantic models
└── tests/                    pytest suite
metainflu/backend/            Node/Express API (auth + proxy)
├── server.js
├── routes/                   authRoutes.js, forecastRoutes.js, geoRoutes.js
├── controllers/, middleware/, models/, config/
metainflu/frontend/client/    Vue 3 frontend
├── src/lib/api.js            Single API base URL (defaults to /api)
├── src/services/             authService.js, forecastService.js
├── src/components/forecast/  Upload, config form, results, charts, financial projection
└── src/pages/                Landing, Login, Register, ForecastDashboard, ...
proxy/nginx.conf              Reverse proxy for docker-compose
docker-compose.yml            Runs all services locally
render.yaml                   Render deployment
```

## 🛠️ Local development

Prerequisites: Node.js 18+, Python 3.11, a MongoDB connection string, and (optionally) a Perplexity API key.

### 1. Python forecasting service
```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
echo "PERPLEXITY_API_KEY=your_key" > .env   # optional; without it the AI adjustment is 0%
uvicorn main:app --reload --port 8000
```

### 2. Node backend
```bash
cd metainflu/backend
npm install
```
Create `metainflu/backend/.env`:
```
MONGO_URI=mongodb+srv://...
JWT_SECRET=some-long-random-string
GOOGLE_CLIENT_ID=...            # only needed for Google sign-in
AI_BACKEND_URL=http://localhost:8000
```
Then `npm start` (runs on port 5000).

### 3. Frontend
```bash
cd metainflu/frontend/client
npm install
npm run dev
```
Open http://localhost:5173. Vite proxies `/api` to the Node backend on port 5000 (see `vite.config.js`). Set `VITE_API_BASE_URL` only if the API is on a different origin.

### Docker
```bash
docker compose up --build
```
Open http://localhost. nginx serves the frontend and sends `/api/*` to the Node backend. Set `MONGO_URI`, `JWT_SECRET`, `GOOGLE_CLIENT_ID` and `PERPLEXITY_API_KEY` in your shell or a root `.env` first.

## 🔧 API

All endpoints below are called through the Node backend at `/api`.

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | – | Create account |
| POST | `/api/auth/login` | – | Email/password login, returns JWT |
| POST | `/api/auth/google` | – | Google sign-in |
| GET | `/api/geo/countries` | – | Country list (ISO 3166-1) |
| GET | `/api/geo/subdivisions/{country}` | – | States/provinces (ISO 3166-2) |
| POST | `/api/forecast` | Bearer JWT | Generate forecast |

### `POST /api/forecast`
Multipart form: `file` plus these fields:

| Field | Example | Notes |
|---|---|---|
| `industry` | `retail` | |
| `country` | `US` | ISO code or name |
| `state` | `US-CA` | optional; ISO 3166-2 code or name |
| `city` | `San Francisco` | optional |
| `freq` | `W` | `D`, `W` or `M` |
| `horizon` | `8` | 1–365 periods |
| `date_col`, `target_col` | `date`, `sales` | column names in the file |
| `apply_holidays`, `apply_ai_adjustment` | `true` | |

Response:
```json
{
  "meta": { "freq": "W", "train_start": "2023-01-02", "train_end": "2024-12-30", "horizon": 8,
            "holidays_used": ["New Year's Day"], "original_rows": 104, "processed_rows": 104,
            "null_dates": 0, "null_targets": 0 },
  "history":        [{ "ds": "2024-01-01", "y": 1234.5 }],
  "forecast_base":  [{ "ds": "2025-01-06", "yhat": 1400.2, "yhat_lower": 1300.1, "yhat_upper": 1500.3 }],
  "forecast_final": [{ "ds": "2025-01-06", "yhat_final": 1295.2 }],
  "ai_adjustment":  { "applied": true, "adjustment_pct": -7.5, "rationale": "...", "sources": [] }
}
```

## 📋 Data requirements

- **Formats**: `.csv` (UTF-8, Latin-1 or CP1252), `.xlsx`, `.xls` (first sheet). Max 10MB.
- **Minimum**: 12 valid rows. Rows with unparseable dates or non-numeric sales are dropped and counted in `meta`.
- Rows are summed to the chosen frequency (weeks start Monday, months on the 1st).

## 🧪 Tests

```bash
cd backend
pip install -r requirements-dev.txt
pytest
```

## 🆘 Troubleshooting

- **"Insufficient data"**: the file needs at least 12 valid rows after cleaning.
- **401 on forecast**: log in again; the JWT is stored in `localStorage` under `user`.
- **Country list empty**: the Node backend can't reach the Python service; check `AI_BACKEND_URL`.
- **AI adjustment shows 0%**: `PERPLEXITY_API_KEY` is missing or the API call failed; the rationale says which.
- **Google sign-in fails with "origin is not allowed"**: add your frontend URL to Authorized JavaScript origins in Google Cloud Console.
