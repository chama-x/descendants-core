declare module 'yuka' {
    export class EntityManager {
        update(delta: number): void;
        add(entity: GameEntity): void;
        remove(entity: GameEntity): void;
    }
    export class Time {
        update(): number;
        getDelta(): number;
    }
    export class GameEntity {
        position: Vector3;
        rotation: Quaternion;
        boundingRadius: number;
        velocity: Vector3;
    }
    export class Vehicle extends GameEntity {
        maxSpeed: number;
        maxForce: number;
        mass: number;
        steering: SteeringManager;
        setRenderComponent(component: unknown, callback: (entity: GameEntity, renderComponent: unknown) => void): void;
    }
    export class SteeringManager {
        behaviors: SteeringBehavior[];
        add(behavior: SteeringBehavior): void;
    }
    export class SteeringBehavior {
        active: boolean;
        weight: number;
    }
    export class ObstacleAvoidanceBehavior extends SteeringBehavior {
        constructor(obstacles: GameEntity[]);
    }
    export class SeparationBehavior extends SteeringBehavior {
        constructor(entities: GameEntity[]);
        weight: number;
    }
    export class WanderBehavior extends SteeringBehavior { }
    export class SeekBehavior extends SteeringBehavior {
        constructor(target: Vector3);
        target: Vector3;
    }
    export class Vector3 {
        x: number;
        y: number;
        z: number;
        constructor(x?: number, y?: number, z?: number);
        copy(v: Vector3): this;
        clone(): Vector3;
        add(v: Vector3): this;
        sub(v: Vector3): this;
        multiplyScalar(s: number): this;
        normalize(): this;
        distanceTo(v: Vector3): number;
        squaredDistanceTo(v: Vector3): number;
        length(): number;
        set(x: number, y: number, z: number): this;
        fromArray(array: number[], offset?: number): this;
        toArray(array: number[], offset?: number): number[];
    }
    export class Quaternion {
        copy(q: Quaternion): this;
        setFromEuler(x: number, y: number, z: number): this;
        fromEuler(x: number, y: number, z: number): this;
        slerp(q: Quaternion, t: number): this;
        multiply(q: Quaternion): this;
        rotateByAngularVelocity(omega: Vector3, dt: number): this;
    }
}
