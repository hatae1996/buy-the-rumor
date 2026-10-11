"""마젠타 배경 위의 말 이미지 -> 투명 PNG + 색 영역 지도.
영역: 1 = 몸(털), 2 = 갈기·꼬리(파란색으로 그린 부분), 3 = 발굽, 255 = 고정(눈·콧구멍·입)
usage: python extract_horse.py <source.png> <out_prefix>
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd

src_path, out = sys.argv[1], sys.argv[2]
src = np.asarray(Image.open(src_path).convert('RGB')).astype(float)
H, W = src.shape[:2]
R, G, B = src[..., 0], src[..., 1], src[..., 2]
mx = np.maximum(np.maximum(R, B), 1)

# ---- background (magenta) weight
g = G / mx
bal = np.abs(B - R) / mx
mag = np.clip(1 - (g - 0.10) / 0.12, 0, 1) * np.clip(1 - (bal - 0.12) / 0.12, 0, 1) * (mx > 60)
fg = nd.binary_opening(mag < 0.5, iterations=2)
lab, n = nd.label(fg)
sz = nd.sum(fg, lab, range(1, n + 1))
fg = lab == (np.argmax(sz) + 1)
# keep separate pieces that are big (tail tips etc.)
fg |= np.isin(lab, [i + 1 for i, v in enumerate(sz) if v > 400])
fg = nd.binary_fill_holes(fg)

# ---- edge alpha: unmix observed = a*F + (1-a)*M
core = nd.binary_erosion(fg, iterations=2)
outside = ~nd.binary_dilation(fg, iterations=2)
band = ~core & ~outside
i1 = nd.distance_transform_edt(~core, return_distances=False, return_indices=True)
i2 = nd.distance_transform_edt(~outside, return_distances=False, return_indices=True)
F = src[i1[0], i1[1]]
M = src[i2[0], i2[1]]
FM = F - M
t = np.clip(((src - M) * FM).sum(2) / np.maximum((FM ** 2).sum(2), 1), 0, 1)
a = core.astype(float)
a[band] = t[band]
rgb = np.where(core[..., None], src, F)          # edge pixels take the clean inner colour (no pink fringe)

# ---- regions
r_, g_, b_ = rgb[..., 0], rgb[..., 1], rgb[..., 2]
L = rgb.mean(2)
blue = (b_ > r_ + 40) & (b_ > g_ + 20)
blue = nd.binary_closing(nd.binary_opening(blue, iterations=1), iterations=2) & (a > 0)
reg = np.zeros((H, W), np.uint8)
reg[a > 0] = 1
reg[blue] = 2
# hooves: dark grey band at the bottom of each leg; everything below its top edge in that leg is hoof
rows = np.nonzero((a > 0.5).sum(1) > 0)[0]
ybot = rows.max()
yy = np.arange(H)[:, None]
hoof = (a > 0.5) & ~blue & (L < 112) & (yy > ybot - 80)
hoof = nd.binary_opening(hoof, iterations=2)
lab_h, nh = nd.label(hoof)
sz_h = nd.sum(hoof, lab_h, range(1, nh + 1)) if nh else []
hoof = np.isin(lab_h, [i + 1 for i, v in enumerate(sz_h) if v > 300])
filled = np.zeros_like(hoof)
from scipy.signal import medfilt
lh, nhh = nd.label(hoof)
for k in range(1, nhh + 1):
    comp = lh == k
    cols = np.nonzero(comp.any(0))[0]
    tops = np.array([np.nonzero(comp[:, x])[0].min() for x in cols], float)
    # smooth the hoof top line (removes bumps where pastern shadow was caught); follow the lower envelope
    # hoof top = the strongest light->dark step near the rough top (the polygon edge between leg and hoof)
    Ls = nd.gaussian_filter(L, 0.8)
    newt = []
    for x, t0 in zip(cols, tops):
        t0 = int(t0)
        best, by = 0.0, t0
        for y in range(max(t0 - 25, 3), min(t0 + 25, H - 4)):
            if a[y - 3, x] < 0.5:      # above is background: the hoof starts where the leg starts
                continue
            d = Ls[y - 3:y, x].mean() - Ls[y:y + 3, x].mean()
            if d > best:
                best, by = d, y
        newt.append(by if best > 8 else t0)
    tops = np.array(newt, float)
    bots = np.array([np.nonzero(a[:, x] > 0.5)[0].max() for x in cols], float)
    hgt = bots - tops
    hmed = np.median(hgt)
    tops = np.where(hgt > hmed * 1.2, bots - hmed, tops)     # columns where shadow above the hoof was caught
    tops = medfilt(tops, 9 if len(tops) > 9 else 1)
    for x, t0 in zip(cols, tops):
        filled[int(round(t0)):, x] = True
hoof = nd.binary_opening(nd.binary_closing(filled, iterations=3), iterations=2) & (a > 0) & ~blue
reg[hoof] = 3
# fixed details: only the eye (a dark blob that contains a bright highlight)
dark = (L < 55) & (a > 0.5) & ~blue
dl, dn = nd.label(nd.binary_dilation(dark, iterations=2))
for i in range(1, dn + 1):
    blob = dl == i
    hull = nd.binary_fill_holes(nd.binary_dilation(blob, iterations=3))
    if blob.sum() > 150 and ((L > 200) & hull).any():
        darkp = hull & (a > 0) & (L < 90)
        inner = nd.binary_fill_holes(nd.binary_closing(darkp, iterations=2))   # highlight inside the pupil only
        reg[(darkp | (inner & (L > 200))) & (a > 0)] = 255
# small leftovers between regions -> nearest
for c in (1, 2, 3):
    m = reg == c
    lb, nb = nd.label(m)
    if nb:
        s2 = nd.sum(m, lb, range(1, nb + 1))
        reg[np.isin(lb, [i + 1 for i, v in enumerate(s2) if v < 40])] = 0
need = (a > 0) & (reg == 0)
have = reg > 0
idx = nd.distance_transform_edt(~have, return_distances=False, return_indices=True)
reg[need] = reg[idx[0], idx[1]][need]

Image.fromarray(np.dstack([np.clip(rgb, 0, 255), np.clip(a * 255, 0, 255)]).astype('uint8'), 'RGBA').save(out + '.png')
Image.fromarray(reg).save(out + '_reg.png')
print(out, {int(c): int((reg == c).sum()) for c in (1, 2, 3, 255)})
