/**
 * Context Mixer: MoE-style context window manager for agent AI.
 * 
 * The Context Mixer dynamically assembles optimized context windows
 * by routing through "Expert Shards" based on relevance scoring.
 */

import * as THREE from 'three';

// =============================================================================
// TYPES
// =============================================================================

/** Trigger types that activate specific context shards */
export type TriggerType =
    | 'PERCEPTION'      // Something entered visual range
    | 'SOCIAL'          // Player/agent interaction
    | 'GOAL_CHECK'      // Periodic goal re-evaluation
    | 'IDLE_THOUGHT'    // Background ambient thinking
    | 'MEMORY_RECALL';  // Explicit memory query

/** Emotional state compressed to scalars (saves tokens) */
export interface EmotionalState {
    valence: number;    // 0.0 (negative) to 1.0 (positive)
    arousal: number;    // 0.0 (calm) to 1.0 (excited)
}

/** A memory entry with embedding-ready structure */
export interface MemoryEntry {
    id: string;
    timestamp: number;
    content: string;
    importance: number; // 0.0 to 1.0
    type: 'action' | 'observation' | 'conversation' | 'summary';
}

/** Entity seen by the agent */
export interface PerceivedEntity {
    id: string;
    type: 'PLAYER' | 'AGENT' | 'OBJECT' | 'LANDMARK';
    name?: string;
    distance: number;
    direction: THREE.Vector3;
    lastSeen: number;
}

/** Current goal with priority */
export interface ActiveGoal {
    id: string;
    description: string;
    priority: number;   // Higher = more important
    progress: number;   // 0.0 to 1.0
}

/** Social relationship data */
export interface Relationship {
    entityId: string;
    name: string;
    familiarity: number;    // 0.0 (stranger) to 1.0 (close friend)
    sentiment: number;      // -1.0 (hostile) to 1.0 (friendly)
    lastInteraction: number;
    interactionCount: number;
}

// =============================================================================
// CONTEXT SHARDS (The "Experts")
// =============================================================================

/**
 * Visual Cortex Shard: What the agent currently perceives.
 */
export class VisualCortexShard {
    private entities: PerceivedEntity[] = [];
    private maxEntities = 5;
    private fovDegrees = 120;
    private maxRange = 20;

    update(allEntities: PerceivedEntity[], agentForward: THREE.Vector3): void {
        // Filter by FOV and range, sort by distance
        this.entities = allEntities
            .filter(e => {
                if (e.distance > this.maxRange) return false;
                // FOV check (simplified - compare dot product)
                const dot = agentForward.dot(e.direction.normalize());
                const fovCos = Math.cos((this.fovDegrees / 2) * Math.PI / 180);
                return dot >= fovCos;
            })
            .sort((a, b) => a.distance - b.distance)
            .slice(0, this.maxEntities);
    }

    /** Get markdown table of visible entities (compressed format) */
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
            case 'GOAL_CHECK': return 0.3;
            case 'IDLE_THOUGHT': return 0.2;
            default: return 0.1;
        }
    }
}

/**
 * Hippocampus Shard: Short-term and recalled memories.
 */
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

        // Keep only most recent
        if (this.recentMemories.length > this.maxRecent) {
            this.recentMemories.pop();
        }
    }

    /** Get memories as compact list */
    toContext(): string {
        if (this.recentMemories.length === 0) return "No recent memories.";

        return this.recentMemories
            .map(m => `- ${m.content}`)
            .join('\n');
    }

    /** Get raw memories for summarization */
    getRawForSummary(): MemoryEntry[] {
        return [...this.recentMemories];
    }

    /** Replace memories with a summary (called by Dreamer) */
    consolidate(summary: string): void {
        if (this.recentMemories.length === 0) return;

        // Clear raw memories, add summary
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

/**
 * Social Shard: Relationship and interaction data.
 */
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

    /** Get context only for current interaction target */
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
        switch (trigger) {
            case 'SOCIAL': return 1.0;
            case 'PERCEPTION': return 0.4;
            default: return 0.1;
        }
    }
}

/**
 * Amygdala Shard: Emotional state (compressed to scalars).
 */
export class AmygdalaShard {
    private state: EmotionalState = { valence: 0.6, arousal: 0.3 };

