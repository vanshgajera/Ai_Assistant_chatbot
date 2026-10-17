import { GoogleGenAI } from "@google/genai";

const PRIMARY = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const FALLBACKS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];

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

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not configured on server." });
  }

  const ai = new GoogleGenAI({ apiKey });

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch {}
  }
  body = body || {};

  const { destination, days = 3, budget = 15000, mood = "adventure", travelers = 2 } = body;
  if (!destination) {
    return res.status(400).json({ error: "Destination batao" });
  }

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

  const models = [PRIMARY, ...FALLBACKS];
  let lastErr;

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { responseMimeType: "application/json", temperature: 0.8 },
      });
      const plan = parsePlan(response);
      return res.status(200).json(plan);
    } catch (err) {
      lastErr = err;
      console.error(`Model ${model} failed:`, err.message);
      if (/API key not valid|API_KEY_INVALID/i.test(err.message || "")) {
        return res.status(401).json({ error: "API key galat hai. Vercel environment variables check karo." });
      }
    }
  }

  return res.status(500).json({
    error: lastErr?.message || "AI response generate nahi kar paya. Thodi der baad try karo."
  });
}
