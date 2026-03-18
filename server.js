const express = require("express");
const crypto = require("crypto");
const Redis = require("ioredis");

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10kb" }));
app.use(express.static("public"));

// -------------------------
// Redis setup
// -------------------------
let redis;
let redisAvailable = true;

try {
  redis = new Redis(process.env.REDIS_URL || undefined);

  redis.on("connect", () => {
    console.log("✅ Redis connected");
  });

  redis.on("error", (err) => {
    console.error("❌ Redis error:", err.message);
    redisAvailable = false;
  });

} catch (err) {
  console.error("❌ Redis init failed:", err.message);
  redisAvailable = false;
}

// -------------------------
// Fallback store (Map)
// -------------------------
const store = new Map();

// -------------------------
// Code generator
// -------------------------
async function generateCode() {
  let code;

  do {
    code = crypto.randomInt(10000, 100000).toString();

    if (redisAvailable) {
      const exists = await redis.exists(code);
      if (!exists) break;
    } else {
      if (!store.has(code)) break;
    }

  } while (true);

  return code;
}

// -------------------------
// SEND
// -------------------------
app.post("/send", async (req, res) => {
  const { text } = req.body;

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return res.status(400).json({ error: "Empty content" });
  }

  if (text.length > 5000) {
    return res.status(400).json({ error: "Too large (max 5000 chars)" });
  }

  const code = await generateCode();
  const cleanText = text.trim();

  try {
    if (redisAvailable) {
      // store in Redis with TTL
      await redis.set(code, cleanText, "EX", 90);
    } else {
      // fallback to Map
      store.set(code, {
        text: cleanText,
        expires: Date.now() + 90 * 1000,
      });
    }

    res.json({ code });

  } catch (err) {
    console.error("Storage error:", err);

    // fallback if Redis fails suddenly
    store.set(code, {
      text: cleanText,
      expires: Date.now() + 90 * 1000,
    });

    res.json({ code });
  }
});

// -------------------------
// RECEIVE
// -------------------------
app.get("/get/:code", async (req, res) => {
  const { code } = req.params;

  if (!/^\d{5}$/.test(code)) {
    return res.status(400).json({ error: "Invalid code format" });
  }

  try {
    if (redisAvailable) {
      const text = await redis.get(code);

      if (!text) {
        return res.status(404).json({ error: "Not found or expired" });
      }

      await redis.del(code); // one-time use

      return res.json({ text });
    }

  } catch (err) {
    console.error("Redis read error:", err);
  }

  // fallback to Map
  const data = store.get(code);

  if (!data) return res.status(404).json({ error: "Not found" });

  if (Date.now() > data.expires) {
    store.delete(code);
    return res.status(410).json({ error: "Expired" });
  }

  store.delete(code);
  res.json({ text: data.text });
});

// -------------------------
// Cleanup for fallback Map
// -------------------------
setInterval(() => {
  if (!redisAvailable) {
    const now = Date.now();
    for (const [code, data] of store) {
      if (now > data.expires) store.delete(code);
    }
  }
}, 10000);

// -------------------------
// Start server
// -------------------------
app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🚀 PassIt running at:`);
  console.log(`   Local → http://localhost:${PORT}`);
  console.log(`   LAN   → http://<your-ip>:${PORT}`);
  console.log(`   Mode  → ${redisAvailable ? "Redis" : "Memory fallback"}\n`);
});