    update(valenceDelta: number, arousalDelta: number): void {
        this.state.valence = Math.max(0, Math.min(1, this.state.valence + valenceDelta));
        this.state.arousal = Math.max(0, Math.min(1, this.state.arousal + arousalDelta));

        // Natural decay toward neutral
        this.state.valence += (0.5 - this.state.valence) * 0.01;
        this.state.arousal += (0.3 - this.state.arousal) * 0.02;
    }

    /** Extremely compressed output */
    toContext(): string {
        const mood = this.state.valence > 0.6 ? 'content' :
            this.state.valence < 0.4 ? 'uneasy' : 'neutral';
        const energy = this.state.arousal > 0.6 ? 'alert' :
            this.state.arousal < 0.3 ? 'calm' : 'relaxed';
        return `Mood: ${mood}, Energy: ${energy}`;
    }

    getState(): EmotionalState {
        return { ...this.state };
    }

    getRelevance(_trigger: TriggerType): number {
        // Always include mood, but low weight
        return 0.2;
    }
}

/**
 * Frontal Shard: Goals and directives.
 */
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

    /** Only return top goal to keep context focused */
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
            case 'SOCIAL': return 0.2;  // Suppress during conversation
            default: return 0.3;
        }
    }
}

// =============================================================================
// CONTEXT MIXER (The Router)
// =============================================================================

interface ShardContribution {
    name: string;
    content: string;
    relevance: number;
}

/**
 * The Context Mixer assembles optimized prompts from shards.
 */
export class ContextMixer {
    private visualCortex: VisualCortexShard;
    private hippocampus: HippocampusShard;
    private social: SocialShard;
    private amygdala: AmygdalaShard;
    private frontal: FrontalShard;

    /** Token budget for context (approximate) */
    private tokenBudget = 1500;
    private relevanceThreshold = 0.25;

    constructor() {
        this.visualCortex = new VisualCortexShard();
        this.hippocampus = new HippocampusShard();
        this.social = new SocialShard();
        this.amygdala = new AmygdalaShard();
        this.frontal = new FrontalShard();
    }

    // Expose shards for external updates
    getVisualCortex(): VisualCortexShard { return this.visualCortex; }
    getHippocampus(): HippocampusShard { return this.hippocampus; }
    getSocial(): SocialShard { return this.social; }
    getAmygdala(): AmygdalaShard { return this.amygdala; }
    getFrontal(): FrontalShard { return this.frontal; }

    /**
     * Build an optimized context string for the given trigger.
     * Routes through shards based on relevance scoring.
     */
    buildContext(trigger: TriggerType): string {
        const contributions: ShardContribution[] = [
            { name: 'PERCEPTION', content: this.visualCortex.toContext(), relevance: this.visualCortex.getRelevance(trigger) },
            { name: 'MEMORY', content: this.hippocampus.toContext(), relevance: this.hippocampus.getRelevance(trigger) },
            { name: 'SOCIAL', content: this.social.toContext(), relevance: this.social.getRelevance(trigger) },
            { name: 'EMOTIONAL', content: this.amygdala.toContext(), relevance: this.amygdala.getRelevance(trigger) },
            { name: 'GOALS', content: this.frontal.toContext(), relevance: this.frontal.getRelevance(trigger) },
        ];

        // Filter by relevance threshold and non-empty content
        const active = contributions
            .filter(c => c.relevance >= this.relevanceThreshold && c.content.trim().length > 0)
            .sort((a, b) => b.relevance - a.relevance);

        // Build context with budget awareness
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

    /** Rough token estimation (4 chars ≈ 1 token) */
    private estimateTokens(text: string): number {
        return Math.ceil(text.length / 4);
    }

    /** Get summary of what was included (for debugging) */
    getLastRoutingDebug(trigger: TriggerType): string {
        const contributions = [
            { name: 'PERCEPTION', relevance: this.visualCortex.getRelevance(trigger) },
            { name: 'MEMORY', relevance: this.hippocampus.getRelevance(trigger) },
            { name: 'SOCIAL', relevance: this.social.getRelevance(trigger) },
            { name: 'EMOTIONAL', relevance: this.amygdala.getRelevance(trigger) },
            { name: 'GOALS', relevance: this.frontal.getRelevance(trigger) },
        ];

        return contributions
            .map(c => `${c.name}: ${c.relevance >= this.relevanceThreshold ? '✓' : '✗'} (${c.relevance.toFixed(2)})`)
            .join(' | ');
    }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

/** Factory to create a new ContextMixer per agent */
export function createContextMixer(): ContextMixer {
    return new ContextMixer();
}
