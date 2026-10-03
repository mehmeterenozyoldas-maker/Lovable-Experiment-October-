import { ColorHSV, Point, CalibrationPoints } from '../types';
import { matrix, lusolve } from 'mathjs';

export class CVProcessor {
  /**
   * Convert RGB pixel (0..255) to HSV
   * H: 0..360, S: 0..100, V: 0..100
   */
  public static rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let h = 0;
    if (delta !== 0) {
      if (max === r) {
        h = ((g - b) / delta) % 6;
      } else if (max === g) {
        h = (b - r) / delta + 2;
      } else {
        h = (r - g) / delta + 4;
      }
      h = Math.round(h * 60);
      if (h < 0) h += 360;
    }

    const s = max === 0 ? 0 : Math.round((delta / max) * 100);
    const v = Math.round(max * 100);

    return { h, s, v };
  }

  /**
   * Statistically analyze a region of pixels to auto-tune HSV bounds
   */
  public static autoTuneHSV(imageData: ImageData, cx: number, cy: number, radius = 10): ColorHSV {
    const { width, height, data } = imageData;
    const hValues: number[] = [];
    const sValues: number[] = [];
    const vValues: number[] = [];

    for (let y = Math.max(0, cy - radius); y < Math.min(height, cy + radius); y++) {
      for (let x = Math.max(0, cx - radius); x < Math.min(width, cx + radius); x++) {
        const idx = (y * width + x) * 4;
        const { h, s, v } = this.rgbToHsv(data[idx], data[idx + 1], data[idx + 2]);
        hValues.push(h);
        sValues.push(s);
        vValues.push(v);
      }
    }

    const getStats = (arr: number[]) => {
      const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
      const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
      return { mean, std: Math.sqrt(variance) };
    };

    const hStats = getStats(hValues);
    const sStats = getStats(sValues);
    const vStats = getStats(vValues);

    // Provide a dynamic spread based on variance, but enforce minimums to prevent over-fitting
    const hSpread = Math.max(15, hStats.std * 2.5);
    const sSpread = Math.max(25, sStats.std * 2.5);
    const vSpread = Math.max(25, vStats.std * 2.5);

    return {
      hMin: Math.max(0, Math.round(hStats.mean - hSpread)),
      hMax: Math.min(360, Math.round(hStats.mean + hSpread)),
      sMin: Math.max(0, Math.round(sStats.mean - sSpread)),
      sMax: Math.min(100, Math.round(sStats.mean + sSpread)),
      vMin: Math.max(0, Math.round(vStats.mean - vSpread)),
      vMax: Math.min(100, Math.round(vStats.mean + vSpread)),
    };
  }

  /**
   * Detects 4 high-contrast magenta squares on the screen reflections via webcam
   */
  public static findAutoCalibrationMarkers(imageData: ImageData): Point[] | null {
    // Magenta is Hue ~300. We look for bright, saturated magenta
    const bounds = { hMin: 280, hMax: 320, sMin: 50, sMax: 100, vMin: 50, vMax: 100 };
    const { matchingPixels } = this.processHSVThreshold(imageData, bounds);
    
    const clusters = this.extractPlatformPolygons(matchingPixels, imageData.width, imageData.height, 10);
    if (clusters.length < 4) return null;

    // Get centroids of the 4 largest clusters
    clusters.sort((a, b) => b.length - a.length);
    const top4 = clusters.slice(0, 4).map(cluster => {
      let cx = 0, cy = 0;
      cluster.forEach(p => { cx += p.x; cy += p.y; });
      return { x: cx / cluster.length, y: cy / cluster.length };
    });

    // Sort corners top-left, top-right, bottom-right, bottom-left
    top4.sort((a, b) => a.y - b.y); // Sort by Y
    const top = top4.slice(0, 2).sort((a, b) => a.x - b.x); // Top 2 sorted by X
    const bottom = top4.slice(2, 4).sort((a, b) => b.x - a.x); // Bottom 2 sorted by X descending

    return [top[0], top[1], bottom[0], bottom[1]]; // TL, TR, BR, BL
  }

  /**
   * Computes True 3x3 Homography Matrix (Perspective Transform)
   */
  public static calculateHomography(src: Point[], dst: Point[]): number[] {
    const A = [];
    const B = [];

    for (let i = 0; i < 4; i++) {
      const x = src[i].x;
      const y = src[i].y;
      const u = dst[i].x;
      const v = dst[i].y;

      A.push([x, y, 1, 0, 0, 0, -x * u, -y * u]);
      B.push(u);

      A.push([0, 0, 0, x, y, 1, -x * v, -y * v]);
      B.push(v);
    }

    try {
      // @ts-ignore mathjs types mismatch
      const x = lusolve(matrix(A), matrix(B)).toArray();
      return [
        (x[0] as number[])[0], (x[1] as number[])[0], (x[2] as number[])[0],
        (x[3] as number[])[0], (x[4] as number[])[0], (x[5] as number[])[0],
        (x[6] as number[])[0], (x[7] as number[])[0], 1
      ];
    } catch (err) {
      console.warn("Homography singular matrix fallback", err);
      return [1, 0, 0, 0, 1, 0, 0, 0, 1];
    }
  }

  /**
   * Applies the True 3x3 Homography matrix to a point
   */
  public static applyHomography(p: Point, h: number[]): Point {
    const w = h[6] * p.x + h[7] * p.y + h[8];
    return {
      x: (h[0] * p.x + h[1] * p.y + h[2]) / w,
      y: (h[3] * p.x + h[4] * p.y + h[5]) / w
    };
  }

  /**
   * Filter image data using HSV bounds and create binary threshold mask ImageData
   */
  public static processHSVThreshold(
    imageData: ImageData,
    bounds: ColorHSV
  ): { maskData: ImageData; matchingPixels: Point[] } {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;

    const maskData = new ImageData(width, height);
    const mask = maskData.data;

    const matchingPixels: Point[] = [];

    // Step size for speed optimization
    const step = 2;

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        const { h, s, v } = this.rgbToHsv(r, g, b);

        let match = false;
        // Handle Hue wrap-around if hMin > hMax
        if (bounds.hMin <= bounds.hMax) {
          match = h >= bounds.hMin && h <= bounds.hMax;
        } else {
          match = h >= bounds.hMin || h <= bounds.hMax;
        }

        match = match && s >= bounds.sMin && s <= bounds.sMax && v >= bounds.vMin && v <= bounds.vMax;

        if (match) {
          matchingPixels.push({ x, y });

          // Fill mask block
          for (let dy = 0; dy < step && y + dy < height; dy++) {
            for (let dx = 0; dx < step && x + dx < width; dx++) {
              const mIdx = ((y + dy) * width + (x + dx)) * 4;
              mask[mIdx] = 0;       // Red
              mask[mIdx + 1] = 255; // Green highlight
              mask[mIdx + 2] = 120; // Blue
              mask[mIdx + 3] = 255; // Alpha
            }
          }
        } else {
          for (let dy = 0; dy < step && y + dy < height; dy++) {
            for (let dx = 0; dx < step && x + dx < width; dx++) {
              const mIdx = ((y + dy) * width + (x + dx)) * 4;
              mask[mIdx] = 20;
              mask[mIdx + 1] = 20;
              mask[mIdx + 2] = 20;
              mask[mIdx + 3] = 180;
            }
          }
        }
      }
    }

    return { maskData, matchingPixels };
  }

  /**
   * Group matching pixels into distinct polygon clusters (connected components)
   */
  public static extractPlatformPolygons(
    matchingPixels: Point[],
    width: number,
    height: number,
    minArea = 15
  ): Point[][] {
    if (matchingPixels.length < minArea) return [];

    // Simple grid binning for clustering
    const gridSize = 20;
    const grid: Map<string, Point[]> = new Map();

    for (const p of matchingPixels) {
      const gx = Math.floor(p.x / gridSize);
      const gy = Math.floor(p.y / gridSize);
      const key = `${gx},${gy}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key)!.push(p);
    }

    // Cluster adjacent cells
    const visited = new Set<string>();
    const clusters: Point[][] = [];

    for (const [key] of grid.entries()) {
      if (visited.has(key)) continue;

      const currentCluster: Point[] = [];
      const queue = [key];
      visited.add(key);

      while (queue.length > 0) {
        const curr = queue.pop()!;
        const [gx, gy] = curr.split(',').map(Number);

        const pts = grid.get(curr) || [];
        currentCluster.push(...pts);

        // Check 8 neighbors
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue;
            const neighborKey = `${gx + dx},${gy + dy}`;
            if (grid.has(neighborKey) && !visited.has(neighborKey)) {
              visited.add(neighborKey);
              queue.push(neighborKey);
            }
          }
        }
      }

      if (currentCluster.length >= minArea) {
        const hull = this.computeConvexHull(currentCluster);
        if (hull.length >= 3) {
          clusters.push(hull);
        }
      }
    }

    return clusters;
  }

  /**
   * Andrew's Monotone Chain Convex Hull algorithm
   * Replicates cv2.convexHull to produce stable convex physics bodies
   */
  public static computeConvexHull(points: Point[]): Point[] {
    if (points.length <= 3) return points;

    // Sort by x, then by y
    const sorted = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));

    const crossProduct = (o: Point, a: Point, b: Point) => {
      return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    };

    const lower: Point[] = [];
    for (const p of sorted) {
      while (
        lower.length >= 2 &&
        crossProduct(lower[lower.length - 2], lower[lower.length - 1], p) <= 0
      ) {
        lower.pop();
      }
      lower.push(p);
    }

    const upper: Point[] = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
      const p = sorted[i];
      while (
        upper.length >= 2 &&
        crossProduct(upper[upper.length - 2], upper[upper.length - 1], p) <= 0
      ) {
        upper.pop();
      }
      upper.push(p);
    }

    lower.pop();
    upper.pop();

    return lower.concat(upper);
  }

  /**
   * Bilinear Projective Perspective Transform
   * Maps camera point (cx, cy) using 4 calibration corners to screen dimensions (targetWidth, targetHeight)
   */
  public static transformPerspectivePoint(
    p: Point,
    calib: CalibrationPoints,
    camWidth: number,
    camHeight: number,
    targetWidth: number,
    targetHeight: number
  ): Point {
    // Relative position inside camera frame (0..1)
    const rx = p.x / camWidth;
    const ry = p.y / camHeight;

    // Interpolate top and bottom edge points
    const topX = calib.topLeft.x + rx * (calib.topRight.x - calib.topLeft.x);
    const topY = calib.topLeft.y + rx * (calib.topRight.y - calib.topLeft.y);

    const botX = calib.bottomLeft.x + rx * (calib.bottomRight.x - calib.bottomLeft.x);
    const botY = calib.bottomLeft.y + rx * (calib.bottomRight.y - calib.bottomLeft.y);

    // Vertical interpolation
    const interpX = topX + ry * (botX - topX);
    const interpY = topY + ry * (botY - topY);

    // Map interpolated coordinates to target screen size
    const screenX = (interpX / camWidth) * targetWidth;
    const screenY = (interpY / camHeight) * targetHeight;

    return {
      x: Math.max(0, Math.min(targetWidth, screenX)),
      y: Math.max(0, Math.min(targetHeight, screenY))
    };
  }
}
