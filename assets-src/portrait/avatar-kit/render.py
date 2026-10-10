"""랜덤 아바타 만들기 (파이썬).
usage:
  python render.py                 -> out/random_01.png ~ random_12.png + out/sheet.png
  python render.py --n 30          -> 30장
  python render.py --seed 7        -> 같은 결과 다시 뽑기
"""
import argparse
import glob
import os
import random
import numpy as np
from PIL import Image

from regions import recolor
from brows import recolor_brows

HERE = os.path.dirname(os.path.abspath(__file__))
P = lambda *a: os.path.join(HERE, *a)

SKIN = {  # 베이스 피부에 곱할 비율 (1,1,1 = 원래 피부)
    'light': (1.00, 1.00, 1.00),
    'medium': (0.62, 0.52, 0.48),
    'deep': (0.42, 0.34, 0.31),
}
HAIR_COLORS = [(40, 34, 32), (92, 60, 40), (140, 62, 38), (205, 170, 110), (120, 110, 100), (60, 45, 35)]
GRAY_HAIR = (200, 200, 198)
CLOTH = [(110, 40, 40), (60, 80, 55), (70, 80, 120), (120, 90, 55), (90, 70, 50), (70, 60, 55),
         (150, 110, 50), (40, 70, 60), (225, 215, 195), (190, 175, 145)]


def skin_base(tone):
    b = np.asarray(Image.open(P('base.png')).convert('RGB')).astype(float)
    bg = np.median(b[:60, :60].reshape(-1, 3), 0)
    body = np.abs(b - bg).sum(2) > 25
    o = b.copy()
    o[body] = o[body] * np.array(SKIN[tone])
    return Image.fromarray(np.clip(o, 0, 255).astype('uint8'))


def layer_over(out, rgba):
    a = rgba[..., 3:4] / 255.0
    return rgba[..., :3] * a + out * (1 - a)


def layer_mul(out, path):
    if os.path.exists(path):
        out = out * (np.asarray(Image.open(path).convert('RGB')).astype(float) / 255)
    return out


def part_rgba(name, colors=None):
    im = np.asarray(Image.open(P('parts', name + '.png')).convert('RGBA'))
    regp = P('parts', name + '_reg.png')
    if colors and os.path.exists(regp):
        im = recolor(im, np.asarray(Image.open(regp)), colors)
    return im.astype(float)


def render(tone='light', hair='hair_01', top='top_07', old=False, hair_color=None, top_colors=None):
    base = skin_base(tone)
    if old:
        base = recolor_brows(base, (178, 175, 170), P('parts', 'brows_mask.png'))
    out = np.asarray(base).astype(float)
    if old:
        out = layer_mul(out, P('parts', 'age_01_mul.png'))
    if top:
        out = layer_mul(out, P('parts', top + '_mul.png'))
        out = layer_over(out, part_rgba(top, top_colors))
    if hair:
        out = layer_mul(out, P('parts', hair + '_mul.png'))
        out = layer_over(out, part_rgba(hair, {1: hair_color} if hair_color else None))
    return Image.fromarray(np.clip(out, 0, 255).astype('uint8'))


def random_avatar(rng):
    hairs = sorted(os.path.basename(p)[:-4] for p in glob.glob(P('parts', 'hair_??.png')))
    tops = sorted(os.path.basename(p)[:-4] for p in glob.glob(P('parts', 'top_??.png')))
    old = rng.random() < 0.25
    hair = rng.choice(hairs + [None] * 0)
    hc = GRAY_HAIR if old else rng.choice(HAIR_COLORS)
    top = rng.choice(tops)
    tc = None
    if rng.random() < 0.6:   # 60%는 옷 색도 랜덤
        tc = {1: rng.choice(CLOTH), 2: rng.choice(CLOTH), 3: rng.choice(CLOTH)}
    return render(rng.choice(list(SKIN)), hair, top, old, hc, tc)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--n', type=int, default=12)
    ap.add_argument('--seed', type=int, default=None)
    args = ap.parse_args()
    rng = random.Random(args.seed)
    os.makedirs(P('out'), exist_ok=True)
    ims = []
    for i in range(args.n):
        im = random_avatar(rng)
        im.save(P('out', 'random_%02d.png' % (i + 1)))
        ims.append(im.resize((300, 300), Image.LANCZOS))
    cols = 6
    rows = (len(ims) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * 300, rows * 300), 'white')
    for i, im in enumerate(ims):
        sheet.paste(im, ((i % cols) * 300, (i // cols) * 300))
    sheet.save(P('out', 'sheet.png'))
    print('saved', len(ims), 'avatars ->', P('out'))
