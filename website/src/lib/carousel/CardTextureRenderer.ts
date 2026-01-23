/**
 * Canvas-based card texture rendering for GPU consumption
 */

import type { CardData, CarouselConfig } from './data';
import { CARD_THEMES } from './data';

export interface CardTextureCache {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

/**
 * Manages canvas-based card texture rendering with caching
 */
export class CardTextureRenderer {
  private canvasCache = new Map<string, CardTextureCache>();
  private imageCache = new Map<string, HTMLImageElement>();

  /** Preload an image and cache it */
  async loadImage(url: string, timeoutMs = 4000): Promise<HTMLImageElement | null> {
    if (this.imageCache.has(url)) {
      return this.imageCache.get(url) ?? null;
    }

    return new Promise((resolve) => {
      const img = new Image();
      let settled = false;

      const finalize = (result: HTMLImageElement | null) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      const timeoutId = window.setTimeout(() => finalize(null), timeoutMs);

      img.crossOrigin = 'anonymous';
      img.onload = () => {
        window.clearTimeout(timeoutId);
        this.imageCache.set(url, img);
        finalize(img);
      };
      img.onerror = () => {
        window.clearTimeout(timeoutId);
        finalize(null);
      };
      img.src = url;
    });
  }

  /** Check if an image is already cached */
  hasImage(url: string): boolean {
    return this.imageCache.has(url);
  }

  /** Get a cached image */
  getImage(url: string): HTMLImageElement | undefined {
    return this.imageCache.get(url);
  }

  /**
   * Render a card to a canvas texture
   * @param card - Card data
   * @param index - Card index (for theme fallback)
   * @param config - Carousel configuration
   * @param expandProgress - 0 = collapsed, 1 = fully expanded
   */
  render(
    card: CardData,
    index: number,
    config: CarouselConfig,
    expandProgress = 0
  ): HTMLCanvasElement {
    // Cap DPR at 2 for performance (3x on iPhone is excessive for textures)
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // Use lower texture scale on mobile - still crisp enough when zoomed
    const isMobile = window.innerWidth < 640;
    const textureScale = isMobile ? 1 : 2;
    const totalScale = dpr * textureScale;

    const expectedWidth = Math.floor(config.cardWidth * totalScale);
    const expectedHeight = Math.floor(config.cardHeight * totalScale);

    // Get or create canvas (recreate if dimensions changed)
    let cached = this.canvasCache.get(card.id);
    if (
      !cached ||
      cached.canvas.width !== expectedWidth ||
      cached.canvas.height !== expectedHeight
    ) {
      const canvas = document.createElement('canvas');
      canvas.width = expectedWidth;
      canvas.height = expectedHeight;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return canvas;
      cached = { canvas, ctx };
      this.canvasCache.set(card.id, cached);
    }

    const { canvas, ctx } = cached;
    ctx.save();
    ctx.setTransform(totalScale, 0, 0, totalScale, 0, 0);

    // Enable image smoothing (use medium quality on mobile for performance)
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = isMobile ? 'medium' : 'high';

    // Clear canvas
    ctx.clearRect(0, 0, config.cardWidth, config.cardHeight);

    // Draw background image or gradient fallback
    const img = this.imageCache.get(card.image);
    if (img) {
      this.drawBackgroundImage(ctx, img, config);
    } else {
      this.drawGradientFallback(ctx, index, config);
    }

    // Draw text overlay
    this.drawTextOverlay(ctx, card, config, expandProgress);

    ctx.restore();
    return canvas;
  }

  private drawBackgroundImage(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    config: CarouselConfig
  ): void {
    const imgRatio = img.width / img.height;
    const cardRatio = config.cardWidth / config.cardHeight;
    let drawWidth = config.cardWidth;
    let drawHeight = config.cardHeight;
    let drawX = 0;
    let drawY = 0;

    if (imgRatio > cardRatio) {
      drawHeight = config.cardHeight;
      drawWidth = drawHeight * imgRatio;
      drawX = -(drawWidth - config.cardWidth) / 2;
    } else {
      drawWidth = config.cardWidth;
      drawHeight = drawWidth / imgRatio;
      drawY = -(drawHeight - config.cardHeight) / 2;
    }

    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, config.cardWidth, config.cardHeight);
  }

  private drawGradientFallback(
    ctx: CanvasRenderingContext2D,
    index: number,
    config: CarouselConfig
  ): void {
    const theme = CARD_THEMES[index % CARD_THEMES.length];
    const gradient = ctx.createLinearGradient(
      0,
      0,
      config.cardWidth,
      config.cardHeight
    );
    gradient.addColorStop(0, theme.primary);
    gradient.addColorStop(1, theme.secondary);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, config.cardWidth, config.cardHeight);
  }

  private drawTextOverlay(
    ctx: CanvasRenderingContext2D,
    card: CardData,
    config: CarouselConfig,
    expandProgress: number
  ): void {
    // Calculate text positions with animation
    // When expanded, title/subtitle shift up to make room for description
    const textShiftScale = config.cardHeight / 420;
    const textShift = expandProgress * 60 * textShiftScale;
    const descriptionOpacity = Math.max(0, (expandProgress - 0.3) / 0.7);

    // Responsive font sizes
    const titleSize = Math.max(14, Math.min(18, config.cardWidth * 0.06));
    const subtitleSize = Math.max(11, Math.min(13, config.cardWidth * 0.043));
    const padding = Math.max(10, config.cardWidth * 0.047);

    ctx.textBaseline = 'top';

    // Title (shifts up when expanded)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = `600 ${titleSize}px Inter, system-ui, sans-serif`;
    ctx.fillText(
      card.title,
      padding,
      config.cardHeight - 50 * textShiftScale - textShift
    );

    // Subtitle (shifts up when expanded)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = `${subtitleSize}px Inter, system-ui, sans-serif`;
    ctx.fillText(
      card.subtitle,
      padding,
      config.cardHeight - 30 * textShiftScale - textShift
    );

    // Description (fades in when expanded)
    if (descriptionOpacity > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${0.5 * descriptionOpacity})`;
      ctx.font = `${subtitleSize}px Inter, system-ui, sans-serif`;

      // Word wrap the description
      const maxWidth = config.cardWidth - padding * 2;
      const lineHeight = subtitleSize * 1.4;
      const words = card.body.split(' ');
      let line = '';
      let y = config.cardHeight - 10 * textShiftScale - textShift + 4;

      for (const word of words) {
        const testLine = line + (line ? ' ' : '') + word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && line) {
          ctx.fillText(line, padding, y);
          line = word;
          y += lineHeight;
        } else {
          line = testLine;
        }
      }
      if (line) {
        ctx.fillText(line, padding, y);
      }
    }
  }

  /** Clear all caches */
  destroy(): void {
    this.canvasCache.clear();
    this.imageCache.clear();
  }
}
