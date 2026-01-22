/**
 * ConditionalEffectStack
 *
 * Extended effect stack with support for:
 * - Effect dependencies (run effect A only if effect B is enabled)
 * - Conditional execution (run effect only when condition is met)
 * - Effect groups for batch enable/disable
 */

/// <reference types="@webgpu/types" />

import type { Effect, EffectConfig } from './EffectStack';
import { EffectStack } from './EffectStack';
import type { ScreenPass } from '@scene/renderer';

/** Condition function type */
export type EffectCondition = () => boolean;

/** Dependency configuration */
export interface EffectDependency {
  /** ID of the effect this depends on */
  dependsOn: string;
  /** Whether the dependency must be enabled (default: true) */
  mustBeEnabled?: boolean;
}

/** Extended effect configuration with conditions */
export interface ConditionalEffectConfig extends EffectConfig {
  /** Condition function - effect only runs when this returns true */
  condition?: EffectCondition;
  /** Dependencies - effects that must be enabled/present */
  dependencies?: EffectDependency[];
  /** Group this effect belongs to */
  group?: string;
  /** Priority for execution order (higher = later, default: 0) */
  priority?: number;
}

/** Effect with conditional metadata */
interface ConditionalEffect {
  effect: Effect;
  config: ConditionalEffectConfig;
}

/**
 * ConditionalEffectStack - Effect management with conditions and dependencies
 * 
 * @example
 * ```typescript
 * const stack = new ConditionalEffectStack(screenPass);
 * 
 * // Add effect with condition
 * stack.add({
 *   type: 'motion_blur',
 *   condition: () => cameraVelocity > 0.1,
 * });
 * 
 * // Add effect with dependency
 * stack.add({
 *   type: 'chromatic_aberration',
 *   dependencies: [{ dependsOn: 'motion_blur_1', mustBeEnabled: true }],
 * });
 * 
 * // Add effects to a group
 * stack.add({ type: 'film_grain', group: 'cinematic' });
 * stack.add({ type: 'vignette', group: 'cinematic' });
 * 
 * // Enable/disable entire group
 * stack.enableGroup('cinematic');
 * stack.disableGroup('cinematic');
 * ```
 */
export class ConditionalEffectStack extends EffectStack {
  private conditionalEffects: Map<string, ConditionalEffect> = new Map();
  private groups: Map<string, Set<string>> = new Map();

  constructor(screenPass: ScreenPass) {
    super(screenPass);
  }

  /**
   * Add an effect with optional conditions and dependencies
   */
  addConditional(config: ConditionalEffectConfig): Effect | null {
    const effect = super.add(config);
    if (!effect) return null;

    // Store conditional metadata
    this.conditionalEffects.set(effect.id, {
      effect,
      config,
    });

    // Add to group if specified
    if (config.group) {
      let group = this.groups.get(config.group);
      if (!group) {
        group = new Set();
        this.groups.set(config.group, group);
      }
      group.add(effect.id);
    }

    return effect;
  }

  /**
   * Override remove to clean up conditional metadata
   */
  override remove(id: string): boolean {
    const conditionalEffect = this.conditionalEffects.get(id);
    if (conditionalEffect) {
      // Remove from group
      if (conditionalEffect.config.group) {
        const group = this.groups.get(conditionalEffect.config.group);
        if (group) {
          group.delete(id);
          if (group.size === 0) {
            this.groups.delete(conditionalEffect.config.group);
          }
        }
      }
      this.conditionalEffects.delete(id);
    }

    return super.remove(id);
  }

  /**
   * Get all effects that should actually execute
   * (enabled, conditions met, dependencies satisfied)
   */
  override getEnabled(): Effect[] {
    const allEffects = super.getAll();
    const enabledEffects: Effect[] = [];

    for (const effect of allEffects) {
      if (this.shouldExecute(effect.id)) {
        enabledEffects.push(effect);
      }
    }

    // Sort by priority if configured
    return enabledEffects.sort((a, b) => {
      const priorityA = this.conditionalEffects.get(a.id)?.config.priority ?? 0;
      const priorityB = this.conditionalEffects.get(b.id)?.config.priority ?? 0;
      return priorityA - priorityB;
    });
  }

