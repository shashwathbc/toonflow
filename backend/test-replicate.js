import Replicate from "replicate";
import { config } from 'dotenv';
config();

const token = process.env.REPLICATE_API_TOKEN;
console.log("Testing Token:", token ? token.slice(0, 5) + "..." : "MISSING");

const replicate = new Replicate({
    auth: token,
});

async function test() {
    try {
        console.log("Running google/imagen-4...");
        const output = await replicate.run(
            "google/imagen-4",
            {
                input: {
                    prompt: "A test image of a cat",
                    aspect_ratio: "1:1"
                }
            }
        );
        console.log("Success!", output);
    } catch (error) {
        console.error("Error:", error);
    }
}

test();
