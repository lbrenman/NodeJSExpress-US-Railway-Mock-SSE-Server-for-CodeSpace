# Mock US Railway Cargo SSE Server

This project is a **Node.js/Express mock Server-Sent Events (SSE) server** that simulates US railway cargo operations:

- Trains moving between fictional US freight hubs
- Cars on each train
- Airway bills (AWBs) loaded, in transit, and delivered
- Realistic-ish movement using distances + speeds + dwell time
- A tiny HTML dashboard with:
  - Live SSE connection
  - Filters (AWB, train, car, station, status)
  - **Map view** showing trains and stations
  - Train list + raw JSON payload view

It’s designed to be easy to run locally or in **GitHub Codespaces** and to act as a “live system” for SSE / streaming demos.

---

## Features

- **SSE endpoint:** `GET /SSE/Stream`
  - Streams `railUpdate` events with the current snapshot of all trains
  - Supports optional query parameters for server-side filtering
- **Filtering:**
  - `awb` / `airwayBill` – airway bill number (exact or partial)
  - `trainName` – train name (partial, case-insensitive)
  - `carNumber` – car number (partial, case-insensitive)
  - `station` – station code or name (partial, case-insensitive)
  - `status` – `LOADED`, `IN_TRANSIT`, `DELIVERED`
- **Realistic-ish simulation:**
  - Uses station coordinates + Haversine distance
  - Trains have speeds in km/h
  - **TIME_SCALE** controls how fast simulated time advances
  - Trains **stop** at stations for a dwell time window
  - AWBs move from `LOADED` → `IN_TRANSIT` → `DELIVERED`
