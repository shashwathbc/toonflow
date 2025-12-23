import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { HfInference } from '@huggingface/inference';

// Load environment variables from .env file
config();

// Initialize Express app
const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Serve static files from uploads directory
import path from 'path';
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Routes
import characterRoutes from './routes/characters.js';
app.use('/api/characters', characterRoutes);

// Constants
const PORT = process.env.PORT || 5050;
const MODEL = "Tongyi-MAI/Z-Image-Turbo";

// Initialize Hugging Face client
const HF_TOKEN = process.env.HF_TOKEN;
const hf = new HfInference(HF_TOKEN);

console.log("Image Provider: Hugging Face Inference API");
console.log("Model:", MODEL);
console.log("HF Token Loaded:", HF_TOKEN ? "YES (" + HF_TOKEN.slice(0, 5) + "...)" : "NO");

/**
 * Generate Image Route (Legacy/Direct)
 * ... (keeping this for backward compatibility if needed, or we can deprecate)
 */
// Rename to generic 'generate' as requested
app.post('/api/generate', async (req, res) => {
  try {
    // Determine input format - support both new payload and legacy prompt-only if needed
    const {
      characterName,
      characterPrompt,
      style,
      prompt: legacyPrompt, // Fallback
      width = 1024,
      height = 1024
    } = req.body;

    // Construct final prompt based on inputs
    // If 'characterName'/'characterPrompt' are present, use them with style logic
    // Otherwise fall back to 'prompt'
    let finalPrompt = legacyPrompt;

    if (characterPrompt) {
      // Construct prompt with style and name, but explicitly for SCENES/PANELS (Webtoon)
      // avoiding "solo character" constraint if it's a scene
      let styleDesc = "";
      if (style === "Manga B/W" || style === "manga_bw") styleDesc = "manga style, black and white, line art, ink drawing, high contrast, speed lines";
      else if (style === "Webtoon Color" || style === "anime_color") styleDesc = "webtoon style, anime style, vibrant colors, cel shaded, digital art";
      else if (style === "Sketch") styleDesc = "rough sketch, pencil drawing, storyboard style";

      const subjectDesc = characterName ? `Subject: ${characterName}.` : "";

      finalPrompt = `
            ${styleDesc},
            ${subjectDesc}
            ${characterPrompt},
            masterpiece, best quality, narrative composition
        `.trim().replace(/\s+/g, ' ');
    }

    if (!finalPrompt) {
      return res.status(400).json({ error: 'Missing description/prompt' });
    }

    console.log(`Generating image for prompt: "${finalPrompt}"`);

    // Call Hugging Face API
    const imageBlob = await hf.textToImage({
      model: MODEL,
      inputs: finalPrompt,
      parameters: {
        width: width,
        height: height,
      }
    });

    // Convert Blob to Buffer
    const arrayBuffer = await imageBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Convert to base64 data URL
    const base64Image = buffer.toString('base64');
    const imageUrl = `data:image/jpeg;base64,${base64Image}`;

    // Return the generated image as data URL
    res.json({ imageUrl });

  } catch (error) {
    // Log error for debugging
    console.error('Image generation error:', error);

    // Return error response with details
    res.status(500).json({
      error: 'Generation failed',
      details: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});