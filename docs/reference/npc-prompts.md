# NPC 초상 파츠 프롬프트 (아바타 키트 방식)

기획 0.1.6. 키트는 `assets-src/portrait/avatar-kit/`, 만드는 법은 키트의 README.md "새 파츠 추가하는 법"을 따른다.

1. ChatGPT **새 메시지**에 `base_key.png`(마젠타 피부)를 첨부한다. 매번 원본을 새로 첨부하고 이전 결과에 이어서 편집하지 않는다.
2. 아래 프롬프트 하나를 그대로 붙인다(프롬프트마다 혼자 완성된 문장이다).
3. 받은 그림을 `sources/<파일 이름>.png`로 저장하고 추출한다: 상의는 `python tools/extract_key.py sources/top_10.png parts/top_10 top`, 머리·수염은 끝을 `hair`로. 그다음 색 영역 지도: `python -c "from regions import make_regions; make_regions('parts/top_10.png','parts/top_10_reg.png',k=5,merge_de=10)"`.
4. 밝은 파츠(크림, 흰색, 귀리색)는 프롬프트 끝에 이미 `Use a solid dark navy background.`가 붙어 있다.
5. `face-drift`가 30을 넘으면 다시 뽑는다. 어두운 피부톤에 얹어 목선을 확대해 본다.
6. 저장소 맨 위에서 `npm run portraits`를 돌려 게임용 512 그림을 다시 만들고 함께 커밋한다(`assets-src/portrait/README.md`). 아래 표의 파일 이름이면 그 직업 NPC가 바로 쓴다. 상의는 색 영역 번호 중 어느 것이 직업 색인지 `src/sim/looks/catalog.ts`의 `PARTS`에 맞춰 둔다.

수염은 머리처럼 `hair` 방식으로 뽑고, 게임에서는 상의 위·머리 아래에 겹친다. 색은 머리색을 따른다.

## 이미 있는 파츠 (키트)

| 파일 | 내용 | 쓰는 직업(초안) |
| --- | --- | --- |
| hair_01 | 짧은 부스스한 머리 | 누구나 |
| hair_02 | 어깨 길이 생머리 | 누구나 |
| hair_03 | 옆머리만 남은 대머리 | 노인, 노상인 |
| top_03 | 끈 튜닉 + 크림 셔츠 | 농부, 일꾼, 소문꾼 |
| top_04 | 끈 조끼 원피스 + 크림 블라우스 | 여관 주인, 마을 사람(여), 소문꾼 |
| top_05 | 갈색 니트 | 어부(top_13이 오기 전까지) |
| top_06 | 자주색 더블릿, 놋쇠 단추 | 도시 상인, 노상인 |
| top_07 | 농민 리넨 튜닉, 밧줄 매듭 | 농부, 나무꾼, 염장꾼 |
| top_08 | 모피 깃 상인 겉옷 | 도시 상인, 장 상인 |
| top_09 | 가죽 조끼 + 셔츠 | 사냥꾼, 광부 |
| age_01_mul | 주름(노인) | 노인 |

## 새로 뽑을 파츠

| 파일 | 종류 | 내용 | 쓰는 직업(초안) |
| --- | --- | --- | --- |
| top_10 | 상의 | 여관 주인: 앞치마 두른 셔츠 | 여관 주인 |
| top_11 | 상의 | 대장장이: 가죽 앞치마 | 대장장이 |
| top_12 | 상의 | 숄을 두른 블라우스 | 소문꾼, 마을 사람(여) |
| top_13 | 상의 | 어부: 굵은 털실 스웨터 | 어부 |
| hair_04 | 머리 | 짧게 깎은 머리 | 일꾼, 광부 |
| hair_05 | 머리 | 쪽진 올림머리 | 여관 주인, 마을 사람(여) |
| hair_06 | 머리 | 어깨 앞으로 넘긴 땋은 머리 | 마을 사람(여), 농부 |
| hair_07 | 머리 | 목 뒤로 묶은 꽁지머리 | 사냥꾼, 상인 |
| beard_01 | 수염 | 짧은 턱수염 | 어부, 대장장이, 광부 |
| beard_02 | 수염 | 콧수염 | 도시 상인, 노상인 |

## top_10: 여관 주인: 앞치마 두른 셔츠

종류: 상의 · 쓰는 직업(초안): 여관 주인

```
Using this exact image, add only a loose cream linen shirt with a gathered drawstring neckline, and a plain undyed cloth apron tied high over the chest with thin straps over the shoulders. Keep the magenta skin exactly as it is. Do not change anything else: same face, same head shape, same position and size, same lighting, same background color. Keep the same low-poly faceted style with muted earthy colors. No hood, no hat, no cape, no jewelry. Use a solid dark navy background.
```

