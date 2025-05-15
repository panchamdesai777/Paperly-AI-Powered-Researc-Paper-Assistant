const express = require('express');
const cors = require('cors');
const app = express();
const port = 8000;

app.use(cors());
app.use(express.json());

app.post('/explain', async (req, res) => {
  try {
    const { query, level, url } = req.body;
    const apiKey = req.headers['x-groq-key'];
    
    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }

    // Here you would make the actual API call to Groq
    // For now, we'll return a mock response
    const mockResponse = {
      explanation: `This is a mock explanation for: "${query}"\n\nLevel: ${level}\nURL: ${url}`
    };

    res.json(mockResponse);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 