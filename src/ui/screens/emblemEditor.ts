// 문장 고르기 (0.1.7 답 130): 방패 모양, 바탕 색, 나눔 무늬와 그 색, 가운데 상징과 그 색.
// 시작 화면과 상인 증서에서 같이 쓴다. 고르는 동안은 화면에서만 바꾼다.
import '../parts.css';
import { DIVISION_IDS, DIVISIONS, EMBLEM_COLOR_IDS, EMBLEM_COLORS, SHIELD_IDS, SHIELDS, SYMBOL_IDS, SYMBOLS, type Emblem } from '../../sim/ranking';
import { emblemSvg } from '../emblem';

function colorRow(key: string, current: string): string {
  return `<div class="pick-row swatch-row" role="radiogroup">${EMBLEM_COLOR_IDS.map(
    (id) =>
      `<button type="button" class="pick-swatch" role="radio" aria-checked="${id === current}" aria-label="${EMBLEM_COLORS[id].name}" title="${EMBLEM_COLORS[id].name}" data-${key}="${id}" style="--sw:${EMBLEM_COLORS[id].hex}"></button>`,
  ).join('')}</div>`;
}

/** 작은 문장 견본으로 고르는 줄 (지금 문장에서 그 항목만 바꾼 모양) */
function sampleRow<K extends 'shield' | 'division' | 'symbol'>(key: K, ids: readonly Emblem[K][], names: Record<string, string>, e: Emblem): string {
  return `<div class="pick-row sample-row" role="radiogroup">${ids
    .map(
      (id) =>
        `<button type="button" class="pick-sample" role="radio" aria-checked="${id === e[key]}" data-${key}="${id}"><span aria-hidden="true">${emblemSvg({ ...e, [key]: id }, 40, names[id as string]!)}</span><small>${names[id as string]}</small></button>`,
    )
    .join('')}</div>`;
}

export interface EmblemEditor {
  get(): Emblem;
  set(e: Emblem): void;
}

export function mountEmblemEditor(el: HTMLElement, initial: Emblem, onChange?: (e: Emblem) => void): EmblemEditor {
  let e = initial;
  const draw = () => {
    el.innerHTML = `
      <div class="pick-preview emblem">${emblemSvg(e, 104, '내 문장')}</div>
      <section class="pick-group"><h4>방패 모양</h4>${sampleRow('shield', SHIELD_IDS, SHIELDS, e)}</section>
      <section class="pick-group"><h4>바탕 색</h4>${colorRow('field0', e.field[0])}</section>
      <section class="pick-group"><h4>나눔 무늬</h4>${sampleRow('division', DIVISION_IDS, DIVISIONS, e)}</section>
      ${e.division === 'none' ? '' : `<section class="pick-group"><h4>무늬 색</h4>${colorRow('field1', e.field[1])}</section>`}
      <section class="pick-group"><h4>가운데 상징</h4>${sampleRow('symbol', SYMBOL_IDS, SYMBOLS, e)}</section>
      <section class="pick-group"><h4>상징 색</h4>${colorRow('symbol-color', e.symbolColor)}</section>`;
  };
  const change = (next: Emblem) => {
    e = next;
    draw();
    onChange?.(e);
  };
  el.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!b) return;
    const d = b.dataset;
    if (d.shield) change({ ...e, shield: d.shield as Emblem['shield'] });
    else if (d.division) change({ ...e, division: d.division as Emblem['division'] });
    else if (d.symbol) change({ ...e, symbol: d.symbol as Emblem['symbol'] });
    else if (d.field0) change({ ...e, field: [d.field0 as Emblem['field'][0], e.field[1]] });
    else if (d.field1) change({ ...e, field: [e.field[0], d.field1 as Emblem['field'][1]] });
    else if (d.symbolColor) change({ ...e, symbolColor: d.symbolColor as Emblem['symbolColor'] });
  });
  draw();
  return {
    get: () => e,
    set(next) {
      e = next;
      draw();
    },
  };
}
