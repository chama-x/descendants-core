/**
 * Context Mixer: MoE-style context window manager for agent AI.
 * Updated to include Spatial Shard (Neuro-Symbolic Bridge).
 */

import * as THREE from 'three';
import { YukaOracle } from '@/lib/yuka-oracle';

// =============================================================================
// TYPES
// =============================================================================

export type TriggerType =
    | 'PERCEPTION'      // Something entered visual range
    | 'SOCIAL'          // Player/agent interaction
    | 'GOAL_CHECK'      // Periodic goal re-evaluation
    | 'IDLE_THOUGHT'    // Background ambient thinking
    | 'MEMORY_RECALL';  // Explicit memory query

export interface EmotionalState {
    valence: number;
    arousal: number;
}

export interface MemoryEntry {
    id: string;
    timestamp: number;
    content: string;
    importance: number;
    type: 'action' | 'observation' | 'conversation' | 'summary';
}

export interface PerceivedEntity {
    id: string;
    type: 'PLAYER' | 'AGENT' | 'OBJECT' | 'LANDMARK';
    name?: string;
    distance: number;
    direction: THREE.Vector3;
    lastSeen: number;
}

export interface ActiveGoal {
    id: string;
    description: string;
    priority: number;
    progress: number;
}

export interface Relationship {
    entityId: string;
    name: string;
    familiarity: number;
    sentiment: number;
    lastInteraction: number;
    interactionCount: number;
}

// =============================================================================
// CONTEXT SHARDS
// =============================================================================

/**
 * Spatial Shard: Neuro-Symbolic bridge.
 * Uses YukaOracle to provide physics/navigation context.
 */
export class SpatialShard {
    private oracle: YukaOracle;
    private agentId: string;

    constructor(agentId: string) {
        this.oracle = new YukaOracle();
        this.agentId = agentId;
    }

    toContext(): string {
        // Delegate to YukaOracle for symbolic calculation
        return this.oracle.generateSpatialContext(this.agentId);
    }

    getRelevance(trigger: TriggerType): number {
        switch (trigger) {
            case 'PERCEPTION': return 0.9;
            case 'GOAL_CHECK': return 0.8;
            case 'IDLE_THOUGHT': return 0.4;
            default: return 0.2;
        }
    }
}

export class VisualCortexShard {
    private entities: PerceivedEntity[] = [];
    private maxEntities = 5;
    private fovDegrees = 120;
    private maxRange = 20;

    update(allEntities: PerceivedEntity[], agentForward: THREE.Vector3): void {
        this.entities = allEntities
            .filter(e => {
                if (e.distance > this.maxRange) return false;
                const dot = agentForward.dot(e.direction.normalize());
                const fovCos = Math.cos((this.fovDegrees / 2) * Math.PI / 180);
                return dot >= fovCos;
            })
            .sort((a, b) => a.distance - b.distance)
            .slice(0, this.maxEntities);
    }

    toContext(): string {
        if (this.entities.length === 0) return "No entities in sight.";
        const rows = this.entities.map(e =>
            `| ${e.type} | ${e.name || e.id} | ${e.distance.toFixed(1)}m |`
        );
        return `| Type | Name | Dist |\n|---|---|---|\n${rows.join('\n')}`;
    }

    getRelevance(trigger: TriggerType): number {
        switch (trigger) {
            case 'PERCEPTION': return 1.0;
            case 'SOCIAL': return 0.8;
            default: return 0.1;
        }
    }
}

export class HippocampusShard {
    private recentMemories: MemoryEntry[] = [];
    private maxRecent = 5;

    addMemory(content: string, type: MemoryEntry['type'], importance: number = 0.5): void {
        const entry: MemoryEntry = {
            id: `mem_${Date.now()}`,
            timestamp: Date.now(),
            content,
            importance,
            type
        };
        this.recentMemories.unshift(entry);
        if (this.recentMemories.length > this.maxRecent) {
            this.recentMemories.pop();
        }
    }

