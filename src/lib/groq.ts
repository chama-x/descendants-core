import Groq from "groq-sdk";

/**
 * Available Groq models for agent AI.
 * Add/remove models here to expose them in the UI.
 * Updated for January 2026 - verified against Groq API.
 * 
 * Note: DeepSeek R1 Distill was deprecated Oct 2025.
 */
export const GROQ_MODELS = {
    /** Llama 4 Maverick - Best general-purpose (MoE, ~17B active, 400B total, multimodal) */
    LLAMA_4_MAVERICK: "meta-llama/llama-4-maverick-17b-128e-instruct",
    /** Llama 4 Scout - Lighter version (MoE, ~17B active, 109B total) */
    LLAMA_4_SCOUT: "meta-llama/llama-4-scout-17b-16e-instruct",
    /** Llama 3.3 70B - Proven stability, excellent for text-based agents */
    LLAMA_3_3_70B: "llama-3.3-70b-versatile",
    /** Llama 3.1 8B - Fastest responses, simple decisions */
    LLAMA_3_1_8B: "llama-3.1-8b-instant",
    /** Mixtral 8x7B - Good fallback option */
    MIXTRAL_8X7B: "mixtral-8x7b-32768",
} as const;

export type GroqModelId = (typeof GROQ_MODELS)[keyof typeof GROQ_MODELS];

/** 
 * Default model - Llama 4 Maverick for best 2026 performance-to-cost ratio.
 * Falls back to Llama 3.3 70B if Maverick unavailable.
 */
export const DEFAULT_MODEL: GroqModelId = GROQ_MODELS.LLAMA_4_MAVERICK;

// Singleton client instance
let client: Groq | null = null;

/**
 * Get or create the Groq client singleton.
 * Throws if GROQ_API_KEY is not set.
 */
export function getGroqClient(): Groq {
    if (!client) {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            throw new Error("GROQ_API_KEY environment variable is not set");
        }
        client = new Groq({ apiKey });
        console.log("Groq client initialized.");
    }
    return client;
}

// Runtime model selection (for future UI control)
let currentModel: GroqModelId = DEFAULT_MODEL;

/**
 * Set the active model for agent AI calls.
 * Can be called from game store or UI.
 */
export function setActiveModel(model: GroqModelId): void {
    currentModel = model;
    console.log(`Groq model set to: ${model}`);
}

/**
 * Get the currently active model ID.
 */
export function getActiveModel(): GroqModelId {
    return currentModel;
}

/**
 * Get all available models for UI display.
 */
export function getAvailableModels(): { id: GroqModelId; name: string }[] {
    return [
        { id: GROQ_MODELS.LLAMA_4_MAVERICK, name: "Llama 4 Maverick (Best Quality)" },
        { id: GROQ_MODELS.LLAMA_4_SCOUT, name: "Llama 4 Scout (Fast + Quality)" },
        { id: GROQ_MODELS.LLAMA_3_3_70B, name: "Llama 3.3 70B (Stable)" },
        { id: GROQ_MODELS.LLAMA_3_1_8B, name: "Llama 3.1 8B (Fastest)" },
        { id: GROQ_MODELS.MIXTRAL_8X7B, name: "Mixtral 8x7B (Fallback)" },
    ];
}
