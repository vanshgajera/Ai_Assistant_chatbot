import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

if (!process.env.GEMINI_API_KEY) {
  console.warn("⚠️  GEMINI_API_KEY missing. server/.env file mein key dalo.");
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/* ------------------------------------------------------------------ *
 *  Model manager: primary model -> manual fallbacks -> auto-discovered
 *  Flash models. 429 par model ko cooldown mein daal deta hai, 503 par
 *  ek baar retry karta hai, phir agle model par chala jaata hai.
 * ------------------------------------------------------------------ */
const PRIMARY = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const MANUAL = (process.env.GEMINI_FALLBACK_MODELS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

let discovered = [];
const cooldown = new Map(); // model -> timestamp (ms) tak skip karo

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function discoverModels() {
  try {
    const names = [];
    const pager = await ai.models.list();
    for await (const m of pager) {
      const name = m.name?.replace("models/", "");
      if (!name || !/flash/i.test(name)) continue;
      if (!m.supportedActions?.includes("generateContent")) continue;
      if (/image|tts|live|audio|embed|robotics|computer|native/i.test(name)) continue;
      names.push(name);
    }
    // normal flash pehle, lite baad mein; naye version pehle
    discovered = names.sort(
      (a, b) => Number(/lite/i.test(a)) - Number(/lite/i.test(b)) || b.localeCompare(a)
    );
    console.log("Available flash models:", discovered.join(", ") || "(none)");
  } catch (e) {
    console.log("Model list nahi mili:", e.message);
  }
}
discoverModels();
setInterval(discoverModels, 30 * 60 * 1000).unref();

function modelChain() {
  const all = [...new Set([PRIMARY, ...MANUAL, ...discovered])];
  const now = Date.now();
  const ready = all.filter((m) => (cooldown.get(m) || 0) <= now);
  return ready.length ? ready : all;
}

async function callGemini(build, validate) {
  let lastErr;
  for (const model of modelChain()) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        console.log("Trying model:", model);
        const result = await build(model);
        return validate ? validate(result) : result;
      } catch (err) {
        lastErr = err;
        const msg = String(err.message || "");

        if (/API key not valid|API_KEY_INVALID/i.test(msg)) throw err; // key hi galat hai

        if (err.status === 429) {
          const m = msg.match(/retryDelay[^0-9]*(\d+)s/);
          const secs = m ? Math.min(Number(m[1]), 86400) : 60;
          cooldown.set(model, Date.now() + secs * 1000);
          console.log(`Model ${model}: quota khatam, ${secs}s ke liye skip. Agla model try...`);
          break;
        }
        if ((err.status === 503 || err.status === 500) && attempt === 0) {
          console.log(`Model ${model}: busy (${err.status}), 1.5s baad ek aur try...`);
          await sleep(1500);
          continue;
        }
        console.log(`Model ${model} fail (${err.status || err.code || "error"}), agla model try...`);
        break;
      }
    }
  }
  throw lastErr || new Error("Koi model available nahi hai");
}

function friendlyError(err) {
  const msg = String(err?.message || "");
  if (/API key not valid|API_KEY_INVALID/i.test(msg)) {
    return { code: 401, text: "API key galat hai. server/.env mein check karo." };
  }
  if (err?.status === 429 || err?.status === 503) {
    return { code: 503, text: "AI abhi busy hai ya quota khatam hai. Thodi der baad try karo." };
  }
  return { code: 500, text: "Kuch gadbad ho gayi. Dobara try karo." };
}

/* ------------------------------------------------------------------ *
 *  Cache (same trip dobara maange to Gemini ko call nahi jaata)
 * ------------------------------------------------------------------ */
const planCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000;
const CACHE_MAX = 200;

function cacheGet(key) {
  const hit = planCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.t > CACHE_TTL) {
    planCache.delete(key);
    return null;
  }
  return hit.data;
}
function cacheSet(key, data) {
  if (planCache.size >= CACHE_MAX) planCache.delete(planCache.keys().next().value);
  planCache.set(key, { t: Date.now(), data });
}

/* ------------------------------------------------------------------ */
app.get("/", (_req, res) => res.send("AI Travel API chal raha hai ✈️"));

