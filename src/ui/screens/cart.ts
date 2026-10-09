// 짐칸 탭 (기획서 "화면 구성 - 직접 해 본 뒤 고친 것 (0.1.2)"): 수레 판, 창고 판, 식량. "무엇을 실었나".
import { ECONOMY } from '../../sim/constants';
import { count, GOODS, type CartPieceView, type PlayerView } from '../../sim/economy';
import { euro } from '../../sim/josa';
import { mountCartBoard } from '../cartBoard';
import { freshness, goodName, money } from '../format';
import type { Game } from '../game';

/** 판 위 짐 요약: "소금 6 · 목재 2" */
function piecesSummary(pieces: readonly CartPieceView[]): string {
  const by = new Map<string, number>();
  for (const p of pieces) if (p.qty) by.set(p.good, (by.get(p.good) ?? 0) + p.qty);
  return [...by].map(([g, n]) => `${goodName(g as (typeof GOODS)[number])} ${n}`).join(' · ') || '빈 판';
}

export function renderCart(el: HTMLElement, game: Game, v: PlayerView): void {
  const townName = (id: number) => game.map.towns[id]!.name;
  const rate = ECONOMY.spoilRate[v.season];

  // 내 수레: 물품마다 한 줄. 상하는 물건은 가장 먼저 상하는 묶음의 상태
  const cargo =
    GOODS.filter((g) => count(v.cargo, g) > 0)
      .map((g) => {
        const lots = v.cargo.filter((l) => l.good === g);
        const oldest = lots.reduce((a, l) => (l.age > a.age ? l : a));
        const f = freshness(oldest, rate);
        return `<li class="row"><span>${goodName(g)} ${count(v.cargo, g)}개</span><span class="chip ${f.level}">${f.text}</span></li>`;
      })
      .join('') || '<li class="muted">짐칸이 비었어요.</li>';

  // 다른 판들: 짐꾼 손수레, 두 번째 행렬 수레, 창고
  const others = [
    ...v.hires
      .filter((h) => h.board)
      .map((h) => `<li class="row"><span><b>짐꾼 ${h.name}</b> 손수레 <small class="muted">${h.board!.weight}/${h.board!.maxWeight}</small><br /><small>${piecesSummary(h.board!.pieces)}</small></span></li>`),
    ...(v.caravan
      ? [
          `<li class="row"><span><b>두 번째 행렬</b> ${v.caravan.cart.name} <small class="muted">${v.caravan.travel ? `${euro(townName(v.caravan.travel.to))} 가는 중` : townName(v.caravan.town)}</small><br /><small>${piecesSummary(v.caravan.cart.pieces)}</small></span></li>`,
        ]
      : []),
    ...v.warehouses.map(
      (w) => `<li class="row"><span><b>${townName(w.town)} 창고</b> <small class="muted">짐 ${w.count}개 · 보관료 하루 ${money(w.fee)}${w.owed ? ` · 밀린 보관료 ${money(w.owed)}` : ''}</small><br /><small>${piecesSummary(w.pieces)}</small></span></li>`,
    ),
  ].join('');

  el.innerHTML = `
    <section class="card">
      <h2>짐칸</h2>
      <div data-cart></div>
      <ul class="list">${cargo}</ul>
    </section>
    ${others ? `<section class="card"><h2>다른 짐칸</h2><ul class="list">${others}</ul></section>` : ''}`;

  mountCartBoard(el.querySelector<HTMLElement>('[data-cart]')!, game);
}
