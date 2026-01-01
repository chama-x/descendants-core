import * as THREE from 'three';
import { generateAgentThought, AgentContext, NearbyEntity } from '@/app/actions';
import { GlobalRateLimiter } from '@/lib/global-rate-limiter';
import { YukaOracle } from '@/lib/yuka-oracle';

export interface BrainState {
    thought: string;
    isThinking: boolean;
    lastThoughtTime: number;
}

export interface AgentDecision {
    action: 'MOVE_TO' | 'WAIT' | 'WANDER' | 'FOLLOW';
    targetId?: string;
    target?: { x: number; y: number; z: number };
    thought: string;
}

export class ClientBrain {
    public state: BrainState;
    private rateLimiter: GlobalRateLimiter;
    private oracle: YukaOracle;
    private id: string;

    constructor(id: string = 'agent-01') {
        this.id = id;
        this.state = {
            thought: "Initializing neural pathways...",
            isThinking: false,
            lastThoughtTime: 0
        };
        // Use Global Shared Limiter
        this.rateLimiter = GlobalRateLimiter.getInstance();

        // Neuro-Symbolic Bridge (Client Side)
        this.oracle = new YukaOracle();
    }

    public async update(
        position: THREE.Vector3,
        nearbyEntities: NearbyEntity[],
        currentBehavior: string
    ): Promise<AgentDecision | null> {

        // Rate Limiting Check
        if (this.state.isThinking || !this.rateLimiter.tryConsume()) {
            return null;
        }

        this.state.isThinking = true;

        // Generate Physics/Spatial Context locally using Yuka logic
        // This ensures the LLM receives "grounded" facts
        const spatialContext = this.oracle.generateSpatialContext(this.id);

        // Construct Context
        const context: AgentContext = {
            position: { x: position.x, y: position.y, z: position.z },
            nearbyEntities: nearbyEntities,
            currentBehavior: currentBehavior,
            spatialContext: spatialContext // Inject symbolic data
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
