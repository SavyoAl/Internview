console.log("hi im in")
const express = require("express");
const axios = require("axios");
require("dotenv").config();
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/question", async (req, res) => {
  const { role, company } = req.body;
  const prompt = `You're a professional interviewer for a ${role} at ${company}. Ask the first open-ended question.`;

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    const question = response.data.choices[0].message.content;
    res.json({ question });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error generating question");
  }
});

app.listen(5000, () => console.log("Backend running on port 5000"));
