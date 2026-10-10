# NPC 초상 파츠 그림 프롬프트

기획자가 그림 생성에 쓰는 프롬프트다(기획 0.1.5). 프롬프트마다 혼자 완성된 문장이다. 옷과 머리는 회색조로 만들고 색은 게임이 곱한다. 만든 그림은 1254×1254에서 위치를 맞춰 원본으로 보관하고, 게임에는 512로 줄여 `assets/portrait/<레이어>/<파츠 id>.png`에 넣는다.

"파츠 id" 칸은 Claude Code가 `src/sim/looks/catalog.ts`에 맞춰 채웠다(0.1.5). 그림 파일 이름은 `<파츠 id>.png`다. 예: 머리 6-뒤 → `assets/portrait/backHair/long.png`, 상의 1 → `assets/portrait/top/sweater.png`.

- **(새)**: 0.1.5에서 목록에 더한 id (`bun`, `braid`는 예전에 뒷머리 id였고 이제 앞머리 id다). 표에 없는 이전 자리표시 머리(`fringe`, `parted`, `swept`, 뒷머리 `braid`·`bun`·`nape`)는 프롬프트에 없어서 뺐다.
- **머리는 머리 모양 한 벌로 뽑는다.** 머리 6과 7은 앞 장과 뒤 장이 같은 id(`long`, `ponytail`)로 짝을 이루고, 머리 1~5는 앞 장만 있다(뒷머리 비움). 앞·뒷머리를 따로 뽑으면 꽁지머리 앞 장에 생머리 뒤 장이 붙을 수 있어서다(`HAIR_STYLES`).
- 쪽진 올림머리(`bun`)와 땋은 머리(`braid`)는 프롬프트대로 앞 장(`frontHair`) 한 장에 다 그린다. 올림머리 뭉치가 정수리 위로, 땋은 머리가 어깨 앞으로 오므로 얼굴 위 레이어로 충분하다.
- 표에 없는 레이어(얼굴·목 `round`·`oval`·`square`, 눈썹 `soft`·`thick`·`arched`, 수염 `stubble`·`mustache`·`full`, 주근깨 `freckles`, 주름 `lines`, 모자 `hood`·`kerchief`·`feltHat`·`cap`, 상의 `tunic`·`pinafore`)는 아직 프롬프트가 없다. 그림이 없는 파츠는 게임이 단색 자리표시로 그린다.
- 1254 원본은 `assets-src/portrait/<레이어>/<파츠 id>.png`에 둔다(게임 빌드에 들어가지 않는다, 답 113).

| 프롬프트 | 레이어 | 파츠 id |
| --- | --- | --- |
| 머리 1. 짧은 곱슬머리 | `frontHair` | `curly` (새) |
| 머리 2. 짧게 깎은 머리 | `frontHair` | `cropped` |
| 머리 3. 정수리가 빠진 노인 머리 | `frontHair` | `balding` (새) |
| 머리 4. 쪽진 올림머리 | `frontHair` | `bun` (새) |
| 머리 5. 한쪽 어깨로 넘긴 땋은 머리 | `frontHair` | `braid` (새) |
| 머리 6-앞. 어깨까지 오는 생머리, 앞머리 장 | `frontHair` | `long` (새) |
| 머리 6-뒤. 어깨까지 오는 생머리, 뒷머리 장 | `backHair` | `long` |
| 머리 7-앞. 목 뒤로 묶은 꽁지머리, 앞머리 장 | `frontHair` | `ponytail` (새) |
| 머리 7-뒤. 목 뒤로 묶은 꽁지머리, 뒷머리 장 | `backHair` | `ponytail` (새) |
| 상의 1. 어부: 두꺼운 털실 스웨터 (새 파츠) | `top` | `sweater` (새) |
| 상의 2. 광부: 마 셔츠 위 가죽 조끼 | `top` | `leatherVest` |
| 상의 3. 여관 주인: 앞치마 두른 셔츠 | `top` | `apron` |
| 상의 4. 도시 상인: 털깃 겉옷 (새 파츠) | `top` | `furCoat` (새) |
| 상의 5. 농부: 튜닉과 멜빵 (새 파츠) | `top` | `braces` (새) |
| 상의 6. 숄을 두른 블라우스 | `top` | `shawl` |
| 상의 7. 사냥꾼: 두건을 내린 망토 | `top` | `cloak` |
| 상의 8. 대장장이: 가죽 앞치마 (새 파츠) | `top` | `leatherApron` (새) |

## 머리 1. 짧은 곱슬머리

레이어: `frontHair`