- **Dashboard (`/`):**
  - Shows connection status
  - Live counts (trains, cars, AWBs)
  - **SVG map view**:
    - Stations rendered by lat/lon
    - Trains plotted as moving dots
  - Train list with:
    - Name, current leg, progress bar
    - Current coordinates
  - Raw JSON of the last SSE message

  ![Imgur](https://imgur.com/qM7eno1.png)

---

## Getting Started

### 1. Install & run

```bash
npm install
cp .env.example .env   # then adjust if you like
npm start
````

By default the server listens on **`http://localhost:3000`**.

### 2. Open the dashboard

* Go to: `http://localhost:3000/`
* Or in Codespaces: `https://<your-codespace-domain>/`

You should see:

* Connection indicator (Connected/Disconnected)
* Filters at the top
* A **map** showing stations + trains
* A train list and a raw JSON panel

The dashboard auto-connects to `/SSE/Stream`.

### 3. SSE endpoint

Basic SSE stream (all trains):

```bash
curl http://localhost:3000/SSE/Stream
```

Filtered by train name:

```bash
curl "http://localhost:3000/SSE/Stream?trainName=Pacific"
```

![Imgur](https://imgur.com/VPcDSCO.png)

Filtered by AWB:

```bash
curl "http://localhost:3000/SSE/Stream?awb=AWB-1"
```

Filtered by station + status:

```bash
curl "http://localhost:3000/SSE/Stream?station=CHI&status=IN_TRANSIT"
```

---

## Environment Variables (Realism Knobs)

All configuration options are in `.env.example`. You can copy that to `.env` and tweak as needed.

| Variable             | Default | Description                                                                                                                                   |
| -------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`               | `3000`  | Port the Express app listens on.                                                                                                              |
| `TICK_MS`            | `5000`  | How often the server pushes SSE updates (milliseconds).                                                                                       |
| `TRAIN_COUNT`        | `10`    | How many trains to simulate.                                                                                                                  |
| `MAX_CARS_PER_TRAIN` | `12`    | Maximum cars per train.                                                                                                                       |
| `MAX_AWBS_PER_CAR`   | `5`     | Maximum airway bills per car.                                                                                                                 |
| `TIME_SCALE`         | `60`    | **Time acceleration factor**: how much faster than real time the simulation runs. `1` = real time; `60` = 1 real second = 1 simulated minute. |
| `MIN_DWELL_MINUTES`  | `5`     | Minimum **dwell time** (stop time) at a station, in **simulated minutes**.                                                                    |
| `MAX_DWELL_MINUTES`  | `20`    | Maximum dwell time at a station, in simulated minutes.                                                                                        |

### How TIME_SCALE and dwell work

On each tick:

* Real time step (hours) = `TICK_MS / 3,600,000`
* Simulated time step (hours) = real time step × `TIME_SCALE`

So for example:

* `TICK_MS=5000` and `TIME_SCALE=60`:

  * Every 5 real seconds ≈ 5 minutes of simulated time.
* `TICK_MS=2000` and `TIME_SCALE=1`:

  * Every 2 real seconds = 2 seconds of simulated time (near real-time).

**Dwell time** at stations is chosen randomly between `MIN_DWELL_MINUTES` and `MAX_DWELL_MINUTES` (in simulated minutes). During dwell:

* `speedKmh` is reported as `0`
* The train location stays fixed at the station
* AWB load/offload updates happen as trains arrive/depart

---

## API Overview

### `GET /api/info`

Simple health/info route:

```bash
curl http://localhost:3000/api/info
```

Example JSON:

```json
{
  "status": "ok",
  "message": "US Railway Cargo SSE mock server",
  "sseEndpoint": "/SSE/Stream",
  "example": {
    "allData": "/SSE/Stream",
    "filterByTrainName": "/SSE/Stream?trainName=Pacific",
    "filterByAwb": "/SSE/Stream?awb=AWB-11001",
    "filterByCar": "/SSE/Stream?carNumber=R1001",
    "filterByStation": "/SSE/Stream?station=CHI",
    "filterByStatus": "/SSE/Stream?status=IN_TRANSIT"
  }
}
```

### `GET /SSE/Stream`

SSE endpoint. Responds with `text/event-stream` and emits `railUpdate` events:

```text
id: 1
event: railUpdate
data: { ...JSON payload... }

id: 2
event: railUpdate
data: { ...JSON payload... }

...
```

#### Query Parameters (all optional)

* `awb` / `airwayBill` – filter by airway bill number (partial match allowed)
* `trainName` – filter by train name
* `carNumber` – filter by car number
* `station` – filter by origin/destination/offload station code/name
* `status` – `LOADED`, `IN_TRANSIT`, or `DELIVERED`

If **no query parameters** are provided, all trains / cars / AWBs are returned.

#### Example payload shape

```json
{
  "timestamp": "2025-11-18T22:10:15.123Z",
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
      "speedKmh": 65,
      "route": ["LA", "KC", "CHI", "NYC"],
      "fromStationCode": "KC",
      "toStationCode": "CHI",
      "legProgress": 0.42,
      "currentLocation": {
        "lat": 40.12345,
        "lon": -92.54321
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
              "weightKg": 12000,
              "status": "IN_TRANSIT",
              "lastUpdated": "2025-11-18T22:10:15.123Z",
              "loadedAt": "2025-11-18T20:05:00.000Z",
              "deliveredAt": null,
              "offloadedAtStationCode": null
            }
          ]
        }
      ],
      "lastUpdated": "2025-11-18T22:10:15.123Z"
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
    // ...
  ]
}
```

The **dashboard map** uses:

* `stationCatalog[].lat/lon` for station dots
* `trains[].currentLocation.lat/lon` for train dots

---

## Using with Postman (optional)

If you include a Postman collection (e.g. `Mock-US-Rail-SSE.postman_collection.json`):

1. Import it into Postman.
2. Set the `baseUrl` collection variable, e.g.:

   * `http://localhost:3000`
   * or `https://<your-codespace-domain>`
3. Use the prepared requests for:

   * `/api/info`
   * `/SSE/Stream` (all)
   * `/SSE/Stream` with filters

Note: Postman will keep the connection open and stream `railUpdate` events under the **Body** tab.

---

## Tweaking for demos

A few handy presets:

### Faster, more “arcade” demo

```env
TICK_MS=2000
TIME_SCALE=120
MIN_DWELL_MINUTES=2
MAX_DWELL_MINUTES=5
TRAIN_COUNT=8
```

### Slower, more real-time feel

```env
TICK_MS=5000
TIME_SCALE=10
MIN_DWELL_MINUTES=10
MAX_DWELL_MINUTES=30
TRAIN_COUNT=12
```

You can mix and match these knobs to match your demo story (slow “overnight” freight vs. constant flow).

---

## License

Use freely for demos, training, and experimentation.