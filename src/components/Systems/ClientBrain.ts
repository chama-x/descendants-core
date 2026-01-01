import * as THREE from 'three';
import { generateAgentThought, AgentContext, NearbyEntity } from '@/app/actions';
import { GlobalRateLimiter } from '@/lib/global-rate-limiter';
import { YukaOracle } from '@/lib/yuka-oracle';
import { CapabilityCommand, CapabilityType, Posture } from '@/lib/capability-engine';

export interface BrainState {
    thought: string;
    isThinking: boolean;
    lastThoughtTime: number;
}
// Using CapabilityCommand directly from engine


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
    ): Promise<CapabilityCommand | null> {

        // Rate Limiting Check
        if (this.state.isThinking || !this.rateLimiter.tryConsume()) {
            return null;
        }

        this.state.isThinking = true;

        // Generate Physics/Spatial Context
        const spatialContext = this.oracle.generateSpatialContext(this.id);

        // Construct Context
        const context: AgentContext = {
            position: { x: position.x, y: position.y, z: position.z },
            nearbyEntities: nearbyEntities,
            currentBehavior: currentBehavior,
            spatialContext: spatialContext
        };

        try {
            console.log(`[ClientBrain:${this.id}] Thinking... (Tokens left: ${this.rateLimiter.getTokensRemaining()})`);

            // Add instructions for new Capability format in prompt overrides or assume agent-core is smart enough?
            // "agent-core" is using Llama4 which adheres to schemas well, but we should probably hint it.
            // Actually, processAgentThought builds the prompt. We rely on IT inferring from 'spatialContext' and previous examples.
            // Ideally, we'd update agent-core instructions, but let's trust the model for now or simple "Try to output JSON matching CapabilityCommand".

            const responseText = await generateAgentThought(context);

            const cleanText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

            let command: CapabilityCommand;
            try {
                // We expect the LLM to output a CapabilityCommand structure now.
                // e.g. { type: 'NAVIGATE_TO_ANCHOR', params: { target: 'Desk' }, posture: 'WALK' }
                const parsed = JSON.parse(cleanText);

                // Mapper for legacy "Decision" structure if model is still trained on old way:
                if (parsed.action) {
                    // Legacy Adapter
                    console.log("[ClientBrain] Adapting legacy output:", parsed);
                    command = this.adaptLegacyDecision(parsed);
                } else {
                    command = parsed;
                }

                // Store thought separately if present (Capabilities don't always have 'thought')
                if ('thought' in parsed) {
                    this.state.thought = parsed.thought;
                }

            } catch (jsonError) {
                console.warn(`[ClientBrain:${this.id}] JSON Parse Error:`, cleanText);
                command = {
                    type: 'IDLE',
                    posture: 'ALERT'
                };
                this.state.thought = "Brain freeze (Invalid JSON)";
            }

            this.state.lastThoughtTime = Date.now();
            this.state.isThinking = false;
            return command;

        } catch (e) {
            console.error(`[ClientBrain:${this.id}] Error:`, e);
            this.state.isThinking = false;
            return null;
        }
    }

    private adaptLegacyDecision(legacy: any): CapabilityCommand {
        // Map old 'MOVE_TO' etc to new Capabilities
        let type: CapabilityType = 'IDLE';
        let params = {};

        switch (legacy.action) {
            case 'MOVE_TO':
            case 'FOLLOW':
                if (legacy.targetId) {
                    type = 'FOLLOW_ENTITY';
                    params = { target: legacy.targetId };
                } else if (legacy.target) {
                    type = 'NAVIGATE_TO_COORD';
                    params = { x: legacy.target.x, y: legacy.target.y, z: legacy.target.z };
                }
                break;
            case 'WAIT':
                type = 'HOLD_POSITION';
                break;
            case 'WANDER':
                // We deprecated Wander. Map to IDLE or a minimal patrol?
                // Map to IDLE to stop randomness.
                type = 'IDLE';
                break;
        }
        return { type, params, posture: 'WALK' };
    }
}
