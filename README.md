# Mock US Railway Cargo SSE Server

This repo contains a tiny Node.js / Express **Server-Sent Events (SSE)** server that simulates US railway cargo activity:

- Trains moving between major freight hubs
- Cars with multiple airway bills (AWBs)
- AWBs loading, going **IN_TRANSIT**, and being **DELIVERED**
- Optional filters by AWB, train name, car number, station, and status
- A tiny HTML dashboard to visualize the live data stream

It is designed to run easily in **GitHub Codespaces** and to be used as a mock backend for integration / iPaaS / Amplify Fusion demos.

---

## Features

- **SSE endpoint** at `GET /SSE/Stream`
- Streams a JSON payload every `TICK_MS` milliseconds
- **Realistic-ish data model**:
  - Trains with routes across fictionalized US freight hubs
  - Interpolated GPS coordinates between stations
  - Cars with multiple AWBs
  - AWBs loaded at origin, travel in transit, and are delivered at destination
- **Filterable stream** using query parameters:
  - `awb` or `airwayBill` – Airway bill number (exact/partial)
  - `trainName` – Train name (partial, case-insensitive)
  - `carNumber` – Car number (partial, case-insensitive)
  - `station` – Station code or name (origin/destination/offload)
  - `status` – `LOADED`, `IN_TRANSIT`, or `DELIVERED`
- **Configurable via environment variables**
- **Tiny browser dashboard** at `/` using `EventSource`

---

## Quick Start (Local or Codespaces)

```bash
npm install
npm start
```

By default the server listens on **port 3000**.

In GitHub Codespaces, make sure port 3000 is forwarded/public and then:

- Open the **HTML dashboard** at:  
  `https://<your-codespace-domain>/`
- Or curl the SSE stream directly:  
  `curl -N "https://<your-codespace-domain>/SSE/Stream"`

Locally you can use:

```bash
curl -N "http://localhost:3000/SSE/Stream"
```

---

## SSE Endpoint

**Path:** `GET /SSE/Stream`  
**Event type:** `railUpdate`

Each event looks roughly like:

```json
{
  "timestamp": "2025-01-01T12:34:56.789Z",
  "filtersApplied": {
    "awb": null,
    "trainName": null,
    "carNumber": null,
    "station": null,
    "status": null
  },
  "trains": [
    {
      "id": "T1",
      "name": "Pacific Runner 1",
      "speedKmh": 63,
      "route": ["LA", "KC", "CHI", "NYC"],
      "fromStationCode": "KC",
      "toStationCode": "CHI",
      "legProgress": 0.53,
      "currentLocation": {
        "lat": 40.21,
        "lon": -90.12
      },
      "cars": [
        {
          "carNumber": "R1001",
          "type": "BOXCAR",
          "airwayBills": [
            {
              "awbNumber": "AWB-11001",
              "originStationCode": "LA",
              "destStationCode": "CHI",
              "pieces": 4,
              "weightKg": 8200,
              "status": "IN_TRANSIT",
              "lastUpdated": "2025-01-01T12:34:56.789Z",
              "loadedAt": "2025-01-01T12:30:00.000Z",
              "deliveredAt": null,
              "offloadedAtStationCode": null
            }
          ]
        }
      ],
      "lastUpdated": "2025-01-01T12:34:56.789Z"
    }
  ],
  "stationCatalog": [
    {
      "code": "LA",
      "name": "Los Angeles Freight Yard",
      "city": "Los Angeles",
      "state": "CA",
      "lat": 34.033,
      "lon": -118.238
    }
  ]
}
```

---

## Query Parameters (Filters)

You can filter the stream on the server side by adding query parameters:

- **By train name**

  ```bash
  curl -N "http://localhost:3000/SSE/Stream?trainName=Pacific"
  ```

- **By airway bill**

  ```bash
  curl -N "http://localhost:3000/SSE/Stream?awb=AWB-11001"
  ```

- **By car number**

  ```bash
  curl -N "http://localhost:3000/SSE/Stream?carNumber=R1001"
  ```

- **By station**

  (Matches origin/destination/offload station codes.)

  ```bash
  curl -N "http://localhost:3000/SSE/Stream?station=CHI"
  ```

- **By status**

  ```bash
  curl -N "http://localhost:3000/SSE/Stream?status=IN_TRANSIT"
  ```

You can combine filters, e.g.:

```bash
curl -N "http://localhost:3000/SSE/Stream?awb=AWB-1&status=DELIVERED"
```

---

## Environment Variables

See `.env.example` for defaults:

```bash
PORT=3000           # Express port
TICK_MS=2000        # How often to emit an SSE update (ms)
TRAIN_COUNT=4       # Number of trains
MAX_CARS_PER_TRAIN=12
MAX_AWBS_PER_CAR=5
```

Create a `.env` file (based on `.env.example`) if you want to override defaults:

```bash
cp .env.example .env
# edit .env
```

---

## Tiny HTML Dashboard

The `public/index.html` file is a minimal dashboard that:

- Connects to `/SSE/Stream` via `EventSource`
- Lets you type filters (`awb`, `trainName`, `carNumber`, `station`, `status`)
- Shows:
  - A list of trains with route and current station-to-station leg
  - A summary of cars and AWB counts
  - Raw JSON payload for debugging

In a browser (local or Codespaces):

- Navigate to `http://localhost:3000/` **or**  
  `https://<your-codespace-domain>/`

Adjust filters and hit **Connect** to restart the SSE connection with new query params.

---

## Using with Postman / iPaaS / Fusion

- Use `GET /SSE/Stream` as a streaming endpoint (SSE).
- Many HTTP tools (Postman, Bruno, curl, custom Node clients) can hit it directly.
- For non-SSE clients, treat it as a long-lived HTTP response with `text/event-stream` and parse `data:` lines as NDJSON.

---

## License

MIT – use, fork, and adapt freely for internal demos and experiments.
