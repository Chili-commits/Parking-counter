const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const PORT = Number(process.env.PORT) || 3000;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, "data.json");
const PUBLIC_DIR = path.join(__dirname, "public");
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};
const clients = new Set();

function loadState() {
  try {
    const saved = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    if (!Array.isArray(saved.visits) || !saved.visits.every((visit) => Number.isFinite(Date.parse(visit)))) {
      throw new Error("The saved visitor data has an invalid format.");
    }
    return { visits: saved.visits, lastUpdated: saved.lastUpdated || null };
  } catch (error) {
    if (error.code === "ENOENT") {
      return { visits: [], lastUpdated: null };
    }
    throw error;
  }
}

let state = loadState();

function saveState() {
  const temporaryFile = `${DATA_FILE}.tmp`;
  fs.writeFileSync(temporaryFile, JSON.stringify(state, null, 2));
  fs.renameSync(temporaryFile, DATA_FILE);
}

function publicState() {
  return { visits: state.visits, lastUpdated: state.lastUpdated };
}

function broadcast() {
  const payload = `data: ${JSON.stringify(publicState())}\n\n`;
  for (const client of clients) {
    client.write(payload);
  }
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(value));
}

function handleRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (request.method === "GET" && url.pathname === "/api/state") {
    return sendJson(response, 200, publicState());
  }

  if (request.method === "GET" && url.pathname === "/api/events") {
    response.writeHead(200, {
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
    });
    response.write(`data: ${JSON.stringify(publicState())}\n\n`);
    clients.add(response);
    response.on("close", () => clients.delete(response));
    return;
  }

  if (request.method === "POST" && (url.pathname === "/api/visitors" || url.pathname === "/api/undo")) {
    const previousVisits = state.visits;
    const previousLastUpdated = state.lastUpdated;
    if (url.pathname === "/api/visitors") {
      state.visits = [...state.visits, new Date().toISOString()];
    } else if (state.visits.length > 0) {
      state.visits = state.visits.slice(0, -1);
    }
    state.lastUpdated = new Date().toISOString();
    try {
      saveState();
    } catch (error) {
      state.visits = previousVisits;
      state.lastUpdated = previousLastUpdated;
      console.error("Could not save visitor data:", error);
      return sendJson(response, 500, { error: "Could not save visitor data." });
    }
    broadcast();
    return sendJson(response, 200, publicState());
  }

  if (request.method !== "GET") {
    response.writeHead(405, { Allow: "GET, POST" });
    return response.end("Method not allowed");
  }

  const relativePath = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
  const filePath = path.resolve(PUBLIC_DIR, relativePath);
  if (!filePath.startsWith(`${PUBLIC_DIR}${path.sep}`)) {
    response.writeHead(403);
    return response.end("Forbidden");
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500);
      return response.end(error.code === "ENOENT" ? "Not found" : "Could not read file");
    }
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(content);
  });
}

const server = http.createServer((request, response) => {
  try {
    handleRequest(request, response);
  } catch (error) {
    console.error("Request failed:", error);
    if (!response.headersSent) {
      sendJson(response, 500, { error: "The request could not be completed." });
    } else {
      response.end();
    }
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Christmas farm visitor counter is running at http://localhost:${PORT}`);
  if (process.env.DOCKER_CONTAINER !== "true") {
    const interfaces = os.networkInterfaces();
    for (const addresses of Object.values(interfaces)) {
      for (const address of addresses || []) {
        if (address.family === "IPv4" && !address.internal) {
          console.log(`On this network: http://${address.address}:${PORT}`);
        }
      }
    }
  }
});
