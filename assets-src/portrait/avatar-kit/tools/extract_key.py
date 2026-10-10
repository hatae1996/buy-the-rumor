"""마젠타 베이스(base_key.png)로 뽑은 이미지에서 파츠 추출.
출력:
  <out>.png      : 파츠 (마젠타 피부는 투명)
  <out>_mul.png  : 파츠가 피부에 드리운 그림자 (곱하기 레이어, 흰색 = 변화 없음)
렌더: base(피부톤) -> mul -> part
usage: python extract_key.py <source.png> <out_prefix> <top|hair|acc>
"""
import sys
import os
import numpy as np
from PIL import Image
from scipy import ndimage as nd

HERE = os.path.dirname(os.path.abspath(__file__))
KEY = os.path.join(HERE, 'base_key.png')
if not os.path.exists(KEY):
    KEY = os.path.join(HERE, '..', 'base_key.png')


def magenta_weight(rgb):
    """1 = pure (shaded) magenta skin, 0 = anything else."""
    R, G, B = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx = np.maximum(np.maximum(R, B), 1)
    g = G / mx                      # magenta: ~0, plum ~0.27, cream ~0.9
    bal = np.abs(B - R) / mx        # magenta: ~0, plum ~0.3
    # plum cloth: g>=0.24, bal>=0.29 ; deep-shadow magenta: g<=0.16, bal<=0.18
    w = np.clip(1 - (g - 0.12) / 0.09, 0, 1) * np.clip(1 - (bal - 0.14) / 0.10, 0, 1) * np.clip((mx - 12) / 22, 0, 1)
    return w