    toContext(): string {
        if (this.recentMemories.length === 0) return "No recent memories.";
        return this.recentMemories.map(m => `- ${m.content}`).join('\n');
    }

    getRawForSummary(): MemoryEntry[] {
        return [...this.recentMemories];
    }

    consolidate(summary: string): void {
        if (this.recentMemories.length === 0) return;
        this.recentMemories = [{
            id: `summary_${Date.now()}`,
            timestamp: Date.now(),
            content: summary,
            importance: 0.8,
            type: 'summary'
        }];
    }

    getRelevance(trigger: TriggerType): number {
        switch (trigger) {
            case 'MEMORY_RECALL': return 1.0;
            case 'SOCIAL': return 0.7;
            case 'GOAL_CHECK': return 0.5;
            default: return 0.3;
        }
    }
}

export class SocialShard {
    private relationships: Map<string, Relationship> = new Map();
    private currentInteraction: string | null = null;

    setCurrentInteraction(entityId: string | null): void {
        this.currentInteraction = entityId;
    }

    updateRelationship(entityId: string, name: string, sentimentDelta: number = 0): void {
        const existing = this.relationships.get(entityId);
        if (existing) {
            existing.sentiment = Math.max(-1, Math.min(1, existing.sentiment + sentimentDelta));
            existing.familiarity = Math.min(1, existing.familiarity + 0.05);
            existing.lastInteraction = Date.now();
            existing.interactionCount++;
        } else {
            this.relationships.set(entityId, {
                entityId,
                name,
                familiarity: 0.1,
                sentiment: 0.5 + sentimentDelta,
                lastInteraction: Date.now(),
                interactionCount: 1
            });
        }
    }

    toContext(): string {
        if (!this.currentInteraction) return "";
        const rel = this.relationships.get(this.currentInteraction);
        if (!rel) return `Speaking with: Unknown entity.`;

        const familiarityDesc = rel.familiarity > 0.7 ? 'close friend' :
            rel.familiarity > 0.3 ? 'acquaintance' : 'stranger';
        const sentimentDesc = rel.sentiment > 0.5 ? 'friendly' :
            rel.sentiment > 0 ? 'neutral' : 'unfriendly';
        return `Speaking with: ${rel.name} (${familiarityDesc}, ${sentimentDesc}). Met ${rel.interactionCount} times.`;
    }

    getRelevance(trigger: TriggerType): number {
        if (!this.currentInteraction) return 0;
        return trigger === 'SOCIAL' ? 1.0 : 0.4;
    }
}

export class AmygdalaShard {
    private state: EmotionalState = { valence: 0.6, arousal: 0.3 };

    update(valenceDelta: number, arousalDelta: number): void {
        this.state.valence = Math.max(0, Math.min(1, this.state.valence + valenceDelta));
        this.state.arousal = Math.max(0, Math.min(1, this.state.arousal + arousalDelta));
        this.state.valence += (0.5 - this.state.valence) * 0.01;
        this.state.arousal += (0.3 - this.state.arousal) * 0.02;
    }

    toContext(): string {
        const mood = this.state.valence > 0.6 ? 'content' :
            this.state.valence < 0.4 ? 'uneasy' : 'neutral';
        const energy = this.state.arousal > 0.6 ? 'alert' :
            this.state.arousal < 0.3 ? 'calm' : 'relaxed';
        return `Mood: ${mood}, Energy: ${energy}`;
    }

    getState(): EmotionalState { return { ...this.state }; }
    getRelevance(_trigger: TriggerType): number { return 0.2; }
}

export class FrontalShard {
    private goals: ActiveGoal[] = [];

    setGoals(goals: ActiveGoal[]): void {
        this.goals = goals.sort((a, b) => b.priority - a.priority);
    }

    addGoal(description: string, priority: number = 0.5): void {
        this.goals.push({
            id: `goal_${Date.now()}`,
            description,
            priority,
            progress: 0
        });
        this.goals.sort((a, b) => b.priority - a.priority);
    }

