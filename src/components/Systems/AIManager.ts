import * as YUKA from 'yuka';
import * as THREE from 'three';

class AIManager {
    private static instance: AIManager;
    public entityManager: YUKA.EntityManager;
    public time: YUKA.Time;
    public vehicles: YUKA.Vehicle[] = [];
    private obstacles: YUKA.GameEntity[] = [];
    private capabilities: Map<string, any> = new Map(); // Store capability engines by ID

    private constructor() {
        this.entityManager = new YUKA.EntityManager();
        this.time = new YUKA.Time();
    }

    public static getInstance(): AIManager {
        if (!AIManager.instance) {
            AIManager.instance = new AIManager();
        }
        return AIManager.instance;
    }

    public registerCapabilityEngine(agentId: string, engine: any) {
        this.capabilities.set(agentId, engine);
    }

    public sendCommand(agentId: string, command: any) {
        const engine = this.capabilities.get(agentId);
        if (engine) {
            console.log(`[AIManager] Dispatching command to ${agentId}:`, command);
            engine.execute(command);
        } else {
            console.warn(`[AIManager] No capability engine found for ${agentId}`);
        }
    }

    public update(delta: number) {
        this.entityManager.update(delta);
    }

    public addEntity(entity: YUKA.GameEntity) {
        this.entityManager.add(entity);
        if (entity instanceof YUKA.Vehicle) {
            this.vehicles.push(entity);
        }
    }

    public removeEntity(entity: YUKA.GameEntity) {
        this.entityManager.remove(entity);
        if (entity instanceof YUKA.Vehicle) {
            this.vehicles = this.vehicles.filter(v => v !== entity);
        }
    }

    // Sync obstacles from GameStore if needed, or add manually
    public addObstacle(position: THREE.Vector3, radius: number) {
        const obstacle = new YUKA.GameEntity();
        obstacle.position.copy(position as unknown as YUKA.Vector3);
        obstacle.boundingRadius = radius;
        this.entityManager.add(obstacle);
        this.obstacles.push(obstacle);
        return obstacle;
    }
}

export default AIManager;
