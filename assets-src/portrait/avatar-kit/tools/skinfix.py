"""상의를 두 장으로 나눈다.
  top_XX.png      : 옷감만 (목선 안쪽 피부·끈·그림자는 투명)
  top_XX_mul.png  : 목선 안쪽을 '곱하기(multiply)' 비율로 저장한 레이어 (그 외 영역은 흰색 = 변화 없음)
렌더 순서: base(피부톤) -> mul(곱하기) -> top -> hair -> acc
피부톤을 바꿔도 목선 안의 피부·그림자·끈이 새 피부색을 따라간다.
usage: python skinfix.py <top_extracted.png> <source.png> <base.png> <out_top.png> <out_mul.png>
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd


def ratios(rgb):
    R = np.maximum(rgb[..., 0], 1)
    return rgb[..., 1] / R, rgb[..., 2] / R, rgb.mean(2)


def fix(top_path, src_path, base_path, out_top, out_mul):
    top = np.asarray(Image.open(top_path).convert('RGBA')).astype(float)
    src = np.asarray(Image.open(src_path).convert('RGB')).astype(float)
    base = np.asarray(Image.open(base_path).convert('RGB')).astype(float)
    a0 = top[..., 3] / 255
    inside = a0 > 0.02
    gr, br, L = ratios(src)

    # confident, well-lit neck/chest skin
    strict = inside & (L > 125) & (gr > 0.68) & (gr < 0.86) & (br > 0.45) & (br < 0.68)
    strict = nd.binary_opening(strict, iterations=1)
    lab, n = nd.label(strict)
    if n:
        sz = nd.sum(strict, lab, range(1, n + 1))
        strict = np.isin(lab, [i + 1 for i, v in enumerate(sz) if v > 150])
    # real neck skin always reaches the top edge of the garment layer
    rows = np.nonzero(inside.sum(1) > 20)[0]
    y0 = rows.min() if len(rows) else 0
    lab, n = nd.label(strict)
    top_ids = np.unique(lab[y0:y0 + 40][lab[y0:y0 + 40] > 0])
    strict = np.isin(lab, top_ids)

    # neckline region: everything skin-hued (incl. dark shadow, laces, grommet holes) connected to it
    hue = (gr > 0.50) & (gr < 0.845) & (br > 0.20) & (br < 0.665)
    # same lighting as the base, so skin (lit or shadowed) and laces darken the base WITHOUT
    # turning bluer/greener; fabric (brown knit, cream, navy, green) shifts towards blue/green
    r = src / np.maximum(base, 1)
    warmer = (r[..., 1] <= r[..., 0] + 0.04) & (r[..., 2] <= r[..., 0] + 0.04) & (r[..., 0] > 0.35)
    cand = inside & hue & warmer & nd.binary_dilation(strict, iterations=120)
    neck = nd.binary_propagation(strict, mask=cand | strict)
    neck = nd.binary_fill_holes(neck) & inside
    neck = nd.binary_opening(neck, iterations=1) | strict

    garment = inside & ~nd.binary_dilation(neck, iterations=1)
    gcore = nd.binary_erosion(garment, iterations=1)
    ncore = nd.binary_erosion(neck, iterations=1)
    band = inside & ~gcore & ~ncore & nd.binary_dilation(neck, iterations=2)
    gcore = gcore | (inside & ~ncore & ~band)

    ig = nd.distance_transform_edt(~gcore, return_distances=False, return_indices=True)
    inn = nd.distance_transform_edt(~ncore, return_distances=False, return_indices=True)
    G = top[..., :3][ig[0], ig[1]]
    Sk = src[inn[0], inn[1]]
    GS = G - Sk
    den = (GS ** 2).sum(2)
    t = np.clip(((src - Sk) * GS).sum(2) / np.maximum(den, 1), 0, 1)
    t[den < 30 ** 2] = 0.5

    # garment layer
    gw = np.zeros_like(a0)
    gw[gcore] = 1.0
    gw[band] = t[band]
    gw *= a0
    # cracks inside the garment (alpha < 1 away from the silhouette) -> solid
    sil = nd.binary_fill_holes(inside)
    interior = nd.binary_erosion(np.pad(sil, 4, mode='edge'), iterations=3)[4:-4, 4:-4]
    solid = interior & ~band & ~ncore
    gw[solid] = 1.0
    col = np.where(band[..., None], G, top[..., :3])
    out_t = np.dstack([np.clip(col, 0, 255), np.clip(gw * 255, 0, 255)]).astype('uint8')
    Image.fromarray(out_t, 'RGBA').save(out_top)

    # multiply layer: how the source darkens the base skin inside the neckline
    M = np.clip(src / np.maximum(base, 1), 0, 1)
    Mb = np.clip(Sk / np.maximum(base, 1), 0, 1)      # band: use the skin side only
    M = np.where(band[..., None], Mb, M)
    cov = np.where(ncore | band, 1.0, 0.0) * np.clip(a0 * 4, 0, 1)
    mul = 1 - cov[..., None] * (1 - M)
    Image.fromarray(np.clip(mul * 255, 0, 255).astype('uint8'), 'RGB').save(out_mul)
    print(out_top, 'neck px', int(neck.sum()))


def compose(base_img, layers):
    """base_img: PIL image. layers: list of ('mul', path) or ('over', path)."""
    out = np.asarray(base_img.convert('RGB')).astype(float)
    for kind, p in layers:
        if kind == 'mul':
            out = out * (np.asarray(Image.open(p).convert('RGB')).astype(float) / 255)
        else:
            im = np.asarray(Image.open(p).convert('RGBA')).astype(float)
            a = im[..., 3:4] / 255
            out = im[..., :3] * a + out * (1 - a)
    return Image.fromarray(np.clip(out, 0, 255).astype('uint8'))


if __name__ == '__main__':
    fix(*sys.argv[1:6])
