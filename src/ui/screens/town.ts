// 마을 탭 (기획서 "화면 구성", 0.0.5): "여기서 무엇을 할까". 그 마을에 있는 건물 카드만 보인다.
// 건물을 누르면 그 건물 쪽지(시장, 여관, 잡화점, 바깥, 창고, 마구간, 수레방, 작업장, 은행, 길드 회관)가 열린다.
import village from '../../../assets/ui/village.png';
import type { BuildingId } from '../../sim/growth';
import type { PlayerView } from '../../sim/economy';
import { euro } from '../../sim/josa';
import { DAY_MS, type Game } from '../game';
import { arrivalText } from '../format';
import { buildingCards, openBuilding } from './buildings';
import { openArrivalSheet } from './arrivalSheet';
import { portraitHtml } from '../portrait/portrait';
import type { Look } from '../../sim/looks';

/** 남은 식량 (0.1.2): 남은 길에 먹을 만큼 있는지 */
function foodLine(v: PlayerView, daysLeft: number): string {
  const need = Math.ceil(daysLeft) * v.food.perDay;
  const have = v.food.have;
  const people = v.food.perDay > 1 ? `${v.food.perDay}명이 ` : '';
  if (have >= need) return `<p class="muted">남은 식량 ${have} · 남은 길 ${daysLeft}일에 ${people}먹기 넉넉해요.</p>`;
  return `<p class="warn">남은 식량 ${have} · 남은 길에 ${need}이 필요해요. 떨어지면 지치고 길이 늦어져요.</p>`;
}

export interface TownScreenActions {
  /** 지금 실제 시각 (도착 예상 시각을 셈한다) */
  now: number;
  passDay: () => void;
  passApprenticeDay: () => void;
  openSettlement: () => void;
}

/** 시즌이 끝났으면 결산 카드 (다음 시즌을 시작할 때까지 날이 가지 않는다) */
function settlementCard(v: PlayerView): string {
  if (!v.settlement) return '';
  return `<section class="card pinned">
      <header class="card-head"><h2>${v.settlement.season}시즌이 끝났어요</h2></header>
      <p>마지막 장날 뒤 순위를 매겼어요. 결산을 보고 다음 시즌을 시작하세요.</p>
      <div class="btn-row"><button type="button" class="primary-btn" data-settlement>결산 보기</button></div>
    </section>`;
}

/** 견습: 지금 장면과 노상인 한마디, 하루 보내기 (대사와 연출은 나중 버전) */
function apprenticeCard(v: PlayerView, elder: Look | null): string {
  const ap = v.apprentice;
  if (!ap) return '';
  return `<section class="card pinned apprentice">
      <header class="card-head"><h2>견습 · ${ap.title}</h2><span class="badge">${ap.step} / ${ap.steps}</span></header>
      <div class="npc-line">${portraitHtml(elder, 56, '노상인')}<p>${ap.hint}</p></div>
      <div class="btn-row"><button type="button" class="secondary-btn" data-apprentice-day>하루 보내기<small>견습 마을에서만 바로 다음 날로</small></button></div>
    </section>`;
}

export function renderTown(el: HTMLElement, game: Game, v: PlayerView, act: TownScreenActions): void {
  const townName = (id: number) => game.map.towns[id]!.name;
  const place = v.location.kind === 'town' ? townName(v.location.town) : `${euro(townName(v.location.to))} 가는 길`;
  const city = v.location.kind === 'town' && game.map.towns[v.location.town]!.tier === 'city';

  let body: string;
  if (v.location.kind === 'road') {
    const { from, to, days, daysLeft } = v.location;
    const msLeft = game.msUntilArrival(daysLeft, act.now);
    // 간 만큼: 지난 날 + 오늘 하루 중 지난 몫 (견습은 날 단위로만)
    const todayDone = msLeft === null ? 0 : 1 - game.msUntilMarket(act.now) / DAY_MS;
    const pct = Math.round(Math.min(1, Math.max(0, (days - daysLeft + todayDone) / days)) * 100);
    body = `
      <section class="card travel-card">
        <div class="travel-route">
          <span class="travel-town">${townName(from)}</span>
          <span class="travel-path" aria-hidden="true">
            <span class="travel-done" style="width:${pct}%"></span>
            <span class="travel-pawn" style="left:${pct}%"></span>
          </span>
          <span class="travel-town">${townName(to)}</span>
        </div>
        <p class="travel-eta">이동 중 · ${arrivalText(msLeft, daysLeft, act.now)}</p>
        ${foodLine(v, daysLeft)}
        ${
          v.unlocks.includes('reservation')
            ? `<div class="btn-row"><button type="button" class="secondary-btn" data-arrival>도착하면 팔기<small>${
                v.reservations.some((r) => r.kind === 'onArrival') ? '예약해 둔 것이 있어요' : `${townName(to)} 첫 장날에 팔게 걸어 두기`
              }</small></button></div>`
            : ''
        }
        <p class="muted">길 위에서는 장에 신청할 수 없어요. 창고에 둔 짐은 그 마을 장날에 팔 수 있어요(장부 탭).</p>
      </section>`;
  } else {
    body = buildingCards(game, v);
    if (!v.buildings.some((b) => b.id === 'outside')) body += '<p class="muted center">자원지가 없어 원정은 못 해요.</p>';
  }

  el.innerHTML = `
    ${settlementCard(v)}
    ${apprenticeCard(v, v.apprentice ? (game.faces()?.elder ?? null) : null)}
    <div class="town-banner">
      <img src="${village}" alt="" />
      <div class="ribbon"><span>${place}</span></div>
      ${city ? '<span class="tier-badge">도시</span>' : ''}
    </div>
    ${body}
    ${v.settlement ? '' : '<button type="button" class="test-btn" data-pass-day>시험용: 장날 바로 열기</button>'}
  `;

  el.querySelectorAll<HTMLButtonElement>('[data-building]').forEach((b) =>
    b.addEventListener('click', () => openBuilding(game, b.dataset.building as BuildingId)),
  );
  el.querySelector('[data-arrival]')?.addEventListener('click', () => openArrivalSheet(game));
  el.querySelector('[data-pass-day]')?.addEventListener('click', act.passDay);
  el.querySelector('[data-settlement]')?.addEventListener('click', act.openSettlement);
  el.querySelector('[data-apprentice-day]')?.addEventListener('click', act.passApprenticeDay);
}
