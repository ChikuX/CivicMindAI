import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

// Set up body parsers with generous limits for base64 image uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Lazy init or safety check for Gemini key
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY environment variable is not configured.');
  }
  return new GoogleGenAI({ apiKey });
};

// API Endpoints

// 1. Analyze civic issue image
app.post('/api/gemini/analyze', async (req, res, next) => {
  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64) {
       res.status(400).json({ error: 'imageBase64 is required' });
       return;
    }
    
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const ai = getGeminiClient();
    
    const prompt = `analyze this image and identify: 1) type of civic/infrastructure issue (pothole, water leak, broken streetlight, garbage overflow, damaged road, open drain, or other) 2) severity (low/medium/high/critical) 3) one sentence description of what you see. respond in JSON format only: {"category": "pothole", "severity": "medium", "description": "A deep pothole in the middle of the street."}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [
        prompt,
        {
          inlineData: {
            data: cleanBase64,
            mimeType: mimeType || 'image/jpeg'
          }
        }
      ],
      config: {
        responseMimeType: 'application/json'
      }
    });

    const responseText = response.text || '{}';
    let parsed = {};
    try {
      parsed = JSON.parse(responseText);
    } catch (e) {
      // Fallback parser if JSON is wrapped in markdown
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        throw new Error('Failed to parse Gemini response as JSON: ' + responseText);
      }
    }

    res.json(parsed);
  } catch (error: any) {
    console.error('Gemini Analyze error:', error);
    res.status(500).json({ error: error.message || 'AI Analysis failed' });
  }
});

// 2. Department routing & explanation
app.post('/api/gemini/route-department', async (req, res, next) => {
  try {
    const { category, description, area } = req.body;
    const ai = getGeminiClient();

    const prompt = `given this civic issue: [${category}] with description [${description}] at location [${area || 'Unknown neighborhood'}], which indian municipal department should handle it? options: Roads Department, Water & Sewage Department, Electricity Board, Sanitation Department, Municipal Corporation General. respond with just the department name and one sentence why. Respond in JSON format only: {"department": "department_name", "explanation": "explanation_sentence"}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const responseText = response.text || '{}';
    let parsed = {};
    try {
      parsed = JSON.parse(responseText);
    } catch (e) {
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        parsed = { department: 'Municipal Corporation General', explanation: responseText };
      }
    }
    res.json(parsed);
  } catch (error: any) {
    console.error('Gemini Routing error:', error);
    res.status(500).json({ error: error.message || 'Routing failed' });
  }
});

// 3. Complaint letter generator
app.post('/api/gemini/generate-letter', async (req, res, next) => {
  try {
    const { department, description, location } = req.body;
    const ai = getGeminiClient();

    const prompt = `write a formal complaint letter to the [${department}] regarding [${description}] at [${location}]. keep it under 150 words, professional tone, include spaces for date and citizen name/signature at bottom. Respond directly with the letter text.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
    });

    res.json({ letter: response.text });
  } catch (error: any) {
    console.error('Gemini Letter error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate letter' });
  }
});

// 4. Generate AI Insights based on Firestore issues
app.post('/api/gemini/insights', async (req, res, next) => {
  try {
    const { issuesSummary } = req.body;
    const ai = getGeminiClient();

    const prompt = `here is data about civic issues in this community: ${JSON.stringify(issuesSummary)}. analyze this and give 3-4 sentences of insights about patterns, problem areas, trends. write it conversationally like you're briefing a city councillor, not like a data report. Make it feel helpful, strategic, and concise.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
    });

    res.json({ insights: response.text });
  } catch (error: any) {
    console.error('Gemini Insights error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate insights' });
  }
});

// Serve frontend assets
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
