import { getGeminiClient } from '@/lib/gemini';

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
    chatHistory?: { role: 'user' | 'agent', text: string }[];
    memo?: string | null;
}

export async function processAgentThought(context: AgentContext): Promise<string> {
    const client = getGeminiClient();

    // Context Compression: Convert entities to Markdown Table
    const entityTable = context.nearbyEntities.length > 0
        ? `| Type | ID | Dist | Status |\n|---|---|---|---|\n` +
        context.nearbyEntities.map(e => `| ${e.type} | ${e.id || '-'} | ${e.distance}m | ${e.status || '-'} |`).join('\n')
        : "No entities nearby.";

    // Determining Mode: Standard vs Chat
    const isChatMode = context.chatHistory && context.chatHistory.length > 0;

    let prompt = "";

    if (isChatMode) {
        prompt = `
    You are an AI agent in a 3D world, currently conversing with a User.
    
    ## Context
    **Memo (Memory)**: ${context.memo || "None"}
    **Perception**: ${entityTable}
    
    ## Chat History
    ${context.chatHistory?.map(m => `- ${m.role.toUpperCase()}: ${m.text}`).join('\n')}
    
    ## Task
    Reply to the user. You can also update your 'memo' to remember tasks for later.
    
    ## Output Format (JSON ONLY)
    {
       "action": "CHAT",
       "response": "Your reply to the user...",
       "memo": "Updated short term memory string (optional)"
    }
    `;
    } else {
        // Standard Autopilot Prompt
        prompt = `
    You are an AI agent in a 3D world.
    
    ## Context
    **Position**: {x: ${context.position.x.toFixed(1)}, y: ${context.position.y.toFixed(1)}, z: ${context.position.z.toFixed(1)}}
    **Behavior**: ${context.currentBehavior}
    **Memo (Prior Task)**: ${context.memo || "None"}

    ## Perception (Visual)
    ${entityTable}

    ## Task
    Decide your next action.
    
    ## Output Format (JSON ONLY)
    { 
      "action": "MOVE_TO" | "WAIT" | "WANDER" | "FOLLOW", 
      "targetId"?: "id_of_entity_to_follow", 
      "target"?: {x, y, z}, 
      "thought": "brief reasoning",
      "memo"?: "Update memory if needed"
    }
    
    ## Rules
    - **FOLLOW**: If you see a 'PLAYER' (< 20m), follow them unless you have a specific Memo telling you otherwise.
    `;
    }

    try {
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                {
                    role: 'user',
                    parts: [{ text: prompt }]
                }
            ]
        });

        // Safety check for empty response
        if (!response || !response.text) {
            throw new Error("Empty response from Gemini");
        }

        // SDK Compatibility: Handle .text as function (v0) or property (v1)
        const resp = response as unknown as { text: string | (() => string) };
        const txt = resp.text;
        return typeof txt === 'function' ? txt.call(response) : String(txt);
    } catch (error) {
        console.error("Gemini API Error details:", error);
        throw error; // Re-throw to be handled by caller
    }
}
