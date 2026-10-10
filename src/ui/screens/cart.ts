// 짐칸 탭 (기획서 "화면 구성 - 직접 해 본 뒤 고친 것 (0.1.2)", 0.1.6 목업): "무엇을 실었나".
// 스크롤 없이 한 화면: 제목과 무게, 수레 판(창고가 있는 마을이면 창고 판도), 고른 짐 정보판, 빈칸 정리.
// 다른 짐칸(짐꾼 손수레, 두 번째 행렬, 다른 마을 창고)은 제목 옆 단추로 여는 쪽지에. 다른 마을 창고는 내용을 감춘다.
import { type CartPieceView, type GOODS, type PlayerView } from '../../sim/economy';
import { euro } from '../../sim/josa';
import { mountCartBoard } from '../cartBoard';
import { goodName, money } from '../format';
import type { Game } from '../game';
import { openSheet } from '../sheet';

/** 판 위 짐 요약: "소금 6 · 목재 2" */
function piecesSummary(pieces: readonly CartPieceView[]): string {
  const by = new Map<string, number>();
  for (const p of pieces) if (p.qty) by.set(p.good, (by.get(p.good) ?? 0) + p.qty);
  return [...by].map(([g, n]) => `${goodName(g as (typeof GOODS)[number])} ${n}`).join(' · ') || '빈 판';
}

/** 다른 짐칸 목록 (내 수레 말고): 짐꾼 손수레, 두 번째 행렬 수레, 창고 */
function otherHolds(game: Game, v: PlayerView): string[] {
  const townName = (id: number) => game.map.towns[id]!.name;
  return [
    ...v.hires
      .filter((h) => h.board)
      .map((h) => `<li class="row"><span><b>짐꾼 ${h.name}</b> 손수레 <small class="muted">${h.board!.weight}/${h.board!.maxWeight}</small><br /><small>${piecesSummary(h.board!.pieces)}</small></span></li>`),
    ...(v.caravan
      ? [
          `<li class="row"><span><b>두 번째 행렬</b> ${v.caravan.cart.name} <small class="muted">${v.caravan.travel ? `${euro(townName(v.caravan.travel.to))} 가는 중` : townName(v.caravan.town)}</small><br /><small>${piecesSummary(v.caravan.cart.pieces)}</small></span></li>`,
        ]
      : []),
    // 다른 마을 창고는 그 마을에 가야 연다: 짐 수와 보관료만, 무엇이 들었는지는 감춘다 (지금 마을 창고는 짐칸 판에)
    ...v.warehouses
      .filter((w) => !(v.location.kind === 'town' && v.location.town === w.town))
      .map(
        (w) => `<li class="row"><span><b>${townName(w.town)} 창고</b> <small class="muted">짐 ${w.count}개 · 보관료 하루 ${money(w.fee)}${w.owed ? ` · 밀린 보관료 ${money(w.owed)}` : ''}</small><br /><small>${townName(w.town)}에 가야 열 수 있어요.</small></span></li>`,
      ),
  ];
}

export function renderCart(el: HTMLElement, game: Game, v: PlayerView): void {
  const others = otherHolds(game, v);
  el.innerHTML = `<div class="hold" data-cart></div>`;
  mountCartBoard(el.querySelector<HTMLElement>('[data-cart]')!, game, {
    others: others.length,
    openOthers: () => {
      const sheet = openSheet('다른 짐칸');
      sheet.body.innerHTML = `<ul class="list">${otherHolds(game, game.view()).join('')}</ul>`;
    },
  });
}