// Health check endpoint (exempt from rate limit for load testing / monitoring)
app.get("/api/health", (_req, res) => {
  res.json({
    primary: PRIMARY,
    chain: modelChain(),
    cooldown: Object.fromEntries(
      [...cooldown].filter(([, t]) => t > Date.now()).map(([m, t]) => [m, Math.ceil((t - Date.now()) / 1000) + "s"])
    ),
    cachedPlans: planCache.size,
  });
});

/* ------------------------------------------------------------------ *
 *  Simple rate limit (har IP se 20 request / minute)
 *  AI endpoints (/api/plan, /api/chat) ke liye
 * ------------------------------------------------------------------ */
const hits = new Map();
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    if (process.env.SKIP_RATE_LIMIT === "true" || req.path === "/health") return next();
    const now = Date.now();
    const arr = (hits.get(req.ip) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) {
      return res.status(429).json({ error: "Bahut zyada requests, 1 minute baad try karo." });
    }
    arr.push(now);
    hits.set(req.ip, arr);
    next();
  };
}
app.use("/api", rateLimit(20, 60 * 1000));

// ---------- Trip planner (structured JSON) ----------
function parsePlan(response) {
  const text = (response.text || "").trim().replace(/^```(?:json)?\s*|```$/g, "").trim();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    const e = new Error("Model ne valid JSON nahi diya");
    e.code = "BAD_OUTPUT";
    throw e;
  }
  if (!Array.isArray(data.days) || data.days.length === 0) {
    const e = new Error("Plan ka format galat tha");
    e.code = "BAD_OUTPUT";
    throw e;
  }
  return data;
}

app.post("/api/plan", async (req, res) => {
  try {
    const { destination, days = 3, budget = 15000, mood = "adventure", travelers = 2 } = req.body;
    if (!destination) return res.status(400).json({ error: "Destination batao" });

    const key = JSON.stringify([String(destination).trim().toLowerCase(), +days, +budget, mood, +travelers]);
    const cached = cacheGet(key);
    if (cached) return res.json(cached);

    const prompt = `You are a senior travel planner for Indian travellers.
Create a ${days}-day trip plan for "${destination}" for ${travelers} traveller(s).
Total budget: INR ${budget}. Trip mood: ${mood}.
Costs must be realistic INR numbers and the sum of day costs should stay within the budget.
Return ONLY valid JSON in this exact shape:
{
  "title": "catchy trip title",
  "summary": "2 line summary",
  "bestTime": "best months to visit",
  "totalCost": 0,
  "breakdown": { "stay": 0, "food": 0, "transport": 0, "activities": 0 },
  "days": [
    {
      "day": 1,
      "title": "day theme",
      "cost": 0,
      "activities": [
        { "time": "Morning", "name": "", "description": "", "emoji": "" }
      ]
    }
  ],
  "packing": ["item"],
  "tips": ["local tip"]
}`;

    const plan = await callGemini(
      (model) =>
        ai.models.generateContent({
          model,
          contents: prompt,
          config: { responseMimeType: "application/json", temperature: 0.8 },
        }),
      parsePlan
    );

    cacheSet(key, plan);
    res.json(plan);
  } catch (err) {
    console.error(err.message);
    const f = friendlyError(err);
    res.status(f.code).json({ error: f.text });
  }
});

// ---------- Streaming chat (Server-Sent Events) ----------
app.post("/api/chat", async (req, res) => {
  try {
    const { messages = [], tripContext = "" } = req.body;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const contents = messages.map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.text }],
    }));

    const stream = await callGemini((model) =>
      ai.models.generateContentStream({
        model,
        contents,
        config: {
          systemInstruction: `You are "Wanderly", a friendly AI travel assistant for Indian travellers.
Reply in the same language the user writes (Hinglish is fine). Keep answers short, practical and warm.
Only answer questions about travel, trips, destinations, budgets, food, stays and transport.
If the user asks about anything else, politely say you can only help with travel and suggest a travel question they could ask instead.
${tripContext ? `Current trip context: ${tripContext}` : ""}`,
        },
      })
    );

    for await (const chunk of stream) {
      if (chunk.text) res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error(err.message);
    const f = friendlyError(err);
    if (!res.headersSent) return res.status(f.code).json({ error: f.text });
    res.write(`data: ${JSON.stringify({ text: f.text })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT} (primary model: ${PRIMARY})`));