// Initialize Anthropic Claude client for the Ensemble
let anthropic;
try {
  const { Anthropic } = require('@anthropic-ai/sdk');
  anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
} catch (error) {
  console.warn('Anthropic Claude SDK not available. Install @anthropic-ai/sdk to use Claude models.');
}

// Initialize Google Generative AI client for Gemini
let genAI;
try {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
} catch (error) {
  console.warn('Google Generative AI SDK not available. Install @google/generative-ai to use Gemini models.');
}

export { anthropic, genAI }; 