/**
 * Agent Core: Tri-Brain AI system with Context Mixer integration.
 * 
 * Layers:
 * - Layer 1 (Reptilian): Yuka AI - handled externally
 * - Layer 2 (Limbic): Fast intuition (Llama 3.1 8B)
 * - Layer 3 (Neocortex): Deep reasoning (Llama 4 Maverick)
 */

import { getGroqClient, GROQ_MODELS, type GroqModelId } from '@/lib/groq';
import { ContextMixer, TriggerType, createContextMixer } from '@/lib/context-mixer';

// =============================================================================
// TYPES
// =============================================================================

export interface NearbyEntity {
    type: string;
    id?: string;
    name?: string;
    distance: number;
    status?: string;
}

export interface AgentContext {
    position: { x: number; y: number; z: number };
    nearbyEntities: NearbyEntity[];
    currentBehavior: string;
    spatialContext?: string;
}

/** Output from Layer 2 (Limbic) - Quick reactions */
export interface LimbicResponse {
    reaction: 'WAVE' | 'IGNORE' | 'APPROACH' | 'FLEE' | 'OBSERVE';
    bark?: string;      // Short vocalization ("Hey!", "Hmm...")
    confidence: number; // 0.0 to 1.0
}

/** Output from Layer 3 (Neocortex) - Deep decisions */
export interface NeocortexResponse {
    action: 'MOVE_TO' | 'WAIT' | 'WANDER' | 'FOLLOW' | 'SPEAK' | 'WORK';
    targetId?: string;
    target?: { x: number; y: number; z: number };
    speech?: string;
    thought: string;
    memoryToStore?: string;
}

// =============================================================================
// LAYER CONFIGURATIONS
// =============================================================================

const LAYER_CONFIG = {
    /** Layer 2: Fast, cheap, for quick reactions */
    LIMBIC: {
        model: GROQ_MODELS.LLAMA_3_1_8B,
        maxTokens: 128,
        temperature: 0.8,
        systemPrompt: `You are an agent's INTUITION. React instantly to stimuli.

Output JSON ONLY:
{"reaction": "WAVE"|"IGNORE"|"APPROACH"|"FLEE"|"OBSERVE", "bark": "short phrase", "confidence": 0.0-1.0}

Rules:
- WAVE: Friendly entity nearby
- APPROACH: Interesting object/person
- FLEE: Danger detected
- OBSERVE: Uncertain, need more info
- IGNORE: Not relevant`
    },

    /** Layer 3: Slower, smarter, for complex decisions */
    NEOCORTEX: {
        model: GROQ_MODELS.LLAMA_4_MAVERICK,
        maxTokens: 256,
        temperature: 0.7,
        systemPrompt: `You are an autonomous AI agent in a 3D world. You reason deeply about your situation.

Output JSON ONLY:
{
  "action": "MOVE_TO"|"WAIT"|"WANDER"|"FOLLOW"|"SPEAK"|"WORK",
  "targetId": "optional entity id",
  "target": {"x": num, "y": num, "z": num} (optional),
  "speech": "what you say aloud" (optional),
  "thought": "your internal reasoning",
  "memoryToStore": "important fact to remember" (optional)
}

Be natural, curious, and helpful.`
    }
} as const;

// =============================================================================
// CORE FUNCTIONS
// =============================================================================

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Process a Layer 2 (Limbic) quick reaction.
 * Used for fast, instinctive responses.
 */
export async function processLimbicReaction(
    trigger: string,
    contextMixer: ContextMixer
): Promise<LimbicResponse> {
    const context = contextMixer.buildContext('PERCEPTION');

    const userPrompt = `## Stimulus
${trigger}

## Context
${context}

React instantly.`;

    try {
        const client = getGroqClient();

        const response = await client.chat.completions.create({
            model: LAYER_CONFIG.LIMBIC.model,
            messages: [
                { role: "system", content: LAYER_CONFIG.LIMBIC.systemPrompt },
                { role: "user", content: userPrompt }
            ],
            temperature: LAYER_CONFIG.LIMBIC.temperature,
            max_tokens: LAYER_CONFIG.LIMBIC.maxTokens,
            response_format: { type: "json_object" }
        });

        const content = response.choices[0]?.message?.content;
        if (!content) throw new Error("Empty limbic response");

        return JSON.parse(content) as LimbicResponse;

    } catch (error) {
        console.error("[Limbic] Error:", error);
        return { reaction: 'OBSERVE', confidence: 0.3 };
    }
}

/**
 * Process a Layer 3 (Neocortex) deep decision.
 * Used for complex reasoning, conversation, planning.
 */
