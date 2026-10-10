"""수레·창고 그림(assets-src/ui/carts/<판>.png, 분홍 배경)을 잘라 assets/ui/carts/ 에 넣고, 그림 속 칸 자리를 재서
src/ui/cartArtLayout.ts 로 쓴다 (화면이 그 자리에 짐을 놓는다).

python scripts/ui/cut_carts.py   (numpy, pillow, scipy)
그림의 칸 모양이 게임의 수레 칸(src/sim/constants.ts CART.types rows)과 다르면 멈춘다.
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as nd

sys.path.insert(0, os.path.dirname(__file__))
from cut_sheets import despill_magenta, key_alpha  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'assets-src', 'ui', 'carts')
OUT = os.path.join(ROOT, 'assets', 'ui', 'carts')
TS = os.path.join(ROOT, 'src', 'ui', 'cartArtLayout.ts')

# src/sim/constants.ts CART.types의 rows와 같아야 한다 (0.1.6 세로형)
ROWS = {
    'pack': ['###', '###', '###'],
    'handcart': ['.#.', '###', '###', '###', '###', '###'],
    'wagon': ['####', '####', '####', '####', '####', '####', '.##.'],
    'carriage': ['.###.', '#####', '#####', '#####', '#####', '#####', '#####', '#####'],
    # 창고 판 (src/sim/constants.ts GROWTH.warehouse rows)
    'warehouse': ['#####', '#####', '#####'],
}
# 사파리 메모리: 그림은 1024 이하로
MAX_SIDE = 1024


def cells_of(rgb: np.ndarray, alpha: np.ndarray):
    """칸 바닥(베이지)을 덩어리로 찾는다: 크기가 비슷하고 거의 정사각형인 것만"""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    beige = (alpha > 0.9) & (r > 185) & (r < 232) & (g > 160) & (g < 212) & (b > 115) & (b < 178) & (r - b > 35) & (r - b < 85)
    beige = nd.binary_opening(beige, iterations=2)
    lab, n = nd.label(beige)
    boxes = []
    for sl in nd.find_objects(lab):
        h = sl[0].stop - sl[0].start
        w = sl[1].stop - sl[1].start
        boxes.append((sl[1].start, sl[0].start, w, h))
    if not boxes:
        return []
    # 덮개 그늘처럼 큰 덩어리가 섞일 수 있어, 정사각형이고 너무 작지 않은 것의 가운데 크기를 칸 크기로 본다
    min_side = rgb.shape[1] / 14
    square = [bx for bx in boxes if bx[2] > min_side and bx[3] > min_side and 0.7 < bx[2] / bx[3] < 1.45]
    if not square:
        return []
    mid = float(np.median([w * h for _, _, w, h in square]))
    boxes = [bx for bx in square if mid * 0.55 < bx[2] * bx[3] < mid * 1.6]
    # 칸 테두리와 안쪽 바닥이 따로 잡히면 바깥 것만 (가운데가 다른 덩어리 안에 든 작은 덩어리를 뺀다)
    def inside(a, b):
        cx, cy = a[0] + a[2] / 2, a[1] + a[3] / 2
        return a is not b and b[2] * b[3] > a[2] * a[3] and b[0] <= cx <= b[0] + b[2] and b[1] <= cy <= b[1] + b[3]
    boxes = [a for a in boxes if not any(inside(a, b) for b in boxes)]
    # 칸은 격자에 놓여 있어 바로 옆이나 위아래 칸 간격만큼에 이웃 칸이 있다 (덮개 그늘 같은 외톨이 덩어리를 뺀다)
    cen = [(x + w / 2, y + h / 2) for x, y, w, h in boxes]
    side = float(np.median([min(w, h) for _, _, w, h in boxes]))

    def has_neighbor(i):
        x, y = cen[i]
        for j, (u, v) in enumerate(cen):
            if j == i:
                continue
            dx, dy = abs(u - x), abs(v - y)
            if (dy < side * 0.3 and side * 0.9 < dx < side * 1.6) or (dx < side * 0.3 and side * 0.9 < dy < side * 1.6):
                return True
        return False

    return [b for i, b in enumerate(boxes) if has_neighbor(i)]


def layout(name: str):
    src = np.asarray(Image.open(os.path.join(SRC, f'{name}.png')).convert('RGB')).astype(float)
    alpha = key_alpha(src, np.array([255.0, 0.0, 255.0]), 90, 190)
    rgb = despill_magenta(src, alpha)
    ys, xs = np.where(alpha > 0.5)
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    rgb, alpha = rgb[y0:y1, x0:x1], alpha[y0:y1, x0:x1]

    cells = cells_of(rgb, alpha)
    # 칸 간격이 가로세로 10% 넘게 다르면(창고 그림) 그림을 세로로 늘이거나 줄여 칸을 정사각형으로 맞춘다 (화면은 정사각형 칸을 그린다)
    if len(cells) > 1:
        side0 = float(np.median([min(w, h) for _, _, w, h in cells]))
        def gaps(vals):
            vals = sorted(vals)
            d = [b - a for a, b in zip(vals, vals[1:]) if b - a > side0 * 0.5]
            return float(np.median(d)) if d else None
        gx = gaps([x + w / 2 for x, _, w, _ in cells])
        gy = gaps([y + h / 2 for _, y, _, h in cells])
        if gx and gy and abs(gx / gy - 1) > 0.1:
            k = gx / gy
            hh = round(rgb.shape[0] * k)
            rgb = np.asarray(Image.fromarray(rgb.clip(0, 255).astype('uint8')).resize((rgb.shape[1], hh), Image.LANCZOS)).astype(float)
            alpha = np.asarray(Image.fromarray((alpha * 255).clip(0, 255).astype('uint8')).resize((alpha.shape[1], hh), Image.LANCZOS)).astype(float) / 255
            print(f'{name}: 칸 간격 가로 {gx:.0f} 세로 {gy:.0f} → 세로로 {k:.3f}배')
            cells = cells_of(rgb, alpha)
    rows = ROWS[name]
    want = sum(row.count('#') for row in rows)
    if len(cells) != want:
        sys.exit(f'{name}: 칸 {len(cells)}개를 찾았다 (수레는 {want}칸)')
    cx = np.array([x + w / 2 for x, _, w, _ in cells])
    cy = np.array([y + h / 2 for _, y, _, h in cells])
    side = float(np.median([min(w, h) for _, _, w, h in cells]))

    def clusters(vals):
        """가운데 값을 줄(또는 열)끼리 묶은 평균들 (테두리가 조금씩 달라 생기는 흔들림을 없앤다)"""
        out, cur = [], [vals[0]]
        for v in vals[1:]:
            if v - cur[-1] > side * 0.5:
                out.append(float(np.mean(cur)))
                cur = [v]
            else:
                cur.append(v)
        out.append(float(np.mean(cur)))
        return out

    colx = clusters(sorted(cx))
    rowy = clusters(sorted(cy))
    pitch = float(np.median(np.diff(colx).tolist() + np.diff(rowy).tolist()))
    gx0, gy0 = colx[0], rowy[0]
    found = [['.'] * len(rows[0]) for _ in rows]
    for x, y in zip(cx, cy):
        i, j = round((x - gx0) / pitch), round((y - gy0) / pitch)
        if not (0 <= j < len(rows) and 0 <= i < len(rows[0])):
            sys.exit(f'{name}: 칸이 격자 밖 ({i}, {j})')
        found[j][i] = '#'
    found = [''.join(r) for r in found]
    if found != rows:
        sys.exit(f'{name}: 칸 모양이 다르다\n  그림: {found}\n  수레: {rows}')

    scale = min(1.0, MAX_SIDE / max(rgb.shape[:2]))
    im = Image.fromarray(np.dstack([rgb, alpha * 255]).astype('uint8'), 'RGBA')
    if scale < 1:
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    os.makedirs(OUT, exist_ok=True)
    im.save(os.path.join(OUT, f'{name}.png'), optimize=True)
    # 격자 (0, 0) 칸의 왼쪽 위와 칸 간격 (그림 px)
    ox = (gx0 - pitch / 2) * scale
    oy = (gy0 - pitch / 2) * scale
    print(f'{name}: {im.width}x{im.height}, 칸 {want}, 간격 {pitch * scale:.1f}px')
    return {'w': im.width, 'h': im.height, 'x': round(ox, 1), 'y': round(oy, 1), 'pitch': round(pitch * scale, 2)}


def main() -> None:
    out = {name: layout(name) for name in ROWS}
    lines = [
        '// 자동 생성 (scripts/ui/cut_carts.py). 고치지 말고 스크립트를 다시 돌린다.',
        '// 수레·창고 그림(assets/ui/carts/<판>.png) 크기와, 그림 속 칸 격자 (0, 0) 칸의 왼쪽 위·칸 간격 (그림 px)',
        "import type { CartType } from '../sim/cart';",
        '',
        "export const CART_ART_LAYOUT: Record<CartType | 'warehouse', { w: number; h: number; x: number; y: number; pitch: number }> = {",
    ]
    for name, v in out.items():
        lines.append(f"  {name}: {{ w: {v['w']}, h: {v['h']}, x: {v['x']}, y: {v['y']}, pitch: {v['pitch']} }},")
    lines.append('};')
    with open(TS, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(lines) + '\n')
    print('wrote', os.path.relpath(TS, ROOT))


if __name__ == '__main__':
    main()
