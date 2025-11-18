// server.js
// Mock US Railway Cargo SSE Server
//
// Streams fictional train, car, and airway bill status updates
// over Server-Sent Events (SSE) with optional filters.
//
// Endpoint:  GET /SSE/Stream
// Query params:
//   - awb:        airway bill number (exact or partial match)
//   - trainName:  train name (partial, case-insensitive)
//   - carNumber:  rail car number (partial, case-insensitive)
//   - station:    station code or name (partial, case-insensitive)
//   - status:     airway bill status (LOADED, IN_TRANSIT, DELIVERED)
//
// Major env vars (see .env.example):
//   - PORT=3000
//   - TICK_MS=2000
//   - TRAIN_COUNT=4
//   - MAX_CARS_PER_TRAIN=12
//   - MAX_AWBS_PER_CAR=5

const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());

// Serve static dashboard
app.use(express.static("public"));

// ----- Configuration via env vars -----
const PORT = parseInt(process.env.PORT || "3000", 10);
const TICK_MS = parseInt(process.env.TICK_MS || "2000", 10);
const TRAIN_COUNT = parseInt(process.env.TRAIN_COUNT || "4", 10);
const MAX_CARS_PER_TRAIN = parseInt(process.env.MAX_CARS_PER_TRAIN || "12", 10);
const MAX_AWBS_PER_CAR = parseInt(process.env.MAX_AWBS_PER_CAR || "5", 10);

// ----- Basic US station network (fictional cargo hubs) -----
const STATIONS = [
  {
    code: "LA",
    name: "Los Angeles Freight Yard",
    city: "Los Angeles",
    state: "CA",
    lat: 34.033,
    lon: -118.238,
  },
  {
    code: "KC",
    name: "Kansas City Intermodal",
    city: "Kansas City",
    state: "MO",
    lat: 39.104,
    lon: -94.598,
  },
  {
    code: "CHI",
    name: "Chicago Rail Hub",
    city: "Chicago",
    state: "IL",
    lat: 41.874,
    lon: -87.640,
  },
  {
    code: "MEM",
    name: "Memphis Freight Terminal",
    city: "Memphis",
    state: "TN",
    lat: 35.149,
    lon: -90.049,
  },
  {
    code: "ATL",
    name: "Atlanta Distribution Center",
    city: "Atlanta",
    state: "GA",
    lat: 33.749,
    lon: -84.388,
  },
  {
    code: "NYC",
    name: "New York Consolidation Yard",
    city: "New York",
    state: "NY",
    lat: 40.713,
    lon: -74.006,
  },
];

// Some predefined routes (list of station codes)
const ROUTES = [
  ["LA", "KC", "CHI", "NYC"],
  ["LA", "MEM", "ATL", "NYC"],
  ["CHI", "KC", "MEM", "ATL"],
  ["NYC", "CHI", "KC", "LA"],
];

// Utility: random helpers
const randInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const randChoice = (arr) => arr[randInt(0, arr.length - 1)];

// Find station by code
function stationByCode(code) {
  return STATIONS.find((s) => s.code === code);
}

// Create random car number and airway bill numbers
function generateCarNumber(trainIndex, carIndex) {
  return `R${trainIndex + 1}${String(carIndex + 1).padStart(3, "0")}`;
}

function generateAwbNumber(trainIndex, carIndex, awbIndex) {
  // Completely fictional AWB number-like string
  return `AWB-${trainIndex + 1}${carIndex + 1}${String(awbIndex + 1).padStart(
    4,
    "0"
  )}`;
}

// Create airway bills for a car along the train's route
function createAirwayBillsForCar(route, trainIndex, carIndex) {
  const count = randInt(1, MAX_AWBS_PER_CAR);
  const now = new Date().toISOString();
  const awbs = [];

  for (let i = 0; i < count; i++) {
    // Choose an origin and destination along the route
    const originIdx = randInt(0, route.length - 2);
    const destIdx = randInt(originIdx + 1, route.length - 1);

    awbs.push({
      awbNumber: generateAwbNumber(trainIndex, carIndex, i),
      originStationCode: route[originIdx],
      destStationCode: route[destIdx],
      pieces: randInt(1, 10),
      weightKg: randInt(500, 20000),
      status: "LOADED", // LOADED -> IN_TRANSIT -> DELIVERED
      lastUpdated: now,
      loadedAt: now,
      deliveredAt: null,
      offloadedAtStationCode: null,
    });
  }

  return awbs;
}

// ----- Global train state -----
let trains = [];

