"""말 그림 빌드 (0.2.1): 기획자의 말 키트(assets-src/horse-kit/)로 털색 × 무늬마다 한 장씩 미리 그려 assets/horse/에 넣는다.

    npm run horses        (= python scripts/horse/build.py, numpy·pillow·scipy)

- 종류 3 × 털색 5(밤색, 갈색, 검정, 회색, 크림) × 무늬 4(없음, 이마 흰 줄, 흰 발목, 둘 다) = 60장,
  <종류>_<털색>_<무늬>.png, 256 정사각. 종류: 키트 horse_01 = 짐말(draft), horse_02 = 늙은 조랑말(pony), horse_03 = 빠른 말(swift).
  세 종류를 같은 배율로 그리고 발을 같은 높이에 둔다(조랑말이 작아 보이게).
  털색·무늬 목록은 src/sim/horses/coat.ts(말마다 세계 시드로 고른다)와 같아야 한다.
- 색 바꾸기는 키트의 horse_color.recolor_horse(명암 비율을 지키고 색만 입힌다)를 그대로 쓴다.
- 키트의 socks 무늬는 흰 발목과 이마 줄이 한 번에 들어가서, 게임 무늬(이마 흰 줄 / 흰 발목 / 둘 다)에 맞게 둘로 나눠 그린다.
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as nd

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
KIT = os.path.join(ROOT, 'assets-src', 'horse-kit')
OUT = os.path.join(ROOT, 'assets', 'horse')
SIZE = 256

sys.path.insert(0, KIT)
from horse_color import recolor_horse  # noqa: E402  키트 코드를 그대로 쓴다

# 털색: (몸, 갈기·꼬리, 발굽). 몸은 coat.ts의 색(검정만 명암이 눌리지 않게 조금 밝게, 키트 참고)
COATS = {
    'chestnut': ((154, 85, 48), (92, 46, 26), (60, 50, 45)),
    'bay': ((110, 74, 50), (36, 28, 24), (45, 40, 38)),
    'black': ((55, 50, 48), (30, 28, 28), (40, 38, 36)),
    'gray': ((156, 154, 150), (70, 68, 66), (60, 55, 52)),
    'cream': ((226, 209, 170), (236, 226, 200), (110, 105, 100)),
}
WHITE = (238, 234, 226)
MARKINGS = ('none', 'blaze', 'socks', 'both')
# 게임 말 종류(src/sim/constants.ts HORSES.kinds) → 키트 몸 그림
KINDS = {'draft': 'horse_01', 'pony': 'horse_02', 'swift': 'horse_03'}


def masks(reg: np.ndarray, alpha: np.ndarray) -> dict[str, np.ndarray]:
    """흰 발목과 이마 줄 (키트 horse_pattern.py의 socks를 둘로 나눈 것)"""
    h, w = reg.shape
    body = (reg == 1) & (alpha > 0)
    yy, xx = np.mgrid[0:h, 0:w].astype(float)
    ybot = np.nonzero(body.any(1))[0].max()
    socks = np.clip((yy - (ybot - 150)) / 12, 0, 1)
    xf = np.nonzero(body.any(0))[0].max()
    blaze = np.clip(np.exp(-((xx - (xf - 70)) / 10) ** 2) * (yy < np.percentile(yy[body], 30)) * 1.5, 0, 1)
    soft = lambda m: nd.gaussian_filter(m, 0.8) * body  # noqa: E731
    return {'blaze': soft(blaze), 'socks': soft(socks), 'both': soft(np.maximum(blaze, socks))}


def paint(rgba: np.ndarray, reg: np.ndarray, colors: tuple, mark: np.ndarray | None) -> np.ndarray:
    """키트의 색 바꾸기 + 몸 털 위에 흰 무늬를 같은 명암으로 섞는다"""
    out = recolor_horse(rgba, reg, {1: colors[0], 2: colors[1], 3: colors[2]})
    if mark is None:
        return out
    rgb = rgba[..., :3].astype(float)
    on = reg == 1
    v = rgb.mean(2)
    s = (np.clip(v / max(np.percentile(v[on], 70), 1), 0.35, 1.25) ** 0.9)[..., None]
    white = np.array(WHITE, float)[None, None] * s
    m = mark[..., None]
    mixed = out[..., :3].astype(float) * (1 - m) + white * m
    out = out.copy()
    out[..., :3][on] = np.clip(mixed[on], 0, 255).astype('uint8')
    return out


def main() -> None:
    bodies = {}
    for kind, name in KINDS.items():
        rgba = np.asarray(Image.open(os.path.join(KIT, f'{name}.png')).convert('RGBA'))
        reg = np.asarray(Image.open(os.path.join(KIT, f'{name}_reg.png')))
        ys, xs = np.nonzero(rgba[..., 3] > 8)
        bodies[kind] = (rgba, reg, (ys.min(), ys.max(), xs.min(), xs.max()))
    # 모든 종류를 같은 크기의 정사각으로 자른다: 가장 큰 말이 들어가는 크기, 말마다 가로 가운데, 발은 같은 높이
    side = int(max(max(b[1] - b[0], b[3] - b[2]) for _, _, b in bodies.values()) * 1.06)
    margin = int(side * 0.03)
    os.makedirs(OUT, exist_ok=True)
    for kind, (rgba, reg, (y0, y1, x0, x1)) in bodies.items():
        cx = (x0 + x1) // 2
        box = (cx - side // 2, y1 + margin - side, cx - side // 2 + side, y1 + margin)
        marks = masks(reg, rgba[..., 3])
        for coat, colors in COATS.items():
            for marking in MARKINGS:
                out = paint(rgba, reg, colors, None if marking == 'none' else marks[marking])
                im = Image.fromarray(out, 'RGBA').crop(box).resize((SIZE, SIZE), Image.LANCZOS)
                im.save(os.path.join(OUT, f'{kind}_{coat}_{marking}.png'), optimize=True)
    print(f'말 그림 {len(KINDS) * len(COATS) * len(MARKINGS)}장 → assets/horse/')


if __name__ == '__main__':
    main()
