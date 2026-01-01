import * as THREE from 'three';
import { generateAgentThought, AgentContext, NearbyEntity } from '@/app/actions';
import { GlobalRateLimiter } from '@/lib/global-rate-limiter';
import { YukaOracle } from '@/lib/yuka-oracle';
import { CapabilityCommand, CapabilityType, Posture } from '@/lib/capability-engine';

export interface BrainState {
    thought: string;
    isThinking: boolean;
    lastThoughtTime: number;
    // Chat State
    isPausedForChat: boolean;
    chatHistory: { role: 'user' | 'agent', text: string }[];
    memo: string | null;
}
// Using CapabilityCommand directly from engine


export class ClientBrain {
    public state: BrainState;
    private rateLimiter: GlobalRateLimiter;
    private oracle: YukaOracle;
    private id: string;

    // Registry for global access (e.g. from UI)
    private static registry: Map<string, ClientBrain> = new Map();

    public static getBrain(id: string): ClientBrain | undefined {
        return this.registry.get(id);
    }

    constructor(id: string = 'agent-01') {
        this.id = id;
        ClientBrain.registry.set(id, this); // Register self
        this.state = {
            thought: "Initializing neural pathways...",
            isThinking: false,
            lastThoughtTime: 0,
            isPausedForChat: false,
            chatHistory: [],
            memo: null
        };
        // Use Global Shared Limiter
        this.rateLimiter = GlobalRateLimiter.getInstance();

        // Neuro-Symbolic Bridge (Client Side)
        this.oracle = new YukaOracle();
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
        currentBehavior: string,
        allowedCommands: string[] = [],
        llmEnabled: boolean = true
    ): Promise<CapabilityCommand | null> {

        // 1. If Paused for Chat, Freeeze Physical Actions
        if (this.state.isPausedForChat) {
            return { action: 'WAIT', thought: " conversing with user..." };
        }

        // Rate Limiting Check
        if (this.state.isThinking || !this.rateLimiter.tryConsume()) {
            return null;
        }

        // 1. Check LLM Toggle
        if (!llmEnabled) {
            // Brain is "off" for high-level thought, return basic keep-alive or null
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

            // 2. Filter Command
            if (command && allowedCommands.length > 0 && !allowedCommands.includes(command.type)) {
                console.log(`[ClientBrain] Command filtered by settings: ${command.type}`);
                return { type: 'IDLE', posture: 'WALK' };
            }

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
