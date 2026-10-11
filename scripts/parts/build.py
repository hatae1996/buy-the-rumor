"""문장 부품 빌드 (0.1.7): 기획자가 뽑은 회색조 원본(assets-src/emblem/)에서 게임용 512 그림을 만든다.
0.2.1부터 문장 그림은 실루엣 그림판에서 scripts/ui/cut_emblem.py로, 말 그림은 말 키트에서 scripts/horse/build.py로 만든다.
이 스크립트는 회색조 원본(shield_<모양>.png, sym_<상징>.png)이 다시 오면 쓴다.

    npm run parts        (= python scripts/parts/build.py)

필요한 것: pip install numpy pillow scipy
프롬프트: docs/reference/emblem-horse-prompts.md

원본 (1254×1254, 없는 것은 건너뛴다):
  assets-src/emblem/shield_<모양>.png, sym_<상징>.png
      회색조, 투명 배경. 배경이 남아 있으면 모서리 색으로 지운다.

만드는 것:
  assets/emblem/<이름>.png      회색조 + 투명 배경, 512. 색은 게임이 칠한다 (src/ui/emblem.ts).

같은 원본이면 다시 돌려도 같은 그림이 나온다.
"""
import argparse
import os
import re

import numpy as np
from PIL import Image
from scipy import ndimage as nd

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SIZE = 512

EMBLEM_RE = re.compile(r'^(shield|sym)_[a-z]+$')


def save_png(im: Image.Image, path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, optimize=True)


def cut_background(path: str) -> np.ndarray:
    """RGBA 배열. 이미 투명한 곳이 있으면 그대로, 아니면 모서리 색과 다른 곳만 남기고 안쪽 구멍을 메운다"""
    im = np.asarray(Image.open(path).convert('RGBA')).astype(np.uint8)
    if (im[..., 3] < 250).mean() > 0.05:
        return im
    rgb = im[..., :3].astype(float)
    corners = np.concatenate([rgb[:40, :40].reshape(-1, 3), rgb[:40, -40:].reshape(-1, 3), rgb[-40:, :40].reshape(-1, 3), rgb[-40:, -40:].reshape(-1, 3)])
    bg = np.median(corners, 0)
    fg = nd.binary_fill_holes(nd.binary_opening(np.abs(rgb - bg).sum(2) > 30, iterations=2))
    out = im.copy()
    out[..., 3] = np.where(fg, 255, 0).astype(np.uint8)
    return out


def build_emblems(src: str, out: str) -> list[str]:
    if not os.path.isdir(src):
        return []
    done = []
    for f in sorted(os.listdir(src)):
        name = f[:-4]
        if not (f.endswith('.png') and EMBLEM_RE.match(name)):
            continue
        rgba = cut_background(os.path.join(src, f))
        # 회색조로 (색은 게임이 곱한다)
        gray = (rgba[..., :3].astype(float) @ np.array([0.299, 0.587, 0.114])).clip(0, 255).astype(np.uint8)
        im = Image.fromarray(np.dstack([gray, gray, gray, rgba[..., 3]]), 'RGBA')
        save_png(im.resize((SIZE, SIZE), Image.LANCZOS), os.path.join(out, f))
        done.append(name)
    return done


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('--src', default=os.path.join(ROOT, 'assets-src'))
    ap.add_argument('--out', default=os.path.join(ROOT, 'assets'))
    a = ap.parse_args()
    em = build_emblems(os.path.join(a.src, 'emblem'), os.path.join(a.out, 'emblem'))
    print(f'문장 부품 {len(em)}장: {", ".join(em) or "없음"}')


if __name__ == '__main__':
    main()
