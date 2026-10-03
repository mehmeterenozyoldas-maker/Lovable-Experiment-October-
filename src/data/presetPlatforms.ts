import { PlatformPolygon } from '../types';

export interface PresetLayout {
  id: string;
  name: string;
  description: string;
  getPlatforms: (width: number, height: number) => PlatformPolygon[];
}

export const PRESET_PLATFORMS: PresetLayout[] = [
  {
    id: 'cascading_ramps',
    name: 'Cascading Ramps',
    description: 'Alternating sloped ramps creating a rhythmic pentatonic cascade.',
    getPlatforms: (w: number, h: number) => [
      {
        id: 'ramp1',
        color: '#05D5AF',
        points: [
          { x: w * 0.1, y: h * 0.22 },
          { x: w * 0.65, y: h * 0.35 },
          { x: w * 0.65, y: h * 0.38 },
          { x: w * 0.1, y: h * 0.25 }
        ]
      },
      {
        id: 'ramp2',
        color: '#FF2A6D',
        points: [
          { x: w * 0.35, y: h * 0.48 },
          { x: w * 0.9, y: h * 0.36 },
          { x: w * 0.9, y: h * 0.39 },
          { x: w * 0.35, y: h * 0.51 }
        ]
      },
      {
        id: 'ramp3',
        color: '#FED533',
        points: [
          { x: w * 0.08, y: h * 0.62 },
          { x: w * 0.62, y: h * 0.73 },
          { x: w * 0.62, y: h * 0.76 },
          { x: w * 0.08, y: h * 0.65 }
        ]
      },
      {
        id: 'ramp4',
        color: '#01BEFE',
        points: [
          { x: w * 0.38, y: h * 0.85 },
          { x: w * 0.88, y: h * 0.78 },
          { x: w * 0.88, y: h * 0.81 },
          { x: w * 0.38, y: h * 0.88 }
        ]
      }
    ]
  },
  {
    id: 'pinball_pegs',
    name: 'Pinball Pegs & Funnel',
    description: 'Bouncy peg field with bottom catch funnels for dense polyphonic chimes.',
    getPlatforms: (w: number, h: number) => {
      const platforms: PlatformPolygon[] = [];
      const colors = ['#FF2A6D', '#05D5AF', '#FED533', '#8F00FF', '#01BEFE'];

      // Funnel left and right
      platforms.push({
        id: 'funnel_left',
        color: '#8F00FF',
        points: [
          { x: w * 0.05, y: h * 0.65 },
          { x: w * 0.4, y: h * 0.82 },
          { x: w * 0.38, y: h * 0.85 },
          { x: w * 0.05, y: h * 0.68 }
        ]
      });
      platforms.push({
        id: 'funnel_right',
        color: '#8F00FF',
        points: [
          { x: w * 0.95, y: h * 0.65 },
          { x: w * 0.6, y: h * 0.82 },
          { x: w * 0.62, y: h * 0.85 },
          { x: w * 0.95, y: h * 0.68 }
        ]
      });

      // Diamond Pegs
      const rows = 4;
      let count = 0;
      for (let r = 0; r < rows; r++) {
        const cols = r + 3;
        const startX = w * 0.5 - (cols - 1) * 70;
        const y = h * 0.2 + r * 85;

        for (let c = 0; c < cols; c++) {
          const x = startX + c * 140;
          const size = 18;
          platforms.push({
            id: `peg_${count++}`,
            color: colors[(r + c) % colors.length],
            points: [
              { x: x, y: y - size },
              { x: x + size, y: y },
              { x: x, y: y + size },
              { x: x - size, y: y }
            ]
          });
        }
      }

      return platforms;
    }
  },
  {
    id: 'double_funnel',
    name: 'Double Funnel & Splitter',
    description: 'Symmetric dual funnels channeling balls onto a center splitter prism.',
    getPlatforms: (w: number, h: number) => [
      // Top Left Slope
      {
        id: 'slope1',
        color: '#01BEFE',
        points: [
          { x: w * 0.05, y: h * 0.2 },
          { x: w * 0.45, y: h * 0.4 },
          { x: w * 0.43, y: h * 0.43 },
          { x: w * 0.05, y: h * 0.23 }
        ]
      },
      // Top Right Slope
      {
        id: 'slope2',
        color: '#01BEFE',
        points: [
          { x: w * 0.95, y: h * 0.2 },
          { x: w * 0.55, y: h * 0.4 },
          { x: w * 0.57, y: h * 0.43 },
          { x: w * 0.95, y: h * 0.23 }
        ]
      },
      // Center Prism Splitter
      {
        id: 'splitter',
        color: '#FF2A6D',
        points: [
          { x: w * 0.5, y: h * 0.5 },
          { x: w * 0.62, y: h * 0.65 },
          { x: w * 0.38, y: h * 0.65 }
        ]
      },
      // Bottom Catch Slopes
      {
        id: 'bot_left',
        color: '#05D5AF',
        points: [
          { x: w * 0.15, y: h * 0.72 },
          { x: w * 0.48, y: h * 0.85 },
          { x: w * 0.45, y: h * 0.88 },
          { x: w * 0.15, y: h * 0.75 }
        ]
      },
      {
        id: 'bot_right',
        color: '#FED533',
        points: [
          { x: w * 0.85, y: h * 0.72 },
          { x: w * 0.52, y: h * 0.85 },
          { x: w * 0.55, y: h * 0.88 },
          { x: w * 0.85, y: h * 0.75 }
        ]
      }
    ]
  }
];
