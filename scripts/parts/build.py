"""문장 부품·말 그림 빌드 (0.1.7): 기획자가 뽑은 원본(assets-src/)에서 게임용 512 그림을 만든다.

    npm run parts        (= python scripts/parts/build.py)

필요한 것: pip install -r scripts/portrait/requirements.txt  (키트의 regions.py를 불러 쓴다)
프롬프트: docs/reference/emblem-horse-prompts.md

원본 (1254×1254, 없는 것은 건너뛴다):
  assets-src/emblem/shield_<모양>.png, sym_<상징>.png
      회색조, 투명 배경. 배경이 남아 있으면 모서리 색으로 지운다.
  assets-src/horse/horse_<종류>.png            (pony, draft, riding)
      갈색 털 + 짙은 갈기, 옅은 회색 배경.
  assets-src/horse/horse_<종류>_<무늬>.png      (blaze, socks)
      위 그림에 무늬만 더한 것.

만드는 것:
  assets/emblem/<이름>.png      회색조 + 투명 배경, 512. 색은 게임이 칠한다 (src/ui/emblem.ts).
  assets/horse/horse_<종류>.png      배경을 지운 몸, 512.
  assets/horse/horse_<종류>_reg.png  색 영역 지도 (키트 make_regions: 1 = 털, 2 = 갈기·꼬리, 255 = 고정), nearest로 줄인다.
  assets/horse/horse_<종류>_<무늬>.png  무늬만 (원본 몸과 다른, 밝고 색이 옅은 픽셀). 몸 위에 덮는다.

같은 원본이면 다시 돌려도 같은 그림이 나온다.
"""
import argparse
import os
import re
import sys
import tempfile

import numpy as np
from PIL import Image
from scipy import ndimage as nd

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
KIT = os.path.join(ROOT, 'assets-src', 'portrait', 'avatar-kit')
SIZE = 512

EMBLEM_RE = re.compile(r'^(shield|sym)_[a-z]+$')
HORSE_RE = re.compile(r'^horse_(pony|draft|riding)$')
MARK_RE = re.compile(r'^horse_(pony|draft|riding)_(blaze|socks)$')


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


def build_horses(src: str, out: str) -> list[str]:
    if not os.path.isdir(src):
        return []
    sys.path.insert(0, KIT)
    from regions import make_regions  # noqa: E402  키트 코드를 그대로 쓴다

    done = []
    bodies: dict[str, np.ndarray] = {}
    for f in sorted(os.listdir(src)):
        name = f[:-4]
        m = HORSE_RE.match(name)
        if not (f.endswith('.png') and m):
            continue
        rgba = cut_background(os.path.join(src, f))
        bodies[m.group(1)] = rgba
        save_png(Image.fromarray(rgba, 'RGBA').resize((SIZE, SIZE), Image.LANCZOS), os.path.join(out, f))
        with tempfile.TemporaryDirectory() as tmp:
            body = os.path.join(tmp, 'body.png')
            reg_path = os.path.join(tmp, 'reg.png')
            Image.fromarray(rgba, 'RGBA').save(body)
            reg = make_regions(body, reg_path, k=4)
        save_png(Image.fromarray(reg).resize((SIZE, SIZE), Image.NEAREST), os.path.join(out, f'{name}_reg.png'))
        done.append(name)
    for f in sorted(os.listdir(src)):
        name = f[:-4]
        m = MARK_RE.match(name)
        if not (f.endswith('.png') and m) or m.group(1) not in bodies:
            continue
        base = bodies[m.group(1)].astype(float)
        marked = np.asarray(Image.open(os.path.join(src, f)).convert('RGBA')).astype(float)
        if marked.shape != base.shape:
            print(f'  건너뜀 {f}: 크기가 몸 그림과 다르다')
            continue
        light = marked[..., :3].mean(2)
        chroma = marked[..., :3].max(2) - marked[..., :3].min(2)
        brighter = light - base[..., :3].mean(2)
        # 무늬: 몸 안에서 원본보다 많이 밝아지고 색이 옅은(흰) 곳
        mask = (base[..., 3] > 128) & (brighter > 40) & (chroma < 45) & (light > 170)
        mask = nd.binary_opening(mask, iterations=1)
        alpha = (nd.gaussian_filter(mask.astype(float), 1.2) * 255).clip(0, 255).astype(np.uint8)
        layer = np.dstack([marked[..., :3].clip(0, 255).astype(np.uint8), alpha])
        save_png(Image.fromarray(layer, 'RGBA').resize((SIZE, SIZE), Image.LANCZOS), os.path.join(out, f))
        done.append(name)
    return done


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('--src', default=os.path.join(ROOT, 'assets-src'))
    ap.add_argument('--out', default=os.path.join(ROOT, 'assets'))
    a = ap.parse_args()
    em = build_emblems(os.path.join(a.src, 'emblem'), os.path.join(a.out, 'emblem'))
    ho = build_horses(os.path.join(a.src, 'horse'), os.path.join(a.out, 'horse'))
    print(f'문장 부품 {len(em)}장: {", ".join(em) or "없음"}')
    print(f'말 그림 {len(ho)}장: {", ".join(ho) or "없음"}')


if __name__ == '__main__':
    main()