## top_11: 대장장이: 가죽 앞치마

종류: 상의 · 쓰는 직업(초안): 대장장이

```
Using this exact image, add only a short-sleeved coarse gray-brown shirt with a round neckline, and over it a heavy dark brown leather blacksmith's apron with a leather strap around the neck and a few scorch marks. Keep the magenta skin exactly as it is. Do not change anything else: same face, same head shape, same position and size, same lighting, same background color. Keep the same low-poly faceted style with muted earthy colors. No hood, no hat, no cape, no jewelry.
```

## top_12: 숄을 두른 블라우스

종류: 상의 · 쓰는 직업(초안): 소문꾼, 마을 사람(여)

```
Using this exact image, add only a simple long-sleeved muted blue blouse with a wide square neckline, and a knitted oatmeal-colored wool shawl draped over both shoulders and crossed loosely at the chest. Keep the magenta skin exactly as it is. Do not change anything else: same face, same head shape, same position and size, same lighting, same background color. Keep the same low-poly faceted style with muted earthy colors. No hood, no hat, no cape, no jewelry. Use a solid dark navy background.
```

## top_13: 어부: 굵은 털실 스웨터

종류: 상의 · 쓰는 직업(초안): 어부

```
Using this exact image, add only a thick cable-knitted wool fisherman's sweater in muted indigo blue with a rolled crew collar. Keep the magenta skin exactly as it is. Do not change anything else: same face, same head shape, same position and size, same lighting, same background color. Keep the same low-poly faceted style with muted earthy colors. No hood, no hat, no cape, no jewelry.
```

## hair_04: 짧게 깎은 머리

종류: 머리 · 쓰는 직업(초안): 일꾼, 광부

```
Using this exact image, add only very short dark brown cropped hair close to the scalp, slightly uneven as if cut with shears. Keep the magenta skin exactly as it is. Do not change anything else: same face, same head shape, same position and size, same lighting, same background color. Keep the same low-poly faceted style with muted earthy colors. No hood, no hat, no cape, no jewelry.
```

## hair_05: 쪽진 올림머리

종류: 머리 · 쓰는 직업(초안): 여관 주인, 마을 사람(여)

```
Using this exact image, add only dark brown hair with a center parting, pulled back tightly into a round bun on top of the head, with a few loose strands near the temples. Keep the magenta skin exactly as it is. Do not change anything else: same face, same head shape, same position and size, same lighting, same background color. Keep the same low-poly faceted style with muted earthy colors. No hood, no hat, no cape, no jewelry.
```

## hair_06: 어깨 앞으로 넘긴 땋은 머리

종류: 머리 · 쓰는 직업(초안): 마을 사람(여), 농부

```
Using this exact image, add only dark brown hair with a side parting, gathered into one thick braid that falls forward over the left shoulder down to the chest. Keep the magenta skin exactly as it is. Do not change anything else: same face, same head shape, same position and size, same lighting, same background color. Keep the same low-poly faceted style with muted earthy colors. No hood, no hat, no cape, no jewelry.
```

## hair_07: 목 뒤로 묶은 꽁지머리

종류: 머리 · 쓰는 직업(초안): 사냥꾼, 상인

```
Using this exact image, add only dark brown hair swept back over the ears and tied into a low ponytail at the nape of the neck, with the ponytail barely visible behind the neck. Keep the magenta skin exactly as it is. Do not change anything else: same face, same head shape, same position and size, same lighting, same background color. Keep the same low-poly faceted style with muted earthy colors. No hood, no hat, no cape, no jewelry.
```

## beard_01: 짧은 턱수염

종류: 수염 · 쓰는 직업(초안): 어부, 대장장이, 광부

```
Using this exact image, add only a short full dark brown beard along the jaw and chin, connected to a short mustache, no hair on the head. Keep the magenta skin exactly as it is. Do not change anything else: same face, same head shape, same position and size, same lighting, same background color. Keep the same low-poly faceted style with muted earthy colors. No hood, no hat, no cape, no jewelry.
```

## beard_02: 콧수염

종류: 수염 · 쓰는 직업(초안): 도시 상인, 노상인

```
Using this exact image, add only a neat dark brown mustache with slightly curled ends and no beard, no hair on the head. Keep the magenta skin exactly as it is. Do not change anything else: same face, same head shape, same position and size, same lighting, same background color. Keep the same low-poly faceted style with muted earthy colors. No hood, no hat, no cape, no jewelry.
```
