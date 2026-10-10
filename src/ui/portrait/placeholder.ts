// 파츠 그림이 아직 없을 때의 단색 자리표시 (0.1.4). 레이어마다 모양 하나를 그 레이어 색 한 가지로 칠하고 외곽선을 두른다.
// 좌표는 100 × 100 칸 기준 (반신 초상: 머리는 위 가운데, 어깨는 아래).
const LINE = '#3a2a20';

function shape(g: CanvasRenderingContext2D, color: string, path: (g: CanvasRenderingContext2D) => void, stroke = true): void {
  g.beginPath();
  path(g);
  g.fillStyle = color;
  g.fill();
  if (stroke) {
    g.lineWidth = 1.6;
    g.strokeStyle = LINE;
    g.stroke();
  }
}

const ellipse = (x: number, y: number, rx: number, ry: number) => (g: CanvasRenderingContext2D) => g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
const rect = (x: number, y: number, w: number, h: number, r = 3) => (g: CanvasRenderingContext2D) => g.roundRect(x, y, w, h, r);
const poly = (...pts: [number, number][]) => (g: CanvasRenderingContext2D) => {
  g.moveTo(...pts[0]!);
  for (const p of pts.slice(1)) g.lineTo(...p);
  g.closePath();
};

/** 어깨 (상의마다 모양만 조금씩 다르다) */
const shoulders = poly([18, 100], [24, 76], [40, 68], [60, 68], [76, 76], [82, 100]);

/** 정수리를 덮고 뒤로 넘긴 머리 (쪽진 머리, 꽁지머리 앞 장) */
const HAIR_CAP: [number, number][] = [
  [33, 34], [36, 23], [50, 19], [64, 23], [67, 34], [60, 27], [40, 27],
];

const HEAD: Record<string, (g: CanvasRenderingContext2D) => void> = {
  round: ellipse(50, 40, 17, 18),
  oval: ellipse(50, 40, 15, 20),
  square: rect(34, 22, 32, 36, 9),
};

