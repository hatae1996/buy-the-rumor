// 자동 생성 (scripts/ui/cut_wagon_parts.py). 고치지 말고 스크립트를 다시 돌린다.
// 길 위 마차 부품 자리: 마차 틀(가로세로 비율 aspect) 안의 % 상자. 차례대로 겹친다 (뒤 → 앞)
export const RIG_ASPECT = 1.88;

export interface RigPart {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** 바퀴살: 돌린 뒤 가로로 이만큼 눌러 바퀴 기울기에 맞춘다 */
  squash?: number;
  /** 말 걷기 그림 장 수 (한 줄로 붙어 있다) */
  frames?: number;
}

export const RIG_PARTS: readonly RigPart[] = [
  { name: 'farRearSpokes', x: 11.75, y: 64.51, w: 11.61, h: 21.83, squash: 0.786 },
  { name: 'farRearRim', x: 9.8, y: 59.57, w: 15.3, h: 31.64 },
  { name: 'farRearHub', x: 14.51, y: 69.42, w: 6.11, h: 12.02 },
  { name: 'farFrontSpokes', x: 37.24, y: 56.6, w: 11.61, h: 21.83, squash: 0.786 },
  { name: 'farFrontRim', x: 35.29, y: 51.66, w: 15.3, h: 31.64 },
  { name: 'farFrontHub', x: 40.0, y: 61.51, w: 6.11, h: 12.02 },
  { name: 'shaftFar', x: 57.62, y: 48.08, w: 34.15, h: 12.58 },
  { name: 'horse', x: 57.93, y: 16.05, w: 42.07, h: 63.31, frames: 6 },
  { name: 'body', x: 0.0, y: 0.0, w: 61.04, h: 86.66 },
  { name: 'nearRearSpokes', x: 20.15, y: 70.44, w: 13.12, h: 24.66, squash: 0.796 },
  { name: 'nearRearRim', x: 18.31, y: 65.61, w: 16.63, h: 34.39 },
  { name: 'nearRearHub', x: 23.39, y: 76.23, w: 6.64, h: 13.07 },
  { name: 'nearFrontSpokes', x: 45.64, y: 62.53, w: 13.12, h: 24.66, squash: 0.796 },
  { name: 'nearFrontRim', x: 43.8, y: 57.7, w: 16.63, h: 34.39 },
  { name: 'nearFrontHub', x: 48.88, y: 68.32, w: 6.64, h: 13.07 },
  { name: 'shaftNear', x: 59.45, y: 54.25, w: 35.98, h: 14.95 },
];