```
A single game avatar part: short curly hair only, no face, no head, no ears, no body. Low-poly faceted 3D style with soft matte shading, like a stylized mobile game character. Front view, symmetrical. The hair sits in the upper half of a square canvas, framing an invisible oval face, with the face area left completely empty. Rendered in light neutral gray tones only, no color. Transparent background.
```

## 머리 2. 짧게 깎은 머리

레이어: `frontHair`

```
A single game avatar part: very short cropped hair only, close to the scalp, slightly uneven like cut with shears. No face, no head, no ears, no body. Low-poly faceted 3D style with soft matte shading, like a stylized mobile game character. Front view, symmetrical. The hair sits in the upper half of a square canvas, framing an invisible oval face, with the face area left completely empty. Rendered in light neutral gray tones only, no color. Transparent background.
```

## 머리 3. 정수리가 빠진 노인 머리

레이어: `frontHair`

```
A single game avatar part: an old man's balding hair only, bare crown with a thin ring of hair around the sides and back of the head above the ears. No face, no scalp skin, no ears, no body. Low-poly faceted 3D style with soft matte shading, like a stylized mobile game character. Front view, symmetrical. The hair sits in the upper half of a square canvas, with the face and scalp area left completely empty. Rendered in light neutral gray tones only, no color. Transparent background.
```

## 머리 4. 쪽진 올림머리

레이어: `frontHair`

```
A single game avatar part: hair pulled back tightly into a round bun on top of the head, with a center parting and a few loose strands near the temples. No face, no head, no ears, no body. Low-poly faceted 3D style with soft matte shading, like a stylized mobile game character. Front view. The hair sits in the upper half of a square canvas, framing an invisible oval face, with the face area left completely empty. Rendered in light neutral gray tones only, no color. Transparent background.
```

## 머리 5. 한쪽 어깨로 넘긴 땋은 머리

레이어: `frontHair`

```
A single game avatar part: hair with a side parting, gathered into one thick braid that falls forward over the left shoulder down to the chest. No face, no head, no ears, no body. Low-poly faceted 3D style with soft matte shading, like a stylized mobile game character. Front view. The hair fills the upper half of a square canvas and the braid reaches down into the lower third, with the face area left completely empty. Rendered in light neutral gray tones only, no color. Transparent background.
```

## 머리 6-앞. 어깨까지 오는 생머리, 앞머리 장

레이어: `frontHair`

```
A single game avatar part: the FRONT layer of shoulder-length straight hair only, meaning the top of the head, the side parting and the side locks that hang in front of the ears down to the jaw. No back hair, no face, no head, no ears, no body. Low-poly faceted 3D style with soft matte shading, like a stylized mobile game character. Front view. The hair sits in the upper half of a square canvas, framing an invisible oval face, with the face area left completely empty. Rendered in light neutral gray tones only, no color. Transparent background.
```

## 머리 6-뒤. 어깨까지 오는 생머리, 뒷머리 장

레이어: `backHair`

```
A single game avatar part: the BACK layer of shoulder-length straight hair only, meaning the mass of hair that would be seen behind the head and neck, falling to the shoulders. No top of head, no front locks, no face, no ears, no body. Low-poly faceted 3D style with soft matte shading, like a stylized mobile game character. Front view. Placed on a square canvas so it spans from the upper half down to shoulder level, with a large empty area in the middle where the head and neck would cover it. Rendered in light neutral gray tones only, no color. Transparent background.
```

## 머리 7-앞. 목 뒤로 묶은 꽁지머리, 앞머리 장

레이어: `frontHair`

```
A single game avatar part: the FRONT layer of hair pulled back into a low ponytail, meaning only the top of the head and the hair swept back over the ears; the ponytail itself is not visible. No face, no head, no ears, no body. Low-poly faceted 3D style with soft matte shading, like a stylized mobile game character. Front view, symmetrical. The hair sits in the upper half of a square canvas, framing an invisible oval face, with the face area left completely empty. Rendered in light neutral gray tones only, no color. Transparent background.
```

## 머리 7-뒤. 목 뒤로 묶은 꽁지머리, 뒷머리 장

레이어: `backHair`

```
A single game avatar part: the BACK layer of a low ponytail only, meaning the tied tail of hair that peeks out behind the neck on both sides and falls toward the upper back. No top of head, no face, no ears, no body. Low-poly faceted 3D style with soft matte shading, like a stylized mobile game character. Front view. Placed on a square canvas around neck height, just below the center, with an empty gap in the middle where the neck would cover it. Rendered in light neutral gray tones only, no color. Transparent background.
```

## 상의 1. 어부: 두꺼운 털실 스웨터 (새 파츠)

레이어: `top`