function createInitialTrains() {
  trains = [];

  for (let i = 0; i < TRAIN_COUNT; i++) {
    const route = randChoice(ROUTES);
    const speedKmh = randInt(40, 80);
    const carCount = randInt(5, MAX_CARS_PER_TRAIN);

    const cars = [];
    for (let c = 0; c < carCount; c++) {
      cars.push({
        carNumber: generateCarNumber(i, c),
        type: randChoice(["BOXCAR", "TANK", "HOPPER", "INTERMODAL", "FLATCAR"]),
        airwayBills: createAirwayBillsForCar(route, i, c),
      });
    }

    trains.push({
      id: `T${i + 1}`,
      name: randChoice([
        "Pacific Runner",
        "Continental Freight",
        "Atlantic Express",
        "Heartland Cargo",
        "Mountain Hauler",
      ]) + ` ${i + 1}`,
      route, // array of station codes
      currentLegIndex: 0, // index into route, between route[i] -> route[i+1]
      legProgress: Math.random(), // 0..1 between the two stations
      speedKmh,
      cars,
    });
  }
}

// move trains along their routes and update airway bill statuses
function updateTrains() {
  const now = new Date().toISOString();

  trains.forEach((train) => {
    const { route } = train;
    if (route.length < 2) return;

    // Move along the current leg
    // Instead of using real distances, use a randomized progress per tick
    const progressIncrement = 0.1 + Math.random() * 0.25; // 0.1 to 0.35
    train.legProgress += progressIncrement;

    if (train.legProgress >= 1) {
      // We arrived at the next station
      const fromCode = route[train.currentLegIndex];
      const toCode = route[train.currentLegIndex + 1];

      const arrivalStationCode = toCode;
      const arrivalStation = stationByCode(arrivalStationCode);

      // Update AWBs whose destination is this station -> DELIVERED
      train.cars.forEach((car) => {
        car.airwayBills.forEach((awb) => {
          if (
            awb.destStationCode === arrivalStationCode &&
            awb.status !== "DELIVERED"
          ) {
            awb.status = "DELIVERED";
            awb.lastUpdated = now;
            awb.deliveredAt = now;
            awb.offloadedAtStationCode = arrivalStationCode;
          }
        });

        // Randomly load a few new AWBs at this station
        if (Math.random() < 0.35) {
          const newAwb = {
            awbNumber: generateAwbNumber(
              parseInt(train.id.slice(1)) - 1,
              0,
              randInt(100, 999)
            ),
            originStationCode: arrivalStationCode,
            destStationCode:
              route[randInt(train.currentLegIndex + 1, route.length - 1)],
            pieces: randInt(1, 10),
            weightKg: randInt(500, 20000),
            status: "LOADED",
            lastUpdated: now,
            loadedAt: now,
            deliveredAt: null,
            offloadedAtStationCode: null,
          };
          car.airwayBills.push(newAwb);
        }
      });

      // Advance to next leg
      train.currentLegIndex++;
      if (train.currentLegIndex >= route.length - 1) {
        // Reached end of route; loop back
        train.currentLegIndex = 0;
      }

      train.legProgress = 0;

      // Occasionally change speed a bit
      if (Math.random() < 0.3) {
        train.speedKmh = Math.max(
          30,
          Math.min(90, train.speedKmh + randInt(-10, 10))
        );
      }
    } else {
      // While in transit, mark LOADED -> IN_TRANSIT for AWBs whose origin is current "from" station
      const fromCode = route[train.currentLegIndex];
      train.cars.forEach((car) => {
        car.airwayBills.forEach((awb) => {
          if (
            awb.originStationCode === fromCode &&
            awb.status === "LOADED" &&
            train.legProgress > 0.1
          ) {
            awb.status = "IN_TRANSIT";
            awb.lastUpdated = now;
          }
        });
      });
    }
  });
}

// Compute a snapshot with interpolated GPS coordinates
function getTrainSnapshots() {
  const now = new Date().toISOString();

  return trains.map((train) => {
    const fromCode = train.route[train.currentLegIndex];
    const toCode = train.route[train.currentLegIndex + 1] || fromCode;
    const fromStation = stationByCode(fromCode);
    const toStation = stationByCode(toCode);

    // Linear interpolation between station coordinates
    const t = Math.min(Math.max(train.legProgress, 0), 1);
    const lat =
      fromStation.lat + (toStation.lat - fromStation.lat) * t;
    const lon =
      fromStation.lon + (toStation.lon - fromStation.lon) * t;

    return {
      id: train.id,
      name: train.name,
      speedKmh: train.speedKmh,
      route: train.route,
      fromStationCode: fromCode,
      toStationCode: toCode,
      legProgress: parseFloat(t.toFixed(3)),
      currentLocation: {
        lat: parseFloat(lat.toFixed(5)),
        lon: parseFloat(lon.toFixed(5)),
      },
      cars: train.cars,
      lastUpdated: now,
    };
  });
}

