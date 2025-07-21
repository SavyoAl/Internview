console.log("✅ Backend starting...");

const express = require("express");
const axios = require("axios");
require("dotenv").config();
const cors = require("cors");
const multer = require("multer");
const FormData = require("form-data");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors());
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("❌ Missing Supabase URL or Anon Key in .env");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// OpenAI Setup
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
};

// Route: Generate Interview Question
app.post("/api/question", async (req, res) => {
  const { role, company } = req.body;
  if (!role) return res.status(400).json({ error: "Role is required" });

  try {
    const { data, error } = await supabase
      .from("interview_questions")
      .select("question")
      .eq("role", role.toLowerCase())
      .order("id", { ascending: false })
      .limit(1);

    if (error) throw error;

    if (data.length > 0) {
      console.log("✅ Fetched from Supabase:", data[0].question);
      return res.json({ question: data[0].question });
    }

    const prompt = `You are a professional interviewer for the role of ${role}${company ? " at " + company : ""}. Ask one open-ended behavioral interview question. Avoid yes/no questions.`;

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

    console.log("🧠 GPT-4 fallback question:", question);
    res.json({ question });

  } catch (err) {
    console.error("❌ /api/question:", err.message);
    res.status(500).json({ error: "Error generating question" });
  }
});

// Route: Evaluate Answer
app.post("/api/evaluate", async (req, res) => {
  const { answer, role, company } = req.body;

  const evalPrompt = `
You are an AI trained to evaluate behavioral interview responses using the STAR method.

Evaluate the following answer from a candidate applying for ${role || "a professional role"} at ${company || "a company"}:

"${answer}"

1. STAR breakdown:
- Situation
- Task
- Action
- Result

2. Rate (1-5):
- Clarity
- Relevance
- Confidence

3. Short actionable feedback

Format:
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
[Feedback here]
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

    const feedback = response.data.choices?.[0]?.message?.content?.trim();
    console.log("✅ Evaluation generated");
    res.json({ feedback });

  } catch (err) {
    console.error("❌ /api/evaluate:", err.message);
    res.status(500).json({ error: "Evaluation failed" });
  }
});

// Route: Audio Transcription
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
    console.log("🎧 Transcribed:", transcript);
    res.json({ transcript });

  } catch (err) {
    console.error("❌ /api/transcribe:", err.message);
    res.status(500).json({ error: "Transcription failed" });
  }
});

// Route: Extract Role and Company
app.post("/api/extract-role-company", async (req, res) => {
  const { intro } = req.body;
  if (!intro) return res.status(400).json({ error: "Missing input" });

  const prompt = `
Extract the job role and company from this sentence:
"${intro}"
Respond in JSON:
{ "role": "Your Role", "company": "Company Name" }
`;

  try {
    const response = await axios.post(
      OPENAI_API_URL,
      {
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "Extract JSON from user message." },
          { role: "user", content: prompt }
        ],
        temperature: 0
      },
      { headers: HEADERS }
    );

    const raw = response.data.choices?.[0]?.message?.content;
    const json = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    console.log("🔍 Extracted role & company:", json);
    res.json(json);

  } catch (err) {
    console.error("❌ /api/extract-role-company:", err.message);
    res.status(500).json({ role: null, company: null });
  }
});

// Route: Save Chat
app.post("/api/save-chat", async (req, res) => {
  const { session_id, role, company, message, sender } = req.body;

  try {
    const { error } = await supabase.from("chat_logs").insert([{
      session_id,
      role,
      company,
      message,
      sender,
      timestamp: new Date().toISOString()
    }]);

    if (error) throw error;
    console.log("💾 Chat saved:", { session_id, message });
    res.json({ success: true });

  } catch (err) {
    console.error("❌ /api/save-chat:", err.message);
    res.status(500).json({ error: "Failed to save chat" });
  }
});

// Route: Load Chat
app.post("/api/load-chat", async (req, res) => {
  const { session_id } = req.body;

  try {
    const { data, error } = await supabase
      .from("chat_logs")
      .select("*")
      .eq("session_id", session_id)
      .order("timestamp", { ascending: true });

    if (error) throw error;
    res.json({ data });

  } catch (err) {
    console.error("❌ /api/load-chat:", err.message);
    res.status(500).json({ error: "Failed to load chat" });
  }
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
