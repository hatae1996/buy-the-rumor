"""마젠타 베이스에 그린 주름만 뽑아 곱하기 레이어로 저장.
usage: python extract_age.py <source.png> <out_mul.png>
"""
import sys
import os
import numpy as np
from PIL import Image
from scipy import ndimage as nd

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from extract_key import magenta_weight

src = np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(float)
_kp = os.path.join(HERE, 'base_key.png')
if not os.path.exists(_kp):
    _kp = os.path.join(HERE, '..', 'base_key.png')
key = np.asarray(Image.open(_kp).convert('RGB')).astype(float)

ms, mk = magenta_weight(src) > 0.5, magenta_weight(key) > 0.5
both = ms & mk
# silhouette check
diff = ms ^ mk
print('silhouette mismatch px:', int(nd.binary_opening(diff, iterations=2).sum()))

def bright(x):
    return np.maximum(x[..., 0], x[..., 2])

r = np.clip(bright(src) / np.maximum(bright(key), 1), 0, 1.5)
r = np.where(both, r, np.nan)
# local reference (removes slow lighting differences between the two renders)
fill = np.where(both, r, 1.0)
w = both.astype(float)
ref = nd.gaussian_filter(fill * w, 9) / np.maximum(nd.gaussian_filter(w, 9), 1e-3)
ratio = np.where(both, np.clip(fill / np.maximum(ref, 1e-3), 0, 1.05), 1.0)
dark = np.clip((1 - ratio - 0.025) / 0.975, 0, 1)
dark = nd.gaussian_filter(dark, 0.7)
dark[dark < 0.015] = 0
# keep away from silhouette edges and facial features (eyes/brows/mouth/nose tip)
feat = nd.binary_dilation(nd.binary_fill_holes(mk) & ~mk, iterations=5)
edge = ~nd.binary_erosion(both, iterations=4)
dark[feat | edge] = 0
# polygon edges / outlines of the base (jaw, nose, ears) are render differences, not wrinkles
kb = nd.gaussian_filter(bright(key), 1.0)
grad = np.hypot(nd.sobel(kb, 0), nd.sobel(kb, 1))
creases = nd.binary_dilation(grad > 60, iterations=3)
on = dark > 0.03
lab, n = nd.label(nd.binary_dilation(on, iterations=1))
if n:
    sz = nd.sum(on, lab, range(1, n + 1))
    ov = nd.sum(on & creases, lab, range(1, n + 1))
    drop = [i + 1 for i in range(n) if sz[i] < 25 or ov[i] > 0.6 * sz[i]]
    dark[np.isin(lab, drop)] = 0
mul = 1 - dark
out = np.repeat(np.clip(mul * 255, 0, 255)[..., None], 3, 2).astype('uint8')
Image.fromarray(out).save(sys.argv[2])
print('wrinkle px:', int((dark > 0.03).sum()), 'max darkening %.2f' % dark.max())
