"""물품 그림(assets-src/ui/goods/<물품>.png, 분홍 배경)을 잘라 assets/ui/goods/ 에 투명 PNG로 넣는다.

python scripts/ui/cut_goods.py   (numpy, pillow, scipy)
그림은 짐 모양(돌리지 않은 모양, src/sim/constants.ts CART.goods shape)의 비율로 그린다: 생선·가죽 2:1, 고기 1:2, 목재 3:1,
곡물·소금·광석 1:1, 염장 식품·도구는 ㄴ자(왼쪽 위 한 칸 + 아래 두 칸). 화면이 조각 크기에 맞춰 늘이고 짐을 돌리면 같이 돌린다.
"""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from cut_sheets import despill_magenta, key_alpha  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'assets-src', 'ui', 'goods')
OUT = os.path.join(ROOT, 'assets', 'ui', 'goods')

# 짐 모양의 가로:세로 칸 수 (돌리지 않은 모양)
CELLS = {
    'fish': (2, 1),
    'meat': (1, 2),
    'grain': (2, 2),
    'wood': (3, 1),
    'leather': (2, 1),
    'ore': (1, 1),
    'salt': (1, 1),
    'salted': (2, 2),
    'tools': (2, 2),
}
# 한 칸에 이만큼(px). 화면 칸은 많아야 64px, 레티나 2배
CELL_PX = 128


def cut(name: str) -> None:
    src = np.asarray(Image.open(os.path.join(SRC, f'{name}.png')).convert('RGB')).astype(float)
    alpha = key_alpha(src, np.array([255.0, 0.0, 255.0]), 90, 190)
    rgb = despill_magenta(src, alpha)
    ys, xs = np.where(alpha > 0.5)
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    im = Image.fromarray(np.dstack([rgb, alpha * 255])[y0:y1, x0:x1].astype('uint8'), 'RGBA')
    cw, ch = CELLS[name]
    # 짐 모양 비율의 투명 판 가운데에 그림을 맞춘다 (그림 비율이 조금 달라도 늘어나지 않게)
    box = (cw * CELL_PX, ch * CELL_PX)
    s = min(box[0] / im.width, box[1] / im.height)
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    out = Image.new('RGBA', box, (0, 0, 0, 0))
    out.alpha_composite(im, ((box[0] - im.width) // 2, (box[1] - im.height) // 2))
    os.makedirs(OUT, exist_ok=True)
    out.save(os.path.join(OUT, f'{name}.png'), optimize=True)
    print(f'{name}: {out.width}x{out.height} (그림 {im.width}x{im.height})')


if __name__ == '__main__':
    for name in CELLS:
        cut(name)
