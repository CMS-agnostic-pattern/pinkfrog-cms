import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = express();
const port = 3001;

// Load API key from environment variable
if (!process.env.GEMINI_KEY) {
    console.error("GEMINI_KEY is not set in the .env file.");
    process.exit(1);
}
console.log('GEMINI_KEY', process.env.GEMINI_KEY);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);

app.use(express.json());
app.use(express.static('public'));

app.post('/gemini', async (req, res) => {
    try {
        const { prompt } = req.body;

        // API key validation already done at startup
        console.log('Using Gemini API');
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        res.json({ text });
    } catch (error) {
        console.error('Detailed error from Gemini API:', error);
        res.status(500).json({ error: 'Failed to get response from Gemini. Check server logs for details.' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`CMS server listening at http://localhost:${port}`);
});