export const PLACEHOLDER: Record<string, Record<string, (g: CanvasRenderingContext2D, color: string) => void>> = {
  backHair: {
    long: (g, c) => shape(g, c, rect(30, 24, 40, 50, 14)),
    ponytail: (g, c) => {
      shape(g, c, rect(36, 50, 9, 22, 4));
      shape(g, c, rect(55, 50, 9, 22, 4));
    },
  },
  face: Object.fromEntries(
    Object.entries(HEAD).map(([id, head]) => [
      id,
      (g: CanvasRenderingContext2D, c: string) => {
        shape(g, c, rect(43, 52, 14, 18, 2));
        shape(g, c, head);
        // 눈과 입 (그림에서는 얼굴 파츠에 들어 있다)
        g.fillStyle = LINE;
        g.beginPath();
        g.arc(44, 41, 1.6, 0, Math.PI * 2);
        g.arc(56, 41, 1.6, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.moveTo(46, 50);
        g.quadraticCurveTo(50, 52.5, 54, 50);
        g.lineWidth = 1.2;
        g.strokeStyle = LINE;
        g.stroke();
      },
    ]),
  ),
  top: {
    tunic: (g, c) => {
      shape(g, c, shoulders);
      shape(g, LINE, poly([47, 69], [50, 78], [53, 69]), false);
    },
    pinafore: (g, c) => {
      shape(g, '#e8dcc3', shoulders);
      shape(g, c, poly([30, 100], [34, 74], [42, 70], [46, 80], [54, 80], [58, 70], [66, 74], [70, 100]));
    },
    apron: (g, c) => {
      shape(g, c, shoulders);
      shape(g, 'rgba(255,255,255,0.45)', rect(38, 78, 24, 24, 2));
    },
    shawl: (g, c) => {
      shape(g, '#d9ccb0', shoulders);
      shape(g, c, poly([20, 92], [26, 74], [42, 67], [50, 86], [58, 67], [74, 74], [80, 92], [50, 100]));
    },
    cloak: (g, c) => shape(g, c, poly([12, 100], [22, 72], [38, 64], [62, 64], [78, 72], [88, 100])),
    leatherVest: (g, c) => {
      shape(g, '#d9ccb0', shoulders);
      shape(g, c, poly([24, 100], [28, 76], [42, 69], [46, 100]));
      shape(g, c, poly([76, 100], [72, 76], [58, 69], [54, 100]));
    },
    sweater: (g, c) => {
      shape(g, c, shoulders);
      shape(g, c, rect(40, 64, 20, 8, 4));
      strokes(g, 'rgba(58,42,32,0.45)', 1, [[34, 80, 34, 100], [42, 78, 42, 100], [58, 78, 58, 100], [66, 80, 66, 100]]);
    },
    furCoat: (g, c) => {
      shape(g, c, shoulders);
      shape(g, '#e3d6bd', poly([26, 76], [40, 64], [50, 74], [60, 64], [74, 76], [60, 82], [50, 78], [40, 82]));
      strokes(g, LINE, 1.2, [[30, 98, 66, 74]]);
    },
    braces: (g, c) => {
      shape(g, '#e8dcc3', shoulders);
      shape(g, c, rect(36, 70, 6, 32, 2));
      shape(g, c, rect(58, 70, 6, 32, 2));
    },
    leatherApron: (g, c) => {
      shape(g, '#d9ccb0', shoulders);
      shape(g, c, poly([36, 100], [38, 78], [62, 78], [64, 100]));
      strokes(g, c, 2, [[38, 78, 44, 68], [62, 78, 56, 68]]);
    },
  },
  brows: {
    soft: (g, c) => strokes(g, c, 1.2, [[40, 35, 47, 35], [53, 35, 60, 35]]),
    thick: (g, c) => strokes(g, c, 2.6, [[39, 35, 47, 34], [53, 34, 61, 35]]),
    arched: (g, c) => {
      g.beginPath();
      g.moveTo(39, 36);
      g.quadraticCurveTo(43.5, 32, 48, 35);
      g.moveTo(52, 35);
      g.quadraticCurveTo(56.5, 32, 61, 36);
      g.lineWidth = 1.8;
      g.strokeStyle = c;
      g.stroke();
    },
  },
  beard: {
    stubble: (g, c) => shape(g, withAlpha(c, 0.45), poly([36, 46], [64, 46], [60, 57], [50, 60], [40, 57]), false),
    mustache: (g, c) => shape(g, c, poly([42, 48], [50, 46], [58, 48], [56, 50], [50, 48.5], [44, 50])),
    full: (g, c) => shape(g, c, poly([34, 42], [40, 50], [50, 48], [60, 50], [66, 42], [64, 56], [50, 66], [36, 56])),
  },
  freckles: {
    freckles: (g) => {
      g.fillStyle = '#9a5a3a';
      for (const [x, y] of [[41, 45], [44, 46.5], [42, 48], [56, 46.5], [59, 45], [58, 48]] as const) {
        g.beginPath();
        g.arc(x, y, 0.8, 0, Math.PI * 2);
        g.fill();
      }
    },
  },
  wrinkles: {
    lines: (g) => strokes(g, 'rgba(58,42,32,0.55)', 0.9, [[42, 29, 58, 29], [44, 31, 56, 31], [36, 43, 38, 46], [64, 43, 62, 46]]),
  },
  frontHair: {
    curly: (g, c) => {
      for (const [x, y] of [[36, 30], [40, 23], [47, 20], [53, 20], [60, 23], [64, 30]] as const) shape(g, c, ellipse(x, y, 5, 5));
    },
    cropped: (g, c) => shape(g, c, poly([33, 32], [37, 23], [50, 20], [63, 23], [67, 32], [58, 26], [42, 26])),
    balding: (g, c) => {
      shape(g, c, poly([31, 44], [32, 30], [37, 27], [37, 40]));
      shape(g, c, poly([69, 44], [68, 30], [63, 27], [63, 40]));
    },
    bun: (g, c) => {
      shape(g, c, ellipse(50, 15, 8, 7));
      shape(g, c, poly(...HAIR_CAP));
    },
    braid: (g, c) => {
      shape(g, c, poly([32, 38], [35, 23], [44, 19], [58, 20], [66, 25], [68, 38], [56, 26], [40, 27]));
      for (const y of [44, 52, 60, 68]) shape(g, c, ellipse(66, y, 4.5, 4.5));
    },
    long: (g, c) => shape(g, c, poly([31, 56], [32, 28], [42, 20], [58, 20], [68, 28], [69, 56], [64, 54], [63, 30], [50, 26], [37, 30], [36, 54])),
    ponytail: (g, c) => shape(g, c, poly(...HAIR_CAP)),
  },
  hat: {
    hood: (g, c) => {
      g.beginPath();
      g.moveTo(26, 72);
      g.bezierCurveTo(22, 30, 34, 12, 50, 12);
      g.bezierCurveTo(66, 12, 78, 30, 74, 72);
      g.lineTo(66, 70);
      g.bezierCurveTo(70, 34, 60, 22, 50, 22);
      g.bezierCurveTo(40, 22, 30, 34, 34, 70);
      g.closePath();
      g.fillStyle = c;
      g.fill();
      g.lineWidth = 1.6;
      g.strokeStyle = LINE;
      g.stroke();
    },
    kerchief: (g, c) => {
      shape(g, c, poly([31, 34], [34, 22], [50, 16], [66, 22], [69, 34], [50, 28]));
      shape(g, c, poly([66, 30], [76, 36], [70, 40]));
    },
    feltHat: (g, c) => {
      shape(g, c, ellipse(50, 26, 28, 5));
      shape(g, c, rect(37, 8, 26, 18, 6));
    },
    cap: (g, c) => {
      shape(g, c, poly([32, 30], [36, 18], [50, 14], [64, 18], [68, 30]));
      shape(g, c, ellipse(36, 30, 9, 3));
    },
  },
};

function strokes(g: CanvasRenderingContext2D, color: string, width: number, lines: readonly (readonly [number, number, number, number])[]): void {
  g.beginPath();
  for (const [x1, y1, x2, y2] of lines) {
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
  }
  g.lineCap = 'round';
  g.lineWidth = width;
  g.strokeStyle = color;
  g.stroke();
}

function withAlpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
