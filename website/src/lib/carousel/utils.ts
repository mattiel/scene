/**
 * Carousel utility functions and hooks
 */

import { useState, useEffect } from 'react';
import { type CarouselConfig, BASE_CONFIG } from './data';

// ============================================
// Position Calculations
// ============================================

/** Calculate snap points for each item index */
export function calculateSnapPoints(itemCount: number, spacing: number): number[] {
  const midIndex = (itemCount - 1) / 2;
  return Array.from({ length: itemCount }, (_, i) => -(i - midIndex) * spacing);
}

/** Calculate scroll bounds for the carousel */
export function calculateBounds(
  itemCount: number,
  spacing: number
): { min: number; max: number } {
  const midIndex = (itemCount - 1) / 2;
  return {
    min: -(itemCount - 1 - midIndex) * spacing,
    max: midIndex * spacing,
  };
}

/** Find the index of the card closest to center */
export function findCenterIndex(
  offset: number,
  itemCount: number,
  spacing: number
): number {
  const midIndex = (itemCount - 1) / 2;
  let closest = 0;
  let closestDist = Infinity;

  for (let i = 0; i < itemCount; i++) {
    const x = (i - midIndex) * spacing + offset;
    const dist = Math.abs(x);
    if (dist < closestDist) {
      closestDist = dist;
      closest = i;
    }
  }
  return closest;
}

// ============================================
// Math Utilities
// ============================================

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ============================================
// Responsive Configuration
// ============================================

function calculateConfig(): CarouselConfig {
  if (typeof window === 'undefined') return BASE_CONFIG;

  const width = window.innerWidth;
  const height = window.innerHeight;

  // Mobile: < 640px
  if (width < 640) {
    const cardWidth = Math.min(width - 48, 260); // 24px padding each side
    const cardHeight = Math.min(height * 0.4, cardWidth * 1.4); // Reduced from 0.5 to 0.4
    
    // Calculate max scale that fits BOTH dimensions (height is often the constraint on mobile)
    const marginX = 40; // 20px each side
    const marginY = 160; // Account for browser chrome, notch, header/footer UI
    const maxScaleByWidth = (width - marginX) / cardWidth;
    const maxScaleByHeight = (height - marginY) / cardHeight;
    const maxExpandScale = Math.min(maxScaleByWidth, maxScaleByHeight);
    // Let viewport calculation drive the scale - only floor it, don't cap it high
    const expandScale = Math.max(0.1, maxExpandScale - 1);

    return {
      cardSpacing: cardWidth + 20,
      cardWidth,
      cardHeight,
      cameraZ: 800,
      bendScale: 2.0,
      bendClamp: 0.8,
      expandScale,
      segments: 16, // Reduced for mobile performance
    };
  }

  // Tablet: 640-1024px
  if (width < 1024) {
    const cardWidth = Math.min(280, width * 0.35);
    const cardHeight = cardWidth * 1.4;
    
    // Calculate max scale that fits BOTH dimensions
    const marginX = 48; // 24px each side
    const marginY = 100; // Account for UI elements
    const maxScaleByWidth = (width - marginX) / cardWidth;
    const maxScaleByHeight = (height - marginY) / cardHeight;
    const maxExpandScale = Math.min(maxScaleByWidth, maxScaleByHeight);
    const expandScale = Math.max(0.2, Math.min(0.5, maxExpandScale - 1));

    return {
      cardSpacing: cardWidth + 30,
      cardWidth,
      cardHeight,
      cameraZ: 1000,
      bendScale: 2.5,
      bendClamp: 1.0,
      expandScale,
      segments: 24, // Balanced for tablet
    };
  }

  // Desktop: > 1024px
  // Still need to calculate expandScale based on viewport to prevent overflow
  const cardWidth = BASE_CONFIG.cardWidth;
  const cardHeight = BASE_CONFIG.cardHeight;
  
  // Calculate max scale that fits in viewport (with margin)
  const marginX = 80; // 40px each side
  const marginY = 120; // Account for header/footer UI
  const maxScaleByWidth = (width - marginX) / cardWidth;
  const maxScaleByHeight = (height - marginY) / cardHeight;
  const maxExpandScale = Math.min(maxScaleByWidth, maxScaleByHeight);
  
  // expandScale is the additional scale on top of 1.0
  // Clamp to BASE_CONFIG.expandScale as upper bound
  const expandScale = Math.min(BASE_CONFIG.expandScale, maxExpandScale - 1);

  return {
    ...BASE_CONFIG,
    expandScale: Math.max(0.2, expandScale), // Ensure at least some expansion
  };
}

/** Hook that returns responsive carousel configuration */
export function useResponsiveConfig(): CarouselConfig {
  const [config, setConfig] = useState(() => calculateConfig());

  useEffect(() => {
    const handleResize = ():void => {
      setConfig(calculateConfig());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return config;
}
