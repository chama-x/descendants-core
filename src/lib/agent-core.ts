import { getGroqClient, getActiveModel } from '@/lib/groq';

export interface NearbyEntity {
    type: string; // e.g., 'PLAYER', 'AGENT', 'OBSTACLE'
    id?: string;
    distance: number;
    status?: string; // e.g., 'Moving', 'Idle'
}

export interface AgentContext {
    position: { x: number; y: number; z: number };
    nearbyEntities: NearbyEntity[];
    currentBehavior: string;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function processAgentThought(context: AgentContext): Promise<string> {
    const MAX_RETRIES = 3;
    let attempt = 0;

    // Context Compression: Convert entities to Markdown Table
    const entityTable = context.nearbyEntities.length > 0
        ? `| Type | ID | Dist | Status |\n|---|---|---|---|\n` +
        context.nearbyEntities.map(e => `| ${e.type} | ${e.id || '-'} | ${e.distance}m | ${e.status || '-'} |`).join('\n')
        : "No entities nearby.";

    const systemPrompt = `You are an AI agent in a 3D world. You make decisions based on your perception.

## Rules
- **FOLLOW**: If you see a 'PLAYER' (<20m), decide to 'FOLLOW' them to say hello.
- **WANDER**: If no specific entities of interest, explore.
- **WAIT**: If idle or thinking.

## Output Format
Respond ONLY with valid JSON in this exact format:
{
  "action": "MOVE_TO" | "WAIT" | "WANDER" | "FOLLOW",
  "targetId": "id_of_entity_to_follow (optional)",
  "target": {"x": number, "y": number, "z": number} (optional),
  "thought": "brief reasoning"
}`;

    const userPrompt = `## Current State
**Position**: {x: ${context.position.x.toFixed(1)}, y: ${context.position.y.toFixed(1)}, z: ${context.position.z.toFixed(1)}}
**Behavior**: ${context.currentBehavior}

## Perception (Visual)
${entityTable}

Decide your next action.`;

    while (attempt < MAX_RETRIES) {
        try {
            const client = getGroqClient();
            const model = getActiveModel();

            const response = await client.chat.completions.create({
                model: model,
                messages: [
                    {
                        role: "system",
                        content: systemPrompt
                    },
                    {
                        role: "user",
                        content: userPrompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 256, // Keep responses short for fast inference
                response_format: { type: "json_object" }
            });

            const content = response.choices[0]?.message?.content;
            if (!content) {
                throw new Error("Empty response from Groq");
            }

            return content;

        } catch (error: any) {
            console.error(`Groq API Error (Attempt ${attempt + 1}/${MAX_RETRIES}):`, error.message || error);

            // Check for rate limit errors
            const isRateLimit =
                JSON.stringify(error).includes("429") ||
                JSON.stringify(error).includes("rate_limit") ||
                JSON.stringify(error).includes("quota");

            if (isRateLimit) {
                console.warn("Rate limit hit. Waiting before retry...");
                // Exponential backoff: 2s, 4s, 8s
                await sleep(2000 * Math.pow(2, attempt));
            } else {
                // For non-rate-limit errors, wait briefly and retry
                if (attempt < MAX_RETRIES - 1) {
                    await sleep(1000);
                }
            }

            attempt++;

            if (attempt >= MAX_RETRIES) {
                throw new Error("Failed to generate thought after multiple attempts.");
            }
        }
    }

    throw new Error("Failed to generate thought after multiple attempts.");
}