// Filtering helpers for query params
function applyFilters(snapshots, query) {
  const {
    awb,
    airwayBill,
    trainName,
    carNumber,
    station,
    status,
  } = query;

  const awbFilter = awb || airwayBill;

  const matchesString = (value, filter) =>
    typeof value === "string" &&
    typeof filter === "string" &&
    value.toLowerCase().includes(filter.toLowerCase());

  return snapshots
    .map((train) => {
      // Filter trains by trainName first (coarse)
      if (trainName && !matchesString(train.name, trainName)) {
        return null;
      }

      let filteredCars = train.cars;

      if (carNumber) {
        filteredCars = filteredCars.filter((car) =>
          matchesString(car.carNumber, carNumber)
        );
      }

      // Airway bill & station & status filtering
      if (awbFilter || station || status) {
        filteredCars = filteredCars
          .map((car) => {
            const filteredAwbs = car.airwayBills.filter((awbObj) => {
              if (
                awbFilter &&
                !matchesString(awbObj.awbNumber, awbFilter)
              ) {
                return false;
              }
              if (station) {
                const stationMatch =
                  matchesString(
                    awbObj.originStationCode,
                    station
                  ) ||
                  matchesString(
                    awbObj.destStationCode,
                    station
                  ) ||
                  matchesString(
                    awbObj.offloadedAtStationCode || "",
                    station
                  );
                if (!stationMatch) return false;
              }
              if (status && awbObj.status !== status.toUpperCase()) {
                return false;
              }
              return true;
            });

            if (filteredAwbs.length === 0) return null;
            return {
              ...car,
              airwayBills: filteredAwbs,
            };
          })
          .filter(Boolean);
      }

      if (filteredCars.length === 0) {
        // No cars left after filtering -> drop train
        return null;
      }

      return {
        ...train,
        cars: filteredCars,
      };
    })
    .filter(Boolean);
}

// ----- SSE endpoint -----
app.get("/SSE/Stream", (req, res) => {
  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Allow CORS for browser-based demos (Codespace URLs, etc.)
  res.setHeader("Access-Control-Allow-Origin", "*");

  // Send an initial comment to establish the stream
  res.write(": connected\n\n");

  let eventId = 1;

  const sendUpdate = () => {
    updateTrains();

    const snapshots = getTrainSnapshots();
    const filteredSnapshots = applyFilters(snapshots, req.query);

    const payload = {
      timestamp: new Date().toISOString(),
      filtersApplied: {
        awb: req.query.awb || req.query.airwayBill || null,
        trainName: req.query.trainName || null,
        carNumber: req.query.carNumber || null,
        station: req.query.station || null,
        status: req.query.status || null,
      },
      trains: filteredSnapshots,
      stationCatalog: STATIONS,
    };

    res.write(`id: ${eventId++}\n`);
    res.write("event: railUpdate\n");
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  // Send first update immediately so client sees something at once
  sendUpdate();

  const interval = setInterval(sendUpdate, TICK_MS);

  // Clean up when client disconnects
  req.on("close", () => {
    clearInterval(interval);
  });
});

// Simple health/info route
app.get("/api/info", (req, res) => {
  res.json({
    status: "ok",
    message: "US Railway Cargo SSE mock server",
    sseEndpoint: "/SSE/Stream",
    example: {
      allData: "/SSE/Stream",
      filterByTrainName: "/SSE/Stream?trainName=Pacific",
      filterByAwb: "/SSE/Stream?awb=AWB-11001",
      filterByCar: "/SSE/Stream?carNumber=R1001",
      filterByStation: "/SSE/Stream?station=CHI",
      filterByStatus: "/SSE/Stream?status=IN_TRANSIT",
    },
  });
});

// Initialize and start
createInitialTrains();

app.listen(PORT, () => {
  console.log(
    `[Rail SSE] Server listening on port ${PORT}. SSE endpoint: /SSE/Stream`
  );
  console.log(
    `[Rail SSE] Env: TICK_MS=%d, TRAINS=%d, MAX_CARS_PER_TRAIN=%d, MAX_AWBS_PER_CAR=%d`,
    TICK_MS,
    TRAIN_COUNT,
    MAX_CARS_PER_TRAIN,
    MAX_AWBS_PER_CAR
  );
});