```
A single game avatar part: a thick hand-knitted wool fisherman's sweater with a rolled crew collar, seen as a bust from the chest up, in a medieval village setting. Clothing only: no neck, no skin, no head, no arms below the shoulders; the inside of the collar is left empty. Low-poly faceted 3D style with soft matte shading, like a stylized mobile game character. Front view, symmetrical. The garment fills the bottom third of a square canvas, with the shoulders reaching near the left and right edges. Rendered in light neutral gray tones only, no color. Transparent background.
```

## 상의 2. 광부: 마 셔츠 위 가죽 조끼

레이어: `top`

```
A single game avatar part: a rough linen shirt with a simple open collar under a sturdy laced leather vest, worn by a medieval miner, seen as a bust from the chest up. Clothing only: no neck, no skin, no head, no arms below the shoulders; the inside of the collar is left empty. Low-poly faceted 3D style with soft matte shading, like a stylized mobile game character. Front view, symmetrical. The garment fills the bottom third of a square canvas, with the shoulders reaching near the left and right edges. Rendered in light neutral gray tones only, no color. Transparent background.
```

## 상의 3. 여관 주인: 앞치마 두른 셔츠

레이어: `top`

```
A single game avatar part: a loose linen shirt with a drawstring neckline and a plain cloth apron tied high over the chest, worn by a medieval innkeeper, seen as a bust from the chest up. Clothing only: no neck, no skin, no head, no arms below the shoulders; the inside of the collar is left empty. Low-poly faceted 3D style with soft matte shading, like a stylized mobile game character. Front view, symmetrical. The garment fills the bottom third of a square canvas, with the shoulders reaching near the left and right edges. Rendered in light neutral gray tones only, no color. Transparent background.
```

## 상의 4. 도시 상인: 털깃 겉옷 (새 파츠)

레이어: `top`

```
A single game avatar part: a well-made wool merchant's coat with a wide fur-trimmed collar, wooden toggle fastenings and a leather purse strap across the chest, worn by a wealthy medieval city trader, seen as a bust from the chest up. Clothing only: no neck, no skin, no head, no arms below the shoulders; the inside of the collar is left empty. Low-poly faceted 3D style with soft matte shading, like a stylized mobile game character. Front view. The garment fills the bottom third of a square canvas, with the shoulders reaching near the left and right edges. Rendered in light neutral gray tones only, no color. Transparent background.
```

## 상의 5. 농부: 튜닉과 멜빵 (새 파츠)

레이어: `top`

```
A single game avatar part: a loose undyed farmer's tunic with a slit neckline and simple cloth suspenders over the shoulders, worn by a medieval peasant, seen as a bust from the chest up. Clothing only: no neck, no skin, no head, no arms below the shoulders; the inside of the collar is left empty. Low-poly faceted 3D style with soft matte shading, like a stylized mobile game character. Front view, symmetrical. The garment fills the bottom third of a square canvas, with the shoulders reaching near the left and right edges. Rendered in light neutral gray tones only, no color. Transparent background.
```

## 상의 6. 숄을 두른 블라우스

레이어: `top`

```
A single game avatar part: a simple long-sleeved blouse with a wide square neckline, with a knitted wool shawl draped over both shoulders and crossed at the chest, worn by a medieval village woman, seen as a bust from the chest up. Clothing only: no neck, no skin, no head, no arms below the shoulders; the inside of the collar is left empty. Low-poly faceted 3D style with soft matte shading, like a stylized mobile game character. Front view. The garment fills the bottom third of a square canvas, with the shoulders reaching near the left and right edges. Rendered in light neutral gray tones only, no color. Transparent background.
```

## 상의 7. 사냥꾼: 두건을 내린 망토

레이어: `top`

```
A single game avatar part: a hooded traveling cloak with the hood pulled down and resting in folds behind the shoulders, fastened at the chest with a round wooden clasp over a plain tunic, worn by a medieval hunter, seen as a bust from the chest up. Clothing only: no neck, no skin, no head, no arms below the shoulders; the inside of the collar is left empty. Low-poly faceted 3D style with soft matte shading, like a stylized mobile game character. Front view, symmetrical. The garment fills the bottom third of a square canvas, with the shoulders reaching near the left and right edges. Rendered in light neutral gray tones only, no color. Transparent background.
```

## 상의 8. 대장장이: 가죽 앞치마 (새 파츠)

레이어: `top`

```
A single game avatar part: a heavy leather blacksmith's apron with a neck strap, worn over a short-sleeved coarse shirt with a round neckline, seen as a bust from the chest up in a medieval setting. Clothing only: no neck, no skin, no head, no arms below the shoulders; the inside of the collar is left empty. Low-poly faceted 3D style with soft matte shading, like a stylized mobile game character. Front view, symmetrical. The garment fills the bottom third of a square canvas, with the shoulders reaching near the left and right edges. Rendered in light neutral gray tones only, no color. Transparent background.
```
