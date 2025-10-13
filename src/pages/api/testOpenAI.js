import OpenAI from "openai";

export default async function handler(req, res) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, // zet je sleutel in .env.local
  });

  try {
    const models = await openai.models.list(); // simpel request
    res.status(200).json({
      message: "✅ API werkt!",
      models: models.data.map((m) => m.id),
    });
  } catch (error) {
    if (error.status === 429) {
      res.status(429).json({ error: "⚠️ Te veel requests of limiet bereikt" });
    } else if (error.status === 401) {
      res.status(401).json({ error: "❌ API-sleutel ongeldig of niet geactiveerd" });
    } else {
      res.status(500).json({ error: "❌ Andere fout", details: error.message });
    }
  }
}