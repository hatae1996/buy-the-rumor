// 내 얼굴 고르기 (0.1.7 답 130): NPC 아바타 키트 그대로. 피부, 머리, 머리색, 상의, 옷 색, 수염(그림이 오면).
// 남녀 구분 없이 그림 있는 모든 파츠를 고른다. 시작 화면과 상인 증서에서 같이 쓴다.
// 고르는 동안은 화면에서만 바꾸고, 다 고르면 부른 쪽이 명령(setFace)이나 새 판 설정으로 보낸다.
import '../parts.css';
import { CLOTH_COLORS, FACE_CLOTH, FACE_HAIR_COLORS, FACE_SKINS, faceCloth, faceParts, HAIR_COLORS, PARTS, SKINS, withCloth, withTop, type Look } from '../../sim/looks';
import { portraitHtml } from '../portrait/portrait';

/** 피부 견본 색 (베이스 그림의 볼 색에 가깝게) */
const SKIN_SWATCH: Record<string, string> = { light: '#f0d3b8', medium: '#d4a27a', deep: '#8e5b3d' };

const rgb = (c: readonly [number, number, number]) => `rgb(${c[0]},${c[1]},${c[2]})`;

function swatches(key: string, items: readonly { id: string; name: string; color: string }[], current: string | null): string {
  return `<div class="pick-row swatch-row" role="radiogroup">${items
    .map(
      (it) =>
        `<button type="button" class="pick-swatch" role="radio" aria-checked="${it.id === current}" aria-label="${it.name}" title="${it.name}" data-${key}="${it.id}" style="--sw:${it.color}"></button>`,
    )
    .join('')}</div>`;
}

function chips(key: string, items: readonly { id: string; name: string }[], current: string | null): string {
  return `<div class="pick-row" role="radiogroup">${items
    .map((it) => `<button type="button" class="pick-chip" role="radio" aria-checked="${it.id === current}" data-${key}="${it.id}">${it.name}</button>`)
    .join('')}</div>`;
}

/** 고르는 화면에 보이는 이름 (0.2.1 목업 문구) */
const LABEL: Record<string, string> = {
  '짧은 부스스한 머리': '짧은 헝클어진 머리',
  '옆머리만 남은 대머리': '옆머리만 있는 머리',
  '농민 리넨 튜닉': '리넨 튜닉',
  '모피 깃 상인 겉옷': '모피 깃 겉옷',
};

/** 파츠 이름은 그림 설명이라 길다: 쉼표·더하기 앞까지만 */
const shortName = (id: string) => {
  const n = PARTS[id]!.name.split(/[,+]/)[0]!.trim();
  return LABEL[n] ?? n;
};

export interface FaceEditor {
  get(): Look;
  set(look: Look): void;
}

/** el 안에 얼굴 고르기를 그린다. 바뀔 때마다 onChange */
export function mountFaceEditor(el: HTMLElement, initial: Look, onChange?: (look: Look) => void): FaceEditor {
  let look = initial;
  const draw = () => {
    const hairs = faceParts('hair');
    const tops = faceParts('top');
    const beards = faceParts('beard');
    el.innerHTML = `
      <div class="pick-preview face"><span class="ring-frame teal">${portraitHtml(look, 120, '내 얼굴')}</span></div>
      <section class="pick-group"><h4>피부</h4>${swatches(
        'skin',
        FACE_SKINS.map((id) => ({ id, name: SKINS[id], color: SKIN_SWATCH[id]! })),
        look.skin,
      )}</section>
      <section class="pick-group"><h4>머리 모양</h4>${chips(
        'hair',
        hairs.map((id) => ({ id, name: shortName(id) })),
        look.hair,
      )}</section>
      <section class="pick-group"><h4>머리색</h4>${swatches(
        'hair-color',
        FACE_HAIR_COLORS.map((id) => ({ id, name: HAIR_COLORS[id].name, color: rgb(HAIR_COLORS[id].rgb) })),
        look.hairColor,
      )}</section>
      <section class="pick-group"><h4>상의</h4>${chips(
        'top',
        tops.map((id) => ({ id, name: shortName(id) })),
        look.top,
      )}</section>
      <section class="pick-group"><h4>옷 색</h4>${swatches(
        'cloth',
        FACE_CLOTH.map((id) => ({ id, name: CLOTH_COLORS[id].name, color: rgb(CLOTH_COLORS[id].rgb) })),
        faceCloth(look),
      )}</section>
      <section class="pick-group"><h4>수염</h4>${
        beards.length
          ? chips('beard', [{ id: '-', name: '없음' }, ...beards.map((id) => ({ id, name: shortName(id) }))], look.beard ?? '-')
          : '<div class="pick-row"><span class="pick-chip soon">준비 중</span></div><p class="pick-note">수염 선택은 추후 추가돼요.</p>'
      }</section>`;
  };
  const change = (next: Look) => {
    look = next;
    draw();
    onChange?.(look);
  };
  el.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!b) return;
    const d = b.dataset;
    if (d.skin) change({ ...look, skin: d.skin as Look['skin'] });
    else if (d.hair) change({ ...look, hair: d.hair });
    else if (d.hairColor) change({ ...look, hairColor: d.hairColor as Look['hairColor'] });
    else if (d.top) change(withTop(look, d.top));
    else if (d.cloth) change(withCloth(look, d.cloth as Parameters<typeof withCloth>[1]));
    else if (d.beard) change({ ...look, beard: d.beard === '-' ? null : d.beard });
  });
  draw();
  return {
    get: () => look,
    set(next) {
      look = next;
      draw();
    },
  };
}
