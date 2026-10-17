import { GoogleGenAI } from "@google/genai";

const PRIMARY = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const FALLBACKS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];

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

  const { messages = [], tripContext = "" } = body;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  if (typeof res.flushHeaders === "function") res.flushHeaders();

  const contents = messages.map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.text }],
  }));

  const models = [PRIMARY, ...FALLBACKS];
  let streamed = false;

  for (const model of models) {
    try {
      const stream = await ai.models.generateContentStream({
        model,
        contents,
        config: {
          systemInstruction: `You are "Wanderly", a friendly AI travel assistant for Indian travellers.
Reply in the same language the user writes (Hinglish is fine). Keep answers short, practical and warm.
Only answer questions about travel, trips, destinations, budgets, food, stays and transport.
If the user asks about anything else, politely say you can only help with travel and suggest a travel question they could ask instead.
${tripContext ? `Current trip context: ${tripContext}` : ""}`,
        },
      });

      for await (const chunk of stream) {
        if (chunk.text) {
          res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
          streamed = true;
        }
      }
      res.write("data: [DONE]\n\n");
      return res.end();
    } catch (err) {
      console.error(`Model ${model} streaming error:`, err.message);
      if (streamed) {
        res.write(`data: ${JSON.stringify({ text: " [Error occurred during streaming]" })}\n\n`);
        res.write("data: [DONE]\n\n");
        return res.end();
      }
    }
  }

  res.write(`data: ${JSON.stringify({ text: "AI abhi busy hai. Kripya thodi der baad try karein." })}\n\n`);
  res.write("data: [DONE]\n\n");
  return res.end();
}
