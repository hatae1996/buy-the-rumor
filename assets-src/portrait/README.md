# 초상 파츠 원본 (1254×1254)

기획자가 그린 원본을 둔다(답 113). 이 폴더는 게임 빌드에 들어가지 않는다. 게임은 `assets/portrait/`만 읽는다.

- 이름: `assets-src/portrait/<레이어>/<파츠 id>.png` (예: `top/sweater.png`, `backHair/long.png`). 파츠 id는 `docs/reference/npc-prompts.md`의 표.
- 게임에 넣을 때: 같은 이름으로 512×512로 줄여 `assets/portrait/<레이어>/<파츠 id>.png`에 넣는다. 위치는 그대로(캔버스 전체를 줄인다, 잘라 내지 않는다).
- 모든 파츠는 같은 캔버스 크기에 같은 위치로, 투명 배경. 옷과 머리는 회색조(색은 게임이 곱한다).