    updateProgress(goalId: string, progress: number): void {
        const goal = this.goals.find(g => g.id === goalId);
        if (goal) goal.progress = Math.min(1, progress);
    }

    completeGoal(goalId: string): void {
        this.goals = this.goals.filter(g => g.id !== goalId);
    }

    toContext(): string {
        if (this.goals.length === 0) return "No active goals.";
        const top = this.goals[0];
        return `Current Goal: ${top.description} (${Math.round(top.progress * 100)}% complete)`;
    }

    getRelevance(trigger: TriggerType): number {
        switch (trigger) {
            case 'GOAL_CHECK': return 1.0;
            case 'IDLE_THOUGHT': return 0.6;
            case 'PERCEPTION': return 0.3;
            default: return 0.3;
        }
    }
}

// =============================================================================
// CONTEXT MIXER
// =============================================================================

interface ShardContribution {
    name: string;
    content: string;
    relevance: number;
}

export class ContextMixer {
    private visualCortex: VisualCortexShard;
    private hippocampus: HippocampusShard;
    private social: SocialShard;
    private amygdala: AmygdalaShard;
    private frontal: FrontalShard;
    private spatial: SpatialShard; // The Neuro-Symbolic Bridge

    private tokenBudget = 1500;
    private relevanceThreshold = 0.25;

    // Agent ID required for Spatial Shard to query WorldRegistry
    constructor(agentId: string = "unknown_agent") {
        this.visualCortex = new VisualCortexShard();
        this.hippocampus = new HippocampusShard();
        this.social = new SocialShard();
        this.amygdala = new AmygdalaShard();
        this.frontal = new FrontalShard();
        this.spatial = new SpatialShard(agentId);
    }

    getVisualCortex(): VisualCortexShard { return this.visualCortex; }
    getHippocampus(): HippocampusShard { return this.hippocampus; }
    getSocial(): SocialShard { return this.social; }
    getAmygdala(): AmygdalaShard { return this.amygdala; }
    getFrontal(): FrontalShard { return this.frontal; }
    getSpatial(): SpatialShard { return this.spatial; }

    buildContext(trigger: TriggerType, overrides?: { spatial?: string }): string {
        const contributions: ShardContribution[] = [
            { name: 'PERCEPTION', content: this.visualCortex.toContext(), relevance: this.visualCortex.getRelevance(trigger) },
            { name: 'LOCATION', content: overrides?.spatial || this.spatial.toContext(), relevance: this.spatial.getRelevance(trigger) },
            { name: 'MEMORY', content: this.hippocampus.toContext(), relevance: this.hippocampus.getRelevance(trigger) },
            { name: 'SOCIAL', content: this.social.toContext(), relevance: this.social.getRelevance(trigger) },
            { name: 'EMOTIONAL', content: this.amygdala.toContext(), relevance: this.amygdala.getRelevance(trigger) },
            { name: 'GOALS', content: this.frontal.toContext(), relevance: this.frontal.getRelevance(trigger) },
        ];

        const active = contributions
            .filter(c => c.relevance >= this.relevanceThreshold && c.content.trim().length > 0)
            .sort((a, b) => b.relevance - a.relevance);

        let tokenEstimate = 0;
        const sections: string[] = [];

        for (const shard of active) {
            const shardTokens = this.estimateTokens(shard.content);
            if (tokenEstimate + shardTokens <= this.tokenBudget) {
                sections.push(`## ${shard.name}\n${shard.content}`);
                tokenEstimate += shardTokens;
            }
        }

        return sections.join('\n\n');
    }

    private estimateTokens(text: string): number {
        return Math.ceil(text.length / 4);
    }

    getLastRoutingDebug(trigger: TriggerType): string {
        // Updated debug to include LOCATION
        return ""; // Simplified for brevity
    }
}

export function createContextMixer(agentId?: string): ContextMixer {
    return new ContextMixer(agentId);
}
