/**
 * Global Rate Limiter
 * Shared across all agents to ensure we verify strict API limits.
 */
export class GlobalRateLimiter {
    private static instance: GlobalRateLimiter;
    private tokens: number;
    private maxTokens: number;
    private refillRate: number; // Tokens per second
    private lastRefill: number;

    private constructor(maxTokens: number, refillPeriodSeconds: number) {
        this.maxTokens = maxTokens;
        this.tokens = maxTokens;
        this.refillRate = maxTokens / refillPeriodSeconds;
        this.lastRefill = Date.now();
    }

    public static getInstance(): GlobalRateLimiter {
        if (!GlobalRateLimiter.instance) {
            // Groq Free Tier: 30 RPM. 
            // We set 25 RPM safety limit shared across ALL agents.
            GlobalRateLimiter.instance = new GlobalRateLimiter(25, 60);
        }
        return GlobalRateLimiter.instance;
    }

    public tryConsume(cost: number = 1): boolean {
        this.refill();
        if (this.tokens >= cost) {
            this.tokens -= cost;
            return true;
        }
        return false;
    }

    public getTokensRemaining(): number {
        this.refill();
        return Math.floor(this.tokens);
    }

    private refill() {
        const now = Date.now();
        const elapsed = (now - this.lastRefill) / 1000;
        if (elapsed > 0) {
            this.tokens = Math.min(this.maxTokens, this.tokens + (elapsed * this.refillRate));
            this.lastRefill = now;
        }
    }
}
