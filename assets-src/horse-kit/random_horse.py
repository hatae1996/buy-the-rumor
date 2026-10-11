"""랜덤 말 만들기.
usage: python random_horse.py            -> out/horse_01.png ~ horse_12.png + out/sheet.png
       python random_horse.py --n 30 --seed 7
"""
import argparse, os, random
import numpy as np
from PIL import Image
from horse_color import recolor_horse
from horse_pattern import apply_pattern

HERE = os.path.dirname(os.path.abspath(__file__))
COATS = [(140, 95, 60), (55, 50, 48), (165, 90, 50), (225, 222, 215), (150, 148, 145),
         (200, 170, 120), (110, 70, 45), (120, 115, 110)]
MANES = [(60, 40, 28), (30, 28, 28), (225, 205, 170), (235, 232, 225), (70, 68, 66), (35, 28, 25)]
HOOVES = [(60, 50, 45), (40, 38, 36), (70, 60, 55), (110, 105, 100)]
PATTERNS = [None, None, None, 'pinto', 'appaloosa', 'dapple', 'socks']   # 무늬 없는 말이 더 자주 나오게


def random_horse(rng):
    import glob
    bodies = sorted(glob.glob(os.path.join(HERE, 'horse_??.png')))
    p = rng.choice(bodies)
    im = np.asarray(Image.open(p))
    reg = np.asarray(Image.open(p[:-4] + '_reg.png'))
    cols = {1: rng.choice(COATS), 2: rng.choice(MANES), 3: rng.choice(HOOVES)}
    kind = rng.choice(PATTERNS)
    if kind is None:
        return Image.fromarray(recolor_horse(im, reg, cols), 'RGBA')
    pc = (238, 234, 226) if kind in ('socks', 'appaloosa') else rng.choice(COATS)
    if kind == 'appaloosa':
        cols[1], pc = (232, 228, 220), rng.choice([(80, 60, 50), (45, 42, 40), (130, 80, 48)])
    if kind == 'dapple':
        cols[1], pc = (105, 103, 101), (200, 198, 195)
    return Image.fromarray(apply_pattern(im, reg, cols, kind, pc, seed=rng.randrange(1000)), 'RGBA')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--n', type=int, default=12)
    ap.add_argument('--seed', type=int, default=None)
    a = ap.parse_args()
    rng = random.Random(a.seed)
    os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
    thumbs = []
    for i in range(a.n):
        h = random_horse(rng)
        h.save(os.path.join(HERE, 'out', 'horse_%02d.png' % (i + 1)))
        bg = Image.new('RGBA', h.size, (214, 212, 205, 255))
        thumbs.append(Image.alpha_composite(bg, h).convert('RGB').crop((300, 20, 1240, 1004)).resize((300, 314)))
    cols = 4
    sheet = Image.new('RGB', (cols * 300, ((len(thumbs) + cols - 1) // cols) * 314), (214, 212, 205))
    for i, t in enumerate(thumbs):
        sheet.paste(t, ((i % cols) * 300, (i // cols) * 314))
    sheet.save(os.path.join(HERE, 'out', 'sheet.png'))
    print('saved', len(thumbs), 'horses')
