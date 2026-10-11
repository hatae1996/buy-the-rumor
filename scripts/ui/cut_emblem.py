"""문장 그림 (0.2.1): assets-src/emblem/emblem-masks.png(분홍 바탕에 크림색 실루엣)를 잘라 assets/emblem/에 넣는다.

    python scripts/ui/cut_emblem.py        (numpy, pillow, scipy)

그림판은 5칸 × 5줄: 방패 모양 5, 나눔 무늬 8, 가운데 상징 10 (기획 목업 docs/reference/founding-emblem-mockup-0.2.1.png).
- shield_<id>.png: 정사각 캔버스 가운데에, 문장 viewBox(100 × 110)의 방패 자리에 맞게 (높이 가득, 너비는 100/110 안).
- sym_<id>.png: 정사각 캔버스 가운데에.
화면(src/ui/emblem.ts)은 둘 다 모양(알파)으로만 쓴다: 방패는 바탕 색·나눔 무늬를 자르고 테두리를 두르고, 상징은 상징 색으로 칠한다.
나눔 무늬는 그림판에도 있지만 화면이 도형으로 그린다(같은 모양, 더 선명하다).
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as nd

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'assets-src', 'emblem', 'emblem-masks.png')
OUT = os.path.join(ROOT, 'assets', 'emblem')
SIZE = 256

# 칸 차례 (줄마다 왼쪽부터). None은 나눔 무늬 칸 (쓰지 않는다)
GRID = [
    ['shield_heater', 'shield_round', 'shield_kite', 'shield_banner', 'shield_oval'],
    [None, None, None, None, None],
    [None, None, None, 'sym_wheat', 'sym_salt'],
    ['sym_horse', 'sym_key', 'sym_scales', 'sym_ship', 'sym_fish'],
    ['sym_hammer', 'sym_antler', 'sym_purse', None, None],
]


def main() -> None:
    src = np.asarray(Image.open(SRC).convert('RGB')).astype(float)
    # 분홍(255, 0, 255)에서 먼 곳이 그림. 크림색 하나뿐이라 거리로 알파만 만든다
    d = np.sqrt(((src - np.array([255.0, 0.0, 255.0])) ** 2).sum(-1))
    alpha = np.clip((d - 80) / 120, 0, 1)
    h, w = alpha.shape
    rows, cols = len(GRID), len(GRID[0])
    lab, n = nd.label(alpha > 0.5)
    cells: dict[tuple[int, int], list] = {}
    for k, sl in enumerate(nd.find_objects(lab), 1):
        if (lab[sl] == k).sum() < 30:
            continue
        cy = (sl[0].start + sl[0].stop) / 2
        cx = (sl[1].start + sl[1].stop) / 2
        cells.setdefault((int(cy / h * rows), int(cx / w * cols)), []).append(sl)
    os.makedirs(OUT, exist_ok=True)
    for r, row in enumerate(GRID):
        for c, name in enumerate(row):
            if not name:
                continue
            parts = cells.get((r, c))
            if not parts:
                sys.exit(f'{name}: 칸 ({r}, {c})에 그림이 없다')
            y0 = min(s[0].start for s in parts)
            y1 = max(s[0].stop for s in parts)
            x0 = min(s[1].start for s in parts)
            x1 = max(s[1].stop for s in parts)
            a = Image.fromarray((alpha[y0:y1, x0:x1] * 255).astype('uint8'), 'L')
            bw, bh = a.size
            if name.startswith('shield_'):
                # viewBox 100 × 110 자리: 높이 가득, 너비는 100/110 안
                s = min(SIZE / bh, SIZE * 100 / 110 / bw)
            else:
                s = SIZE * 0.96 / max(bw, bh)
            a = a.resize((max(1, round(bw * s)), max(1, round(bh * s))), Image.LANCZOS)
            canvas = Image.new('L', (SIZE, SIZE), 0)
            canvas.paste(a, ((SIZE - a.width) // 2, (SIZE - a.height) // 2))
            # 색은 화면이 칠한다: 흰색에 알파만
            img = Image.merge('RGBA', [Image.new('L', (SIZE, SIZE), 255)] * 3 + [canvas])
            img.save(os.path.join(OUT, f'{name}.png'), optimize=True)
            print(f'{name}.png ({len(parts)}조각)')


if __name__ == '__main__':
    main()
