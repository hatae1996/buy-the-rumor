import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as nd

import os
BASE = os.environ.get('AVATAR_BASE', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'base.png'))


def extract(src, out_path, kind='hair', diff_t=45):
    b = np.asarray(Image.open(BASE).convert('RGB')).astype(int)
    hi = Image.open(src).convert('RGB')
    if hi.size != (b.shape[1], b.shape[0]):
        hi = hi.resize((b.shape[1], b.shape[0]), Image.LANCZOS)
    h = np.asarray(hi).astype(int)
    P = 12
    h_orig = h
    b = np.pad(b, ((P, P), (P, P), (0, 0)), mode='edge')
    h = np.pad(h, ((P, P), (P, P), (0, 0)), mode='edge')
    d = np.abs(b - h).sum(2)
    lum = h.mean(2)
    rb = h[..., 0] - h[..., 2]
    # skin-like pixels (base skin, possibly re-shaded) are never part of a part
    R = np.maximum(h[..., 0], 1).astype(float)
    gr, br = h[..., 1] / R, h[..., 2] / R
    skin = (lum > 112) & (gr > 0.70) & (gr < 0.86) & (br > 0.45) & (br < 0.68)
    m = (d > diff_t) & ~skin
    if kind == 'hair':
        m &= lum < 150
    m = nd.binary_opening(m, iterations=2)
    lab, n = nd.label(m)
    sizes = nd.sum(m, lab, range(1, n + 1))
    keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > 2000])
    keep = nd.binary_fill_holes(nd.binary_closing(keep, iterations=2)) & ~skin
    # adaptive: drop pixels much warmer than the part's own colour (shadowed skin specks)
    med = np.median(rb[keep])
    skin_hue = rb / np.maximum(h[..., 0], 1) > 0.3
    warm = keep & (rb > max(med + 22, 35)) & skin_hue
    # only small warm blobs touching the part's outline (skin peeking through), never interior highlights
    edge = keep & ~nd.binary_erosion(keep, iterations=4)
    wl, wn = nd.label(warm)
    drop = np.zeros_like(keep)
    for i in range(1, wn + 1):
        blob = wl == i
        if blob.sum() < 3000 and (blob & edge).any():
            drop |= blob
    drop = nd.binary_dilation(drop, iterations=2) & keep
    keep &= ~drop
    keep = nd.binary_opening(keep, iterations=1)
    lab2, n2 = nd.label(keep)
    if n2:
        sz = nd.sum(keep, lab2, range(1, n2 + 1))
        keep = np.isin(lab2, [i + 1 for i, v in enumerate(sz) if v > 400])
    # close hairline gaps: grow into pixels that are plain background in the base
    bgc = np.median(b[P:P+60, P:P+60].reshape(-1, 3), 0)
    base_bg = np.abs(b - bgc).sum(2) < 25
    near_body = nd.binary_dilation(~base_bg, iterations=4)
    grow = nd.binary_dilation(keep, iterations=3) & base_bg & near_body & (np.abs(h - bgc).sum(2) > 25)
    keep = keep | grow
    ytop = None
    if kind == 'top':
        # tops: take EVERYTHING below the top of the collar that isn't background,
        # including skin seen through necklines/laces, so details survive intact
        part0 = keep.copy()
        rows = np.nonzero(keep.sum(1) > 20)[0]
        ytop = rows.min() - 24
        nonbg = np.abs(h - bgc).sum(2) > 30
        nonbg = nd.binary_opening(nonbg, iterations=1)
        yy = np.arange(h.shape[0])[:, None]
        region = nonbg & (yy >= ytop)
        lab3, n3 = nd.label(region)
        if n3:
            sz3 = nd.sum(region, lab3, range(1, n3 + 1))
            region = lab3 == (int(np.argmax(sz3)) + 1)
        keep = nd.binary_fill_holes(region)
    # rough region (only used to locate the edge band)
    keep = nd.gaussian_filter(keep.astype(float), 1.0) > 0.5
    keep = keep[P:-P, P:-P]
    d = d[P:-P, P:-P]
    rgb = h_orig.astype(float)
    # alpha from the SOURCE image's own anti-aliasing:
    #   observed = a*F + (1-a)*S, F = part colour just inside, S = colour just outside (in the same image)
    kp = np.pad(keep, 6, mode='edge')
    core = nd.binary_erosion(kp, iterations=3)[6:-6, 6:-6]
    outside = ~nd.binary_dilation(kp, iterations=3)[6:-6, 6:-6]
    band = ~core & ~outside
    i1 = nd.distance_transform_edt(~core, return_distances=False, return_indices=True)
    i2 = nd.distance_transform_edt(~outside, return_distances=False, return_indices=True)
    F = rgb[i1[0], i1[1]]
    S = rgb[i2[0], i2[1]]
    FS = F - S
    den = (FS ** 2).sum(2)
    unmix = np.clip(((rgb - S) * FS).sum(2) / np.maximum(den, 1), 0, 1)
    soft = nd.gaussian_filter(keep.astype(float), 1.0)
    a = core.astype(float)
    ok = band & (den > 35 ** 2)
    a[ok] = unmix[ok]
    a[band & ~ok] = soft[band & ~ok]
    # background showing through small gaps between strands -> transparent
    holes = (np.abs(rgb - bgc).sum(2) < 35) & base_bg[P:-P, P:-P]
    if kind == 'hair':
        holes |= rgb.mean(2) > 170
    a[holes & ~core] = 0
    if kind == 'hair':
        a[holes] = 0
        a[band & (rgb.mean(2) > 140)] = 0
    if ytop is not None:
        y0 = ytop - P
        yy = np.arange(a.shape[0])[:, None]
        ramp = np.clip((yy - y0 - 24) / 28.0, 0, 1)
        # the garment itself (as detected against the base) stays fully opaque;
        # everything else near the top (neck skin, its outline) fades into the base neck
        Rr = np.maximum(rgb[..., 0], 1)
        skinlike = (rgb.mean(2) > 90) & (rgb[..., 1] / Rr > 0.60) & (rgb[..., 1] / Rr < 0.88) & (rgb[..., 2] / Rr > 0.38) & (rgb[..., 2] / Rr < 0.72)
        garment = nd.binary_dilation(part0[P:-P, P:-P], iterations=3) & ~skinlike
        a = np.where(garment, a, a * ramp)
    a = a * 255
    rgb[~core] = F[~core]
    out = Image.fromarray(np.dstack([rgb, a]).astype('uint8'), 'RGBA')
    out.save(out_path)
    face = d[550:800, 450:800].mean()
    print(f'{out_path}: face-drift={face:.1f} coverage={keep.mean():.3f}')
    return out


if __name__ == '__main__':
    # usage: python extract.py <source.png> <out.png> <hair|top|acc>
    extract(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else 'hair')
