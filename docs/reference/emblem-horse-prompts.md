# 문장 부품·말 그림 프롬프트

기획 0.1.7. 프롬프트마다 혼자 완성된 문장이다. 하나씩 그대로 붙인다.

## 만드는 방식

- **문장:** 방패 모양 그림 위에 나눔 무늬와 바탕 색은 게임 코드가 그린다(반 나누기, 띠, 십자, 체크 등은 도형이라 그림이 필요 없다). 그림이 필요한 것은 방패 모양 5장(명암 겹치기용)과 가운데 상징 10장이다. 모두 회색조로 뽑고 색은 게임이 입힌다.
- **말:** 종류마다 몸 그림 한 장(갈색 털, 짙은 갈기). 털색은 키트의 색 영역 지도 방식(`regions.py`의 `make_regions`)으로 털·갈기 영역을 나눠 게임이 바꾼다. 무늬(이마 흰 줄, 흰 발목)는 말 그림을 첨부하고 "이 그림에 무늬만 더해" 프롬프트로 뽑아 겹친다.
- 크기는 1254×1254로 뽑아 원본을 `assets-src/`에 두고, 게임에는 512로 줄인다.

## 방패 모양 (5)

### shield_heater: 전통 방패(아래가 뾰족한 다리미 모양)

```
A single heraldic shield shape: a classic heater-shaped heraldic shield with a flat top and a pointed bottom, with a plain empty face and no emblem. Low-poly faceted 3D style with soft matte shading and no outline, like a stylized cozy mobile game. Front view, centered on a square canvas, symmetrical where possible. Rendered in light neutral gray tones only, no color, so it can be tinted in the game. Transparent background, no text, no letters.
```

### shield_round: 둥근 방패

```
A single heraldic shield shape: a round heraldic shield with a slightly raised rim, with a plain empty face and no emblem. Low-poly faceted 3D style with soft matte shading and no outline, like a stylized cozy mobile game. Front view, centered on a square canvas, symmetrical where possible. Rendered in light neutral gray tones only, no color, so it can be tinted in the game. Transparent background, no text, no letters.
```

### shield_kite: 연 모양 방패(위가 둥글고 아래로 길게 뾰족)

```
A single heraldic shield shape: a tall kite-shaped heraldic shield, rounded at the top and narrowing to a long point at the bottom, with a plain empty face and no emblem. Low-poly faceted 3D style with soft matte shading and no outline, like a stylized cozy mobile game. Front view, centered on a square canvas, symmetrical where possible. Rendered in light neutral gray tones only, no color, so it can be tinted in the game. Transparent background, no text, no letters.
```

### shield_banner: 걸개 깃발(아래가 제비꼬리)

```
A single heraldic shield shape: a hanging heraldic banner with a straight top bar and a swallow-tailed bottom edge, with a plain empty face and no emblem. Low-poly faceted 3D style with soft matte shading and no outline, like a stylized cozy mobile game. Front view, centered on a square canvas, symmetrical where possible. Rendered in light neutral gray tones only, no color, so it can be tinted in the game. Transparent background, no text, no letters.
```

### shield_oval: 타원 방패(상인 길드풍)

```
A single heraldic shield shape: an upright oval heraldic cartouche shield with a smooth thin border, with a plain empty face and no emblem. Low-poly faceted 3D style with soft matte shading and no outline, like a stylized cozy mobile game. Front view, centered on a square canvas, symmetrical where possible. Rendered in light neutral gray tones only, no color, so it can be tinted in the game. Transparent background, no text, no letters.
```

## 가운데 상징 (10)

### sym_wheat: 밀 이삭 다발

```
A single heraldic emblem icon: a bundle of three wheat ears tied together, simple bold silhouette that reads well at small size. Low-poly faceted 3D style with soft matte shading and no outline, like a stylized cozy mobile game. Front view, centered on a square canvas, symmetrical where possible. Rendered in light neutral gray tones only, no color, so it can be tinted in the game. Transparent background, no text, no letters.
```

### sym_salt: 소금 결정 더미

```
A single heraldic emblem icon: a small heap of cube-shaped salt crystals, simple bold silhouette that reads well at small size. Low-poly faceted 3D style with soft matte shading and no outline, like a stylized cozy mobile game. Front view, centered on a square canvas, symmetrical where possible. Rendered in light neutral gray tones only, no color, so it can be tinted in the game. Transparent background, no text, no letters.
```

### sym_horse: 말 머리 옆모습

```
A single heraldic emblem icon: a horse head in side profile facing right, simple bold silhouette that reads well at small size. Low-poly faceted 3D style with soft matte shading and no outline, like a stylized cozy mobile game. Front view, centered on a square canvas, symmetrical where possible. Rendered in light neutral gray tones only, no color, so it can be tinted in the game. Transparent background, no text, no letters.
```