def extract(src_path, out_prefix, kind='top'):
    key = np.asarray(Image.open(KEY).convert('RGB')).astype(float)
    im = Image.open(src_path).convert('RGB')
    if im.size != (key.shape[1], key.shape[0]):
        im = im.resize((key.shape[1], key.shape[0]), Image.LANCZOS)
    src = np.asarray(im).astype(float)
    H, W = src.shape[:2]
    bgc = np.median(key[:80, :80].reshape(-1, 3), 0)

    mw_src = magenta_weight(src)
    mw_key = magenta_weight(key)
    body_key = nd.binary_fill_holes(mw_key > 0.5)

    # the source may use its own background colour (e.g. dark navy for light hair)
    corners = np.concatenate([src[:60, :60].reshape(-1, 3), src[:60, -60:].reshape(-1, 3)])
    bgs = np.median(corners, 0)
    dbg = np.abs(src - bgs).sum(2)
    warm = (src[..., 0] - src[..., 2]) - (bgs[0] - bgs[2])
    notbg = (dbg > 26) | ((dbg > 10) & (np.abs(warm) > 5))
    changed = np.abs(src - key).sum(2) > 26
    # outside the base body: anything that isn't the source background; over the body: anything changed
    part = ((notbg & ~body_key) | (body_key & changed)) & (mw_src < 0.5)
    bgc = bgs
    part = nd.binary_opening(part, iterations=2)
    lab, n = nd.label(part)
    if n:
        sz = nd.sum(part, lab, range(1, n + 1))
        if kind == 'top':
            # the garment is the big piece touching the bottom edge
            ids = [i + 1 for i in range(n) if (lab[-3:] == i + 1).any() and sz[i] > 5000]
        else:
            ids = [i + 1 for i in range(n) if sz[i] > 300]
        part = np.isin(lab, ids)
    if kind == 'top':
        # inside the base silhouette, anything that is not magenta skin and not a face feature
        # below the garment's top edge belongs to the garment (catches cream close to the bg colour)
        rows = np.nonzero(part.sum(1) > 20)[0]
        y0 = rows.min() if len(rows) else H
        yy = np.arange(H)[:, None]
        inbody = body_key & (mw_src < 0.5) & (yy >= y0)
        part = part | (inbody & nd.binary_dilation(part, iterations=25))
    if kind != 'top':
        part = nd.binary_closing(part, iterations=2) & ((mw_src < 0.5))
    part = nd.binary_fill_holes(part | (nd.binary_fill_holes(part) & (mw_src < 0.5)))
    # skin visible through slits / openings enclosed by the garment is never part of it
    part &= ~(mw_src > 0.5)
    part = nd.binary_opening(part, iterations=1)
    if kind != 'top':
        # face features of the base (eyes, brows, mouth) are not part of hair/acc unless covered
        feat_key = nd.binary_dilation(body_key & (mw_key < 0.5), iterations=3)
        part &= ~feat_key

    # ---- edges: unmix observed = a*F + (1-a)*S, S = whatever is right outside (magenta skin or background)
    P = 6
    kp = np.pad(part, P, mode='edge')
    core = nd.binary_erosion(kp, iterations=(3 if kind != "top" else 2))[P:-P, P:-P]
    outside = ~nd.binary_dilation(kp, iterations=2)[P:-P, P:-P]
    band = ~core & ~outside
    i1 = nd.distance_transform_edt(~core, return_distances=False, return_indices=True)
    i2 = nd.distance_transform_edt(~outside, return_distances=False, return_indices=True)
    F = src[i1[0], i1[1]]
    S = src[i2[0], i2[1]]
    FS = F - S
    den = (FS ** 2).sum(2)
    a = core.astype(float)
    t = np.clip(((src - S) * FS).sum(2) / np.maximum(den, 1), 0, 1)
    ok = band & (den > 30 ** 2)
    a[ok] = t[ok]
    a[band & ~ok] = nd.gaussian_filter(part.astype(float), 0.8)[band & ~ok]
    # magenta spill: any remaining magenta-ish pixel is not part of the garment
    a *= (1 - mw_src)
    rgb = np.where(core[..., None], src, F)
    # pixels touching magenta skin: unmix observed = t*G + (1-t)*Mag, keep garment colour G, alpha <= t
    magm = mw_src > 0.5
    R_, G_, B_ = src[..., 0], src[..., 1], src[..., 2]
    mxx = np.maximum(np.maximum(R_, B_), 1)
    tinted = (G_ / mxx < 0.45) & (np.abs(B_ - R_) / mxx < 0.26)   # magenta mixed into a pixel
    # deep-shadow skin in crevices next to the skin (strongly magenta-tinted, dark) -> skin
    deep = (G_ / mxx < 0.36) & (np.abs(B_ - R_) / mxx < 0.24) & nd.binary_dilation(magm, iterations=16) & (mxx < 170)
    lab_d, nd_ = nd.label(deep)
    if nd_:
        touch = np.unique(lab_d[nd.binary_dilation(magm, iterations=2) & deep])
        deep = np.isin(lab_d, touch[touch > 0]) | (deep & nd.binary_dilation(magm, iterations=6))
    magm = magm | deep
    a = np.where(deep, 0.0, a)
    near_mag = nd.binary_dilation(magm, iterations=3) & ~magm & (a > 0)
    # does this garment legitimately contain purple-ish cloth (plum etc.)? then don't treat B>G as spill
    far = (a > 0.98) & ~nd.binary_dilation(magm, iterations=35)
    purple_cloth = ((B_ > G_ + 8) & far).sum() > 0.02 * max(far.sum(), 1)
    purp = (B_ > G_ + 8) if not purple_cloth else np.zeros_like(magm)
    clean = (a > 0.98) & ~nd.binary_dilation(magm, iterations=4) & ~((tinted | purp) & nd.binary_dilation(magm, iterations=25))
    if near_mag.any() and clean.any():
        ig = nd.distance_transform_edt(~clean, return_distances=False, return_indices=True)
        im_ = nd.distance_transform_edt(~magm, return_distances=False, return_indices=True)
        Gc = src[ig[0], ig[1]]
        Mc = src[im_[0], im_[1]]
        GM = Gc - Mc
        tt = np.clip(((src - Mc) * GM).sum(2) / np.maximum((GM ** 2).sum(2), 1), 0, 1)
        a = np.where(near_mag, np.minimum(a, tt), a)
        rgb = np.where(near_mag[..., None], Gc, rgb)
        # despill: magenta light bounced onto the garment near the skin (rope shadows, fold crevices).
        # only where the garment's own clean colour is NOT magenta-ish (so plum/purple cloth is untouched)
        zone = nd.binary_dilation(magm, iterations=26) & (a > 0) & ~near_mag
        m_ = np.minimum(rgb[..., 0], rgb[..., 2])
        spill = np.clip(m_ - rgb[..., 1] - 6, 0, None)
        gm = np.minimum(Gc[..., 0], Gc[..., 2])
        own_ok = gm <= Gc[..., 1] + 6
        fix = zone & own_ok & (spill > 0)
        # strongly tinted leftovers: take the clean garment colour, keep their darkness
        strong = zone & own_ok & (tinted | purp)
        lum = rgb.mean(2) / np.maximum(Gc.mean(2), 1)
        repl = Gc * np.clip(lum, 0.3, 1.0)[..., None]
        rgb = np.where(strong[..., None], repl, rgb)
        fix &= ~strong
        rgb = rgb.copy()
        rgb[..., 0] = np.where(fix, rgb[..., 0] - spill, rgb[..., 0])
        rgb[..., 2] = np.where(fix, rgb[..., 2] - spill, rgb[..., 2])
    if not purple_cloth:
        # final sweep: any purple cast left near the skin -> neutralise towards the garment's own hue
        z2 = nd.binary_dilation(magm, iterations=26) & (a > 0)
        lr = rgb[..., 1]
        left = z2 & (rgb[..., 2] > lr + 4) & (rgb[..., 0] > lr + 4)
        g2 = (rgb[..., 0] + lr) / 2
        rgb = rgb.copy()
        rgb[..., 2] = np.where(left, np.minimum(rgb[..., 2], lr - 4), rgb[..., 2])
        rgb[..., 0] = np.where(left, np.minimum(rgb[..., 0], lr + 22), rgb[..., 0])
    out = np.dstack([np.clip(rgb, 0, 255), np.clip(a * 255, 0, 255)]).astype('uint8')
    Image.fromarray(out, 'RGBA').save(out_prefix + '.png')

    # ---- shadow the part casts on the skin: magenta brightness ratio src / key
    mx_s = np.maximum(src[..., 0], src[..., 2])
    mx_k = np.maximum(np.maximum(key[..., 0], key[..., 2]), 1)
    ratio = np.clip(mx_s / mx_k, 0, 1)
    skin_here = (mw_src > 0.5) & (mw_key > 0.5)
    near = nd.binary_dilation(part, iterations=45)
    dark = np.where(skin_here & near, 1 - ratio, 0.0)
    # ignore small brightness differences of the re-rendered magenta, keep real cast shadows
    dark = np.clip((dark - 0.06) / 0.94, 0, 1)
    dark = nd.gaussian_filter(dark, 1.5)
    sh = 1 - dark
    # fill shadow under the anti-aliased edge from the nearest skin pixel
    sk = skin_here & near
    isk = nd.distance_transform_edt(~sk, return_distances=False, return_indices=True)
    sh_full = sh[isk[0], isk[1]]
    under = band | (part & ~core)
    sh = np.where(under & body_key, sh_full, sh)
    sh = np.where(body_key, sh, 1.0)
    mul = np.repeat(sh[..., None], 3, axis=2)
    Image.fromarray(np.clip(mul * 255, 0, 255).astype('uint8'), 'RGB').save(out_prefix + '_mul.png')

    drift = np.abs(src - key).sum(2)[450:800, 420:830].mean()
    print(f'{out_prefix}: face-drift={drift:.1f} part px={int(part.sum())} shadow px={int((sh < 0.99).sum())}')


if __name__ == '__main__':
    extract(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else 'top')