export async function processNeocortexThought(
    triggerType: TriggerType,
    contextMixer: ContextMixer,
    additionalContext?: string,
    spatialOverride?: string
): Promise<NeocortexResponse> {
    const MAX_RETRIES = 3;
    let attempt = 0;

    const context = contextMixer.buildContext(triggerType, { spatial: spatialOverride });

    const userPrompt = `## State
${context}
${additionalContext ? `\n## Additional Info\n${additionalContext}` : ''}

Decide your next action.`;

    while (attempt < MAX_RETRIES) {
        try {
            const client = getGroqClient();

            const response = await client.chat.completions.create({
                model: LAYER_CONFIG.NEOCORTEX.model,
                messages: [
                    { role: "system", content: LAYER_CONFIG.NEOCORTEX.systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                temperature: LAYER_CONFIG.NEOCORTEX.temperature,
                max_tokens: LAYER_CONFIG.NEOCORTEX.maxTokens,
                response_format: { type: "json_object" }
            });

            const content = response.choices[0]?.message?.content;
            if (!content) throw new Error("Empty neocortex response");

            const result = JSON.parse(content) as NeocortexResponse;

            // Auto-store memory if provided
            if (result.memoryToStore) {
                contextMixer.getHippocampus().addMemory(
                    result.memoryToStore,
                    'observation',
                    0.7
                );
            }

            return result;

        } catch (error: any) {
            console.error(`[Neocortex] Error (${attempt + 1}/${MAX_RETRIES}):`, error.message || error);

            const isRateLimit =
                JSON.stringify(error).includes("429") ||
                JSON.stringify(error).includes("rate_limit");

            if (isRateLimit) {
                console.warn("[Neocortex] Rate limit hit. Backing off...");
                await sleep(2000 * Math.pow(2, attempt));
            } else if (attempt < MAX_RETRIES - 1) {
                await sleep(1000);
            }

            attempt++;
        }
    }

    // Fallback response
    return {
        action: 'WAIT',
        thought: 'Mind is clouded... (API Error)'
    };
}

/**
 * Legacy compatibility: Process thought using old interface.
 * Routes to Neocortex layer with converted context.
 */
export async function processAgentThought(context: AgentContext): Promise<string> {
    // Dynamic import THREE for server-side usage
    const THREE = await import('three');

    // Create a temporary mixer for legacy calls
    const mixer = createContextMixer();

    // Populate visual cortex with nearby entities
    const entities = context.nearbyEntities.map(e => ({
        id: e.id || `entity_${Math.random()}`,
        type: e.type as 'PLAYER' | 'AGENT' | 'OBJECT' | 'LANDMARK',
        name: e.id,
        distance: e.distance,
        direction: new THREE.Vector3(0, 0, -1),
        lastSeen: Date.now()
    }));

    mixer.getVisualCortex().update(
        entities,
        new THREE.Vector3(0, 0, -1)
    );

    const result = await processNeocortexThought(
        'PERCEPTION',
        mixer,
        `Position: (${context.position.x.toFixed(1)}, ${context.position.y.toFixed(1)}, ${context.position.z.toFixed(1)})\nBehavior: ${context.currentBehavior}`,
        context.spatialContext
    );

    return JSON.stringify(result);
}

// =============================================================================
// DREAMER (Background Memory Consolidation)
// =============================================================================

/**
 * Summarize recent memories using cheap model.
 * Called periodically or during "sleep" states.
 */
export async function consolidateMemories(contextMixer: ContextMixer): Promise<void> {
    const memories = contextMixer.getHippocampus().getRawForSummary();

    if (memories.length < 3) return; // Not enough to summarize

    const memoryText = memories.map(m => `- ${m.content}`).join('\n');

    try {
        const client = getGroqClient();

        const response = await client.chat.completions.create({
            model: GROQ_MODELS.LLAMA_3_1_8B, // Use cheap model
            messages: [
                {
                    role: "system",
                    content: "Summarize these memories into one concise sentence. Be brief."
                },
                {
                    role: "user",
                    content: memoryText
                }
            ],
            temperature: 0.3,
            max_tokens: 64
        });

        const summary = response.choices[0]?.message?.content?.trim();
        if (summary) {
            contextMixer.getHippocampus().consolidate(summary);
            console.log("[Dreamer] Consolidated memories:", summary);
        }

    } catch (error) {
        console.error("[Dreamer] Failed to consolidate:", error);
    }
}

// =============================================================================
// EXPORTS
// =============================================================================

export { createContextMixer, type ContextMixer, type TriggerType };
