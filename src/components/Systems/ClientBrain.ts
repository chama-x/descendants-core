import * as THREE from 'three';
import { generateAgentThought, AgentContext, NearbyEntity } from '@/app/actions';

export interface BrainState {
    thought: string;
    isThinking: boolean;
    lastThoughtTime: number;
    // Chat State
    isPausedForChat: boolean;
    chatHistory: { role: 'user' | 'agent', text: string }[];

    memo: string | null;
    mode: 'LLM' | 'LOCAL';
}

import { RateLimiter } from '@/lib/rateLimiter';

export interface AgentDecision {
    action: 'MOVE_TO' | 'WAIT' | 'WANDER' | 'FOLLOW' | 'CHAT';
    targetId?: string;
    target?: { x: number; y: number; z: number };
    thought: string;
    response?: string; // For Chat
    memo?: string; // For Parallel Processing
}

export class ClientBrain {
    public state: BrainState;
    private rateLimiter: RateLimiter;
    private id: string;

    // Registry for global access (e.g. from UI)
    private static registry: Map<string, ClientBrain> = new Map();

    public static getBrain(id: string): ClientBrain | undefined {
        return this.registry.get(id);
    }

    constructor(id: string = 'agent-01', isLLMEnabled: boolean = false) {
        this.id = id;
        ClientBrain.registry.set(id, this); // Register self
        this.state = {
            thought: isLLMEnabled ? "Initializing neural pathways..." : "Running heuristic core...",
            isThinking: false,
            lastThoughtTime: 0,
            isPausedForChat: false,
            chatHistory: [],
            memo: null,
            mode: isLLMEnabled ? 'LLM' : 'LOCAL'
        };
        // 15 requests per 60 seconds (Limit for Gemini Flash Free Tier)
        this.rateLimiter = new RateLimiter(15, 60);
    }

    // New Method: Chat with User
    public async chat(message: string): Promise<string> {
        this.state.isPausedForChat = true;
        this.state.chatHistory.push({ role: 'user', text: message });

        const context: AgentContext = {
            position: { x: 0, y: 0, z: 0 }, // Position less relevant in chat? Or use last known?
            nearbyEntities: [], // Blind in chat for now? Or keep last perceieved?
            currentBehavior: 'CHATTING',
            chatHistory: this.state.chatHistory,
            memo: this.state.memo
        };

        try {
            console.log(`[ClientBrain:${this.id}] Chatting...`);
            const responseText = await generateAgentThought(context);
            const cleanText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

            const decision = JSON.parse(cleanText);

            if (decision.response) {
                this.state.chatHistory.push({ role: 'agent', text: decision.response });
                if (decision.memo) this.state.memo = decision.memo;
                return decision.response;
            } else {
                return "I am thinking... (No text response provided)";
            }

        } catch (e) {
            console.error("Chat Error", e);
            return "Connection Error.";
        }
    }

    public async update(
        position: THREE.Vector3,
        nearbyEntities: NearbyEntity[],
        currentBehavior: string
    ): Promise<AgentDecision | null> {

        // 1. If Paused for Chat, Freeeze Physical Actions
        if (this.state.isPausedForChat) {
            return { action: 'WAIT', thought: " conversing with user..." };
        }

        // Rate Limiting Check
        if (this.state.isThinking) return null;

        // LOCAL MODE: Instant Heuristic Decision (0 Tokens)
        if (this.state.mode === 'LOCAL') {
            // Simple State Machine
            // 10% Chance to switch behavior every update (approx 1 sec)
            if (Math.random() < 0.1) {
                if (currentBehavior === 'IDLE' || currentBehavior === 'WAIT') {
                    // Start Wandering
                    return { action: 'WANDER', thought: "[LOCAL] Wandering..." };
                } else {
                    // Stop
                    return { action: 'WAIT', thought: "[LOCAL] Resting..." };
                }
            }
            return null; // Keep doing what you are doing
        }

        // LLM MODE: Check Rate Limiter
        if (!this.rateLimiter.tryConsume()) {
            return null;
        }

        this.state.isThinking = true;

        // Construct Context
        const context: AgentContext = {
            position: { x: position.x, y: position.y, z: position.z },
            nearbyEntities: nearbyEntities,
            currentBehavior: currentBehavior,
            // Pass memo if exists
            memo: this.state.memo
        };

        try {
            console.log(`[ClientBrain:${this.id}] Thinking... (Tokens left: ${this.rateLimiter.getTokensRemaining()})`);
            const responseText = await generateAgentThought(context);

            // Clean the response (remove markdown code blocks if present)
            const cleanText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

            let decision: AgentDecision;
            try {
                decision = JSON.parse(cleanText);
            } catch (jsonError) {
                console.warn(`[ClientBrain:${this.id}] Failed to parse JSON, raw text used.`, cleanText);
                decision = {
                    action: 'WAIT',
                    thought: cleanText
                };
            }

            this.state.thought = decision.thought || "Processing...";
            if (decision.memo) {
                this.state.memo = decision.memo;
                console.log(`[ClientBrain:${this.id}] New Memo:`, decision.memo);
            }

            this.state.lastThoughtTime = Date.now();
            this.state.isThinking = false;

            console.log(`[ClientBrain:${this.id}] Decided:`, decision);

            return decision;

        } catch (e) {
            console.error(`[ClientBrain:${this.id}] Failed to think:`, e);
            this.state.isThinking = false;
            return null;
        }
    }
}