  /**
   * Check if an effect should execute
   */
  shouldExecute(id: string): boolean {
    const effect = this.get(id);
    if (!effect || !effect.enabled) return false;

    const conditionalEffect = this.conditionalEffects.get(id);
    if (!conditionalEffect) return true; // No conditions

    // Check condition function
    if (conditionalEffect.config.condition) {
      if (!conditionalEffect.config.condition()) {
        return false;
      }
    }

    // Check dependencies
    if (conditionalEffect.config.dependencies) {
      for (const dep of conditionalEffect.config.dependencies) {
        const depEffect = this.get(dep.dependsOn);
        if (!depEffect) {
          return false; // Dependency not found
        }
        if (dep.mustBeEnabled !== false && !depEffect.enabled) {
          return false; // Dependency not enabled
        }
      }
    }

    return true;
  }

  /**
   * Enable all effects in a group
   */
  enableGroup(groupName: string): void {
    const group = this.groups.get(groupName);
    if (!group) return;

    for (const id of group) {
      this.enable(id);
    }
  }

  /**
   * Disable all effects in a group
   */
  disableGroup(groupName: string): void {
    const group = this.groups.get(groupName);
    if (!group) return;

    for (const id of group) {
      this.disable(id);
    }
  }

  /**
   * Toggle all effects in a group
   */
  toggleGroup(groupName: string): void {
    const group = this.groups.get(groupName);
    if (!group) return;

    // Check if any in group are enabled
    let anyEnabled = false;
    for (const id of group) {
      const effect = this.get(id);
      if (effect?.enabled) {
        anyEnabled = true;
        break;
      }
    }

    // Toggle opposite
    if (anyEnabled) {
      this.disableGroup(groupName);
    } else {
      this.enableGroup(groupName);
    }
  }

  /**
   * Get all effect IDs in a group
   */
  getGroup(groupName: string): string[] {
    const group = this.groups.get(groupName);
    return group ? Array.from(group) : [];
  }

  /**
   * Get all group names
   */
  getGroupNames(): string[] {
    return Array.from(this.groups.keys());
  }

  /**
   * Update condition for an effect
   */
  setCondition(id: string, condition: EffectCondition | undefined): boolean {
    const conditionalEffect = this.conditionalEffects.get(id);
    if (!conditionalEffect) return false;

    conditionalEffect.config.condition = condition;
    return true;
  }

  /**
   * Update dependencies for an effect
   */
  setDependencies(id: string, dependencies: EffectDependency[] | undefined): boolean {
    const conditionalEffect = this.conditionalEffects.get(id);
    if (!conditionalEffect) return false;

    conditionalEffect.config.dependencies = dependencies;
    return true;
  }

  /**
   * Move effect to a different group
   */
  setGroup(id: string, groupName: string | undefined): boolean {
    const conditionalEffect = this.conditionalEffects.get(id);
    if (!conditionalEffect) return false;

    // Remove from old group
    if (conditionalEffect.config.group) {
      const oldGroup = this.groups.get(conditionalEffect.config.group);
      if (oldGroup) {
        oldGroup.delete(id);
        if (oldGroup.size === 0) {
          this.groups.delete(conditionalEffect.config.group);
        }
      }
    }

    // Add to new group
    if (groupName) {
      let group = this.groups.get(groupName);
      if (!group) {
        group = new Set();
        this.groups.set(groupName, group);
      }
      group.add(id);
    }

    conditionalEffect.config.group = groupName;
    return true;
  }

  /**
   * Set priority for an effect
   */
  setPriority(id: string, priority: number): boolean {
    const conditionalEffect = this.conditionalEffects.get(id);
    if (!conditionalEffect) return false;

    conditionalEffect.config.priority = priority;
    return true;
  }

  /**
   * Clear all conditional metadata
   */
  override clear(): void {
    this.conditionalEffects.clear();
    this.groups.clear();
    super.clear();
  }

  /**
   * Destroy and clean up
   */
  override destroy(): void {
    this.conditionalEffects.clear();
    this.groups.clear();
    super.destroy();
  }
}

/**
 * Create a conditional effect stack
 */
export function createConditionalEffectStack(screenPass: ScreenPass): ConditionalEffectStack {
  return new ConditionalEffectStack(screenPass);
}