### sym_key: 열쇠

```
A single heraldic emblem icon: an old-fashioned large key standing upright, simple bold silhouette that reads well at small size. Low-poly faceted 3D style with soft matte shading and no outline, like a stylized cozy mobile game. Front view, centered on a square canvas, symmetrical where possible. Rendered in light neutral gray tones only, no color, so it can be tinted in the game. Transparent background, no text, no letters.
```

### sym_scales: 저울

```
A single heraldic emblem icon: a balance scale with two hanging pans, simple bold silhouette that reads well at small size. Low-poly faceted 3D style with soft matte shading and no outline, like a stylized cozy mobile game. Front view, centered on a square canvas, symmetrical where possible. Rendered in light neutral gray tones only, no color, so it can be tinted in the game. Transparent background, no text, no letters.
```

### sym_ship: 돛단배

```
A single heraldic emblem icon: a small single-mast sailing ship on a short wave, simple bold silhouette that reads well at small size. Low-poly faceted 3D style with soft matte shading and no outline, like a stylized cozy mobile game. Front view, centered on a square canvas, symmetrical where possible. Rendered in light neutral gray tones only, no color, so it can be tinted in the game. Transparent background, no text, no letters.
```

### sym_fish: 물고기

```
A single heraldic emblem icon: a single fish swimming to the right, simple bold silhouette that reads well at small size. Low-poly faceted 3D style with soft matte shading and no outline, like a stylized cozy mobile game. Front view, centered on a square canvas, symmetrical where possible. Rendered in light neutral gray tones only, no color, so it can be tinted in the game. Transparent background, no text, no letters.
```

### sym_hammer: 망치

```
A single heraldic emblem icon: a smith's hammer standing upright, simple bold silhouette that reads well at small size. Low-poly faceted 3D style with soft matte shading and no outline, like a stylized cozy mobile game. Front view, centered on a square canvas, symmetrical where possible. Rendered in light neutral gray tones only, no color, so it can be tinted in the game. Transparent background, no text, no letters.
```

### sym_antler: 사슴뿔

```
A single heraldic emblem icon: a pair of deer antlers, simple bold silhouette that reads well at small size. Low-poly faceted 3D style with soft matte shading and no outline, like a stylized cozy mobile game. Front view, centered on a square canvas, symmetrical where possible. Rendered in light neutral gray tones only, no color, so it can be tinted in the game. Transparent background, no text, no letters.
```

### sym_purse: 돈주머니

```
A single heraldic emblem icon: a tied leather coin purse, simple bold silhouette that reads well at small size. Low-poly faceted 3D style with soft matte shading and no outline, like a stylized cozy mobile game. Front view, centered on a square canvas, symmetrical where possible. Rendered in light neutral gray tones only, no color, so it can be tinted in the game. Transparent background, no text, no letters.
```

## 말 (3)

### horse_pony: 조랑말

```
A single horse: a small sturdy pony with short legs, a round belly and a thick shaggy mane. Low-poly faceted 3D style with soft matte shading and no outline, like a stylized cozy mobile game. Full body side view facing right, standing calmly, whole horse inside a square canvas with a little space around it. Plain warm brown coat with a darker brown mane and tail, no saddle, no bridle, no rider, no markings. Solid light gray background, no text.
```

### horse_draft: 짐말

```
A single horse: a big heavy draft horse with a broad chest, thick legs and feathered fur around the hooves. Low-poly faceted 3D style with soft matte shading and no outline, like a stylized cozy mobile game. Full body side view facing right, standing calmly, whole horse inside a square canvas with a little space around it. Plain warm brown coat with a darker brown mane and tail, no saddle, no bridle, no rider, no markings. Solid light gray background, no text.
```

### horse_riding: 빠른 말

```
A single horse: a slim fast riding horse with long legs, an elegant arched neck and a sleek body. Low-poly faceted 3D style with soft matte shading and no outline, like a stylized cozy mobile game. Full body side view facing right, standing calmly, whole horse inside a square canvas with a little space around it. Plain warm brown coat with a darker brown mane and tail, no saddle, no bridle, no rider, no markings. Solid light gray background, no text.
```

## 말 무늬 (2)

`horse_*.png`를 첨부하고 말마다 따로 뽑는다(예: `horse_pony_blaze.png`).

### mark_blaze: 이마 흰 줄

```
Using this exact image, add only a white blaze running down the middle of the face from the forehead to the nose. Do not change anything else: same horse, same pose, same position and size, same coat color, same lighting, same background. Keep the same low-poly faceted style.
```

### mark_socks: 흰 발목

```
Using this exact image, add only white socks on all four lower legs just above the hooves. Do not change anything else: same horse, same pose, same position and size, same coat color, same lighting, same background. Keep the same low-poly faceted style.
```
