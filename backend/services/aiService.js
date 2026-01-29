import { HfInference } from '@huggingface/inference';
import Replicate from 'replicate';

// Default to existing model if not specified
const DEFAULT_MODEL = "Tongyi-MAI/Z-Image-Turbo";
const REPLICATE_MODEL = "google/imagen-4";

class AIService {
    constructor() {
        this.model = DEFAULT_MODEL;
        this.initialized = false;
        this.hf = null;
        this.replicate = null;
    }

    ensureInitialized() {
        if (this.initialized) return;

        // Load tokens from process.env which should be populated by now
        const hfToken = process.env.HF_TOKEN;
        const replToken = process.env.REPLICATE_API_TOKEN;

        console.log("[AIService] Initializing clients...");
        console.log(`[AIService] HF Token present: ${!!hfToken}`);
        console.log(`[AIService] Replicate Token present: ${!!replToken}`);

        if (hfToken) {
            this.hf = new HfInference(hfToken);
        }

        if (replToken) {
            try {
                this.replicate = new Replicate({ auth: replToken });
                console.log("[AIService] Replicate client initialized");
            } catch (e) {
                console.error("[AIService] Failed to init Replicate:", e);
            }
        }

        this.initialized = true;
    }

    /**
     * Generates a character image based on the prompt and style.
     * @param {string} characterPrompt - The user's description.
     * @param {string} style - The requested style.
     * @returns {Promise<Buffer>} - The generated image buffer.
     */
    async generateCharacterImage(characterPrompt, style) {
        this.ensureInitialized();

        if (this.replicate) {
            return this.generateWithReplicate(characterPrompt, style);
        }

        if (this.hf) {
            console.warn("[AIService] Replicate token missing, falling back to Hugging Face.");
            return this.generateWithHF(characterPrompt, style);
        }

        throw new Error("No AI provider available. Please set REPLICATE_API_TOKEN or HF_TOKEN.");
    }

    async generateWithReplicate(characterPrompt, style) {
        // Replicate (Imagen 3/4) Prompt Construction
        let stylePrompt = "";
        if (style === "manga_bw") {
            stylePrompt = "manga style, black and white, line art, ink drawing, high contrast";
        } else if (style === "anime_color") {
            stylePrompt = "anime style, vibrant colors, cel shaded";
        } else {
            stylePrompt = "anime manga style";
        }

        // const finalPrompt = `
        //     ${stylePrompt},
        //     solo character, centered,
        //     ${characterPrompt},
        //     clean line art, white background,
        //     no text, no watermark, masterpiece, best quality
        // `.trim().replace(/\s+/g, ' ');

        const finalPrompt = ` ${stylePrompt}, ${characterPrompt}`.trim().replace(/\s+/g, ' ');

        console.log(`[AIService] Generating with Replicate (google/imagen-4): ${finalPrompt}`);

        try {
            const output = await this.replicate.run(
                REPLICATE_MODEL,
                {
                    input: {
                        prompt: finalPrompt,
                        aspect_ratio: "16:9", // Changed to 16:9 as per user snippet example, though 1:1 is better for chars. User asked structure "like this".
                        safety_filter_level: "block_medium_and_above"
                    }
                }
            );

            // Handle output format
            let imageUrl;
            if (Array.isArray(output) && output.length > 0) {
                imageUrl = output[0];
            } else if (typeof output === 'string') {
                imageUrl = output;
            } else {
                console.log("Output type:", typeof output);
                imageUrl = String(output);
            }

            console.log("[AIService] Replicate URL:", imageUrl);

            // Fetch the image to return as Buffer (so our controller can save it to temp)
            const response = await fetch(imageUrl);
            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);

        } catch (error) {
            console.error("[AIService] Replicate Error:", error);
            throw new Error("Replicate Generation Failed: " + error.message);
        }
    }

    async generateWithHF(characterPrompt, style) {
        // 2A. Generate Character Image - Enhanced Prompt
        let stylePrompt = "";
        if (style === "manga_bw") {
            stylePrompt = "manga style, black and white, line art, ink drawing, high contrast";
        } else if (style === "anime_color") {
            stylePrompt = "anime style, vibrant colors, cel shaded";
        } else {
            stylePrompt = "anime manga style";
        }

        const finalPrompt = `
            ${stylePrompt},
            solo character, centered,
            ${characterPrompt},
            clean line art, white background,
            no text, no watermark, masterpiece, best quality
        `.trim().replace(/\s+/g, ' ');

        console.log(`[AIService] Generating with HF prompt: ${finalPrompt}`);

        try {
            const imageBlob = await this.hf.textToImage({
                model: this.model,
                inputs: finalPrompt,
                parameters: {
                    width: 1024,
                    height: 1024,
                }
            });

            const arrayBuffer = await imageBlob.arrayBuffer();
            return Buffer.from(arrayBuffer);
        } catch (error) {
            console.error("[AIService] Error generating image:", error);
            throw new Error("AI Generation Failed: " + error.message);
        }
    }

    /**
     * Inpaint a selected area of an image.
     * @param {string} baseImage - To Data URL or URL of base image
     * @param {string} maskImage - To Data URL of mask (White=Edit, Black=Protect)
     * @param {string} prompt - User prompt
     * @param {string} style - Style
     */
    async generateInpainting(baseImage, maskImage, prompt, style) {
        this.ensureInitialized();

        if (this.replicate) {
            return this.generateInpaintReplicate(baseImage, maskImage, prompt, style);
        }

        // Fallback or Error
        throw new Error("Inpainting requires Replicate API token currently.");
    }

    async generateInpaintReplicate(baseImage, maskImage, prompt, style) {
        const INPAINT_MODEL = "stability-ai/stable-diffusion-inpainting";
        const INPAINT_VERSION = "c28b92a7ecd66eee8aefcd8e5695f01265fdd13a90ee07e45dd8d3885da37cbb"; // SD Inpainting

        let stylePrompt = "";
        if (style === "manga_bw") {
            stylePrompt = "manga style, black and white, line art, ink drawing, high contrast";
        } else if (style === "webtoon_color") { // Corrected from plan to match UI
            stylePrompt = "webtoon style, vibrant colors, digital art, manhwa";
        } else {
            stylePrompt = "anime style, vibrant colors, cel shaded";
        }

        const finalPrompt = `${stylePrompt}, ${prompt}, high quality, detailed, seamless blending`.trim();

        console.log(`[AIService] Inpainting with Replicate (${INPAINT_MODEL}): ${finalPrompt}`);

        try {
            const output = await this.replicate.run(
                INPAINT_MODEL,
                {
                    input: {
                        prompt: finalPrompt,
                        image: baseImage,
                        mask: maskImage,
                        negative_prompt: "text, watermark, low quality, artifacts, blurry, distorted, ugly",
                        num_inference_steps: 30,
                        guidance_scale: 7.5
                    }
                }
            );

            // Handle output format
            let imageUrl;
            if (Array.isArray(output) && output.length > 0) {
                imageUrl = output[0];
            } else if (typeof output === 'string') {
                imageUrl = output;
            } else {
                imageUrl = String(output);
            }

            console.log("[AIService] Inpaint Replicate URL:", imageUrl);

            const response = await fetch(imageUrl);
            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);

        } catch (error) {
            console.error("[AIService] Replicate Inpaint Error:", error);
            throw new Error("Replicate Inpainting Failed: " + error.message);
        }
    }
}

export const aiService = new AIService();
