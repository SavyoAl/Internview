console.log("✅ Backend starting...");

const express = require("express");
const axios = require("axios");
require("dotenv").config();
const cors = require("cors");
const multer = require("multer");
const FormData = require("form-data");

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
};

// 🔹 Route: Generate Interview Question
app.post("/api/question", async (req, res) => {
  const { role, company } = req.body;

  if (!role) {
    return res.status(400).json({ error: "Role is required" });
  }

  const prompt = `You are a professional interviewer for the role of ${role}${company ? " at " + company : ""}. 
Ask one open-ended behavioral interview question relevant to this role. Avoid yes/no questions. Ask only one question.`;

  try {
    const response = await axios.post(
      OPENAI_API_URL,
      {
        model: "gpt-4",
        messages: [
          { role: "system", content: "You are a professional job interviewer." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7
      },
      { headers: HEADERS }
    );

    const question = response.data.choices?.[0]?.message?.content?.trim();
    if (!question) throw new Error("No question returned by GPT");

    console.log("✅ Generated question:", question);
    res.json({ question });

  } catch (err) {
    console.error("❌ GPT Request Failed:", err.response?.data || err.message);
    res.status(500).json({ error: "Error generating question" });
  }
});

// 🔹 Route: Evaluate User Answer using STAR method
app.post("/api/evaluate", async (req, res) => {
  const { answer, company } = req.body;

  const evalPrompt = `
You are an AI trained to evaluate behavioral interview responses using the STAR method. 

You are evaluating this response **as if you were part of the hiring team at ${company || "a professional company"}**.

Evaluate the following answer:
"${answer}"

1. Does the answer include:
   - Situation
   - Task
   - Action
   - Result?

2. Rate the following from 1 to 5:
   - Clarity
   - Relevance
   - Confidence

3. Provide short, actionable feedback from the perspective of someone hiring for ${company || "a professional company"}. Emphasize how the response aligns or doesn't align with the company's expectations, communication style, or values if relevant.

Format your response like this:
---
STAR Breakdown:
- Situation: [Yes/No]
- Task: [Yes/No]
- Action: [Yes/No]
- Result: [Yes/No]

Scores:
- Clarity: [1-5]
- Relevance: [1-5]
- Confidence: [1-5]

Feedback:
[Personalized feedback as someone from ${company}]
---
`;

  try {
    const response = await axios.post(
      OPENAI_API_URL,
      {
        model: "gpt-4",
        messages: [
          { role: "system", content: "You are a helpful AI interview evaluator." },
          { role: "user", content: evalPrompt }
        ],
        temperature: 0.5
      },
      { headers: HEADERS }
    );

    const feedback = response.data.choices[0].message.content.trim();
    console.log("✅ Evaluation complete");
    res.json({ feedback });
  } catch (err) {
    console.error("❌ Error evaluating answer:", err.message);
    res.status(500).send("Error evaluating answer");
  }
});

// 🔹 Route: Transcribe Audio using Whisper
app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  try {
    const formData = new FormData();
    formData.append("file", req.file.buffer, "voice.webm");
    formData.append("model", "whisper-1");

    const response = await axios.post(
      "https://api.openai.com/v1/audio/transcriptions",
      formData,
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          ...formData.getHeaders()
        }
      }
    );

    const transcript = response.data.text;
    console.log("🎧 Whisper transcript:", transcript);
    res.json({ transcript });
  } catch (err) {
    console.error("❌ Whisper API error:", err.response?.data || err.message);
    res.status(500).json({ error: "Transcription failed" });
  }
});

// 🔹 Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Backend running at http://localhost:${PORT}`));
