"""UI 그림판을 잘라 assets/ui/ 에 투명 PNG로 넣는다.

- assets-src/ui/cart-ui-sheet.png: 분홍(마젠타) 배경. 탭 아이콘 5, 모래시계·빵·동전 (0.1.6 짐칸 탭). 그림판의 마차는 쓰지 않는다
- assets/source-sheets/sheet-A-icons-portraits.png: 검은 배경. 물품 그림 9개 (예전 것, goods_sheet()로만. 지금은 cut_goods.py)

python scripts/ui/cut_sheets.py   (numpy, pillow, scipy)
배경색 거리로 투명도를 만들고, 가장자리에 남은 배경색 기운을 빼고(despill), 덩어리마다 잘라 쓸 크기로 줄인다.
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as nd

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'ui')


def key_alpha(rgb: np.ndarray, key: np.ndarray, near: float, far: float) -> np.ndarray:
    """배경색과의 거리로 투명도 (near 이하는 투명, far 이상은 불투명)"""
    d = np.sqrt(((rgb - key) ** 2).sum(-1))
    return np.clip((d - near) / (far - near), 0, 1)


def despill_magenta(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """반투명 가장자리의 분홍 기운: 빨강·파랑이 초록보다 넘치는 만큼 줄인다"""
    out = rgb.copy()
    edge = alpha < 0.999
    g = out[..., 1]
    for c in (0, 2):
        ch = out[..., c]
        ch[edge] = np.minimum(ch[edge], np.maximum(g[edge], ch[edge] * alpha[edge]))
    return out


def save(rgba: np.ndarray, box, name: str, max_side: int, pad: int = 4) -> None:
    x0, y0, x1, y1 = box
    h, w = rgba.shape[:2]
    x0, y0, x1, y1 = max(0, x0 - pad), max(0, y0 - pad), min(w, x1 + pad), min(h, y1 + pad)
    im = Image.fromarray(rgba[y0:y1, x0:x1].astype('uint8'), 'RGBA')
    s = max_side / max(im.size)
    if s < 1:
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    path = os.path.join(OUT, name)
    im.save(path, optimize=True)
    print(f'{name}: {im.size[0]}x{im.size[1]}')


def components(alpha: np.ndarray, min_px: int):
    lab, n = nd.label(alpha > 0.5)
    sizes = nd.sum(alpha > 0.5, lab, range(1, n + 1))
    boxes = []
    for i, sl in enumerate(nd.find_objects(lab)):
        if sizes[i] >= min_px:
            boxes.append((sl[1].start, sl[0].start, sl[1].stop, sl[0].stop))
    return boxes


def cart_ui_sheet() -> None:
    src = np.asarray(Image.open(os.path.join(ROOT, 'assets-src', 'ui', 'cart-ui-sheet.png')).convert('RGB')).astype(float)
    alpha = key_alpha(src, np.array([255.0, 0.0, 255.0]), 90, 190)
    rgb = despill_magenta(src, alpha)
    rgba = np.dstack([rgb, alpha * 255])
    boxes = components(alpha, 2000)
    # 위 줄 아이콘 5개(왼쪽부터), 가운데 줄 3개, 마차 (가장 큰 덩어리)
    boxes.sort(key=lambda b: (b[2] - b[0]) * (b[3] - b[1]))
    wagon = boxes.pop()
    icons = sorted(boxes, key=lambda b: (b[1] > 250, b[0]))
    names = ['tab_town.png', 'tab_map.png', 'tab_cart.png', 'tab_ledger.png', 'tab_news.png', 'icon_hourglass.png', 'icon_bread.png', 'coin.png']
    if len(icons) != len(names):
        sys.exit(f'아이콘 덩어리 수가 다르다: {len(icons)}')
    for box, name in zip(icons, names):
        save(rgba, box, name, 160)
    # 마차는 다시 그려 받기로 해서 쓰지 않는다 (칸이 정사각형이 아니고 수레마다 칸 수가 다르다)
    del wagon


# 물품 그림: 그림판 셋째 줄, 왼쪽부터
GOODS = ['fish', 'meat', 'grain', 'wood', 'leather', 'ore', 'salt', 'salted', 'tools']


def goods_sheet() -> None:
    src = np.asarray(Image.open(os.path.join(ROOT, 'assets', 'source-sheets', 'sheet-A-icons-portraits.png')).convert('RGB')).astype(float)
    # 검은 배경은 가장자리에서 이어진 아주 어두운 곳만 (그림 안의 어두운 외곽선은 남긴다)
    dark = src.max(-1) < 22
    lab, _ = nd.label(dark)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    alpha = (~bg).astype(float)
    alpha = nd.gaussian_filter(alpha, 0.6)
    alpha[~bg] = 1.0
    rgba = np.dstack([src, alpha * 255])
    row = (alpha > 0.5)[520:660]
    boxes = [(b[0], b[1] + 520, b[2], b[3] + 520) for b in components(row.astype(float), 1500)]
    boxes.sort(key=lambda b: b[0])
    if len(boxes) != len(GOODS):
        sys.exit(f'물품 덩어리 수가 다르다: {len(boxes)}')
    os.makedirs(os.path.join(OUT, 'goods'), exist_ok=True)
    for box, good in zip(boxes, GOODS):
        save(rgba, box, f'goods/{good}.png', 128, pad=2)


if __name__ == '__main__':
    cart_ui_sheet()
    # 물품 그림은 0.1.6부터 로우폴리 그림(scripts/ui/cut_goods.py)을 쓴다. 예전 그림판 물품이 필요하면 goods_sheet()
