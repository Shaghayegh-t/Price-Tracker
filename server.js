// Simple static server + SSE + product management
// Run: npm install express
// Start: node server.js
// Open: http://localhost:3000

import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const app = express();
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const PRODUCTS_FILE = path.join(process.cwd(), "products.json");

// Serve static files (like  dashboard HTML)
app.use(express.static(path.join(__dirname, "public")));

// --- SSE connections ---
const clients = new Set();

app.get("/events", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();

  // Send a ping every 20 seconds to keep alive
  const keepAlive = setInterval(() => {
    res.write(`event: ping\n`);
    res.write(`data: ${JSON.stringify({ t: Date.now() })}\n\n`);
  }, 20000);

  clients.add(res);

  req.on("close", () => {
    clearInterval(keepAlive);
    clients.delete(res);
  });
});

// --- Broadcast to all clients ---
function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try {
      client.write(payload);
    } catch (err) {
      console.warn("⚠️ SSE write failed:", err.message);
    }
  }
}

// --- Add new product endpoint ---
app.post("/add-product", (req, res) => {
  const { url } = req.body;
  if (!url || !url.startsWith("https://www.digikala.com/product/")) {
    return res.status(400).json({ error: "Invalid or missing product URL" });
  }

  let products = [];
  if (fs.existsSync(PRODUCTS_FILE)) {
    products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf8"));
  }

  if (!products.includes(url)) {
    products.push(url);
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), "utf8");

    console.log(`🆕 New product added: ${url}`);
    broadcast("product-added", { url });
  }

  res.json({ success: true });
});

// --- Price notification endpoint ---
app.post("/notify", (req, res) => {
  const payload = req.body || {};
  const data = {
    title: payload.title || "Price Update",
    message: payload.message || `${payload.title || "Product"} price changed`,
    productId: payload.productId || null,
    oldPrice: payload.oldPrice ?? null,
    newPrice: payload.newPrice ?? null,
    ts: new Date().toISOString(),
  };

  broadcast("price", data);
  res.json({ ok: true, pushed: clients.size });
});


let TEST_MODE = false; // Save current state

app.post("/set-test-mode", (req, res) => {
  TEST_MODE = !!req.body.enabled;
  console.log(`🧪 Test Mode is now ${TEST_MODE ? "ENABLED" : "DISABLED"}`);
  res.json({ ok: true, testMode: TEST_MODE });
});

app.get("/get-test-mode", (req, res) => {
  res.json({ testMode: TEST_MODE });
});


app.listen(PORT, () => {
  console.log(`🚀 Server started: http://localhost:${PORT}`);
  console.log(`📡 SSE endpoint: http://localhost:${PORT}/events`);
  console.log(`📦 Add product: POST http://localhost:${PORT}/add-product`);
  console.log(`💬 Send notification: POST http://localhost:${PORT}/notify`);
});
