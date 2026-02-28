import { GoogleGenAI } from '@google/genai';
require('dotenv').config({ path: '.env.local' });

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-1.5-pro',
            contents: 'say hi',
        });
        console.log("Response:", response.text);
    } catch (e) {
        console.error(e.message);
    }
}
run();
