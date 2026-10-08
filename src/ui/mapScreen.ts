// 지도 탭: 내 말의 위치를 경제 상태에서 그리고, 마을을 누르면 이동 명령을 보낸다.
// Three.js가 커서 이 탭을 처음 열 때 불러온다.
import './mapScreen.css';
import { ECONOMY } from '../sim/constants';
import { euro } from '../sim/josa';
import { findRoute, townTravelDays } from '../sim/worldgen';
import { MapView, PAWN_COLORS, type PawnSpec } from '../view3d';
import { agoText, ERROR_TEXT, money } from './format';
import type { Game } from './game';
import { openSheet } from './sheet';

export interface MapScreen {
  setActive(active: boolean): void;
  render(): void;
}

export function mountMapScreen(container: HTMLElement, game: Game): MapScreen {
  const status = document.createElement('p');
  status.className = 'map-status';
  status.setAttribute('role', 'status');

  let view: MapView;
  try {
    view = new MapView(container, { onTownTap: (id) => askTravel(id) });
  } catch {
    // WebGL을 못 쓰는 경우 (아주 오래된 기기, 메모리 부족)
    container.innerHTML = '<div class="map-error">지도를 그리지 못했어요. 앱을 다시 열어 보세요.</div>';
    return { setActive: () => {}, render: () => {} };
  }
  container.appendChild(status);
  view.setWorld(game.map);
  const name = (id: number) => game.map.towns[id]!.name;
  /** 떠나는 순간에는 상태가 먼저 바뀌어도 말을 순간이동시키지 않고 걸어가게 한다 */
  let departing = false;

  /** 내 말이 서 있는 칸: 마을이면 마을 칸, 길 위면 간 날만큼 경로를 따라간 칸 */
  function myTile(): { tile: number; route: number[] | null } {
    const v = game.view();
    if (v.location.kind === 'town') return { tile: game.map.towns[v.location.town]!.tile, route: null };
    const { from, to, days, daysLeft } = v.location;
    const route = findRoute(game.map, from, to, v.season, new Set(v.roads.blocked))?.tiles ?? [game.map.towns[from]!.tile];
    // 떠난 날에도 마을 밖 첫 칸에 서서 길을 나섰다는 게 보이게 한다
    const inner = Math.max(1, route.length - 2);
    const i = Math.min(route.length - 1, 1 + Math.floor(((days - daysLeft) / days) * inner));
    return { tile: route[i]!, route };
  }

  function render() {
    const v = game.view();
    view.setSeason(v.season);
    if (!departing) {
      const me: PawnSpec = { key: 'me', color: PAWN_COLORS[0], tile: myTile().tile, slot: 0 };
      view.setPawns([me]);
    }
    status.textContent =
      v.location.kind === 'town'
        ? `${name(v.location.town)}에 있어요. 다른 마을을 누르면 떠날 수 있어요.`
        : `${euro(name(v.location.to))} 가는 길 · ${v.location.daysLeft}일 남았어요.`;
  }

  function askTravel(to: number) {
    const v = game.view();
    if (v.location.kind === 'road') {
      status.textContent = '길 위에서는 다른 곳으로 갈 수 없어요. 도착하고 나서 떠나세요.';
      return;
    }
    const here = v.location.town;
    if (to === here) {
      status.textContent = `${name(here)}에 있어요.`;
      return;
    }
    // 신문에 실린 막힌 길은 돌아가고, 산적 길목에는 통행세를 낸다
    const blocked = new Set(v.roads.blocked);
    const days = townTravelDays(game.map, v.season, blocked)[here]![to]!;
    const usual = townTravelDays(game.map, v.season)[here]![to]!;
    const toll = (v.roads.tolls[here] ?? 0) + (v.roads.tolls[to] ?? 0);
    const fee = days * ECONOMY.player.travelFeePerDay + toll;
    const mem = v.memory[to];
    const city = game.map.towns[to]!.tier === 'city';
    const sheet = openSheet(`${euro(name(to))} 떠날까요?`);
    sheet.body.innerHTML = `
      <p><b>${days}일</b> 걸려요. 여비 <b>${money(fee)}</b>.</p>
      ${days > usual ? `<p class="warn">길이 막혀 돌아가요. 보통은 ${usual}일 걸려요.</p>` : ''}
      ${toll > 0 ? `<p class="warn">산적이 있는 길목이라 여비에 통행세 ${money(toll)} 포함이에요.</p>` : ''}
      ${city ? '<p class="muted">길이 모이는 도시예요. 사람과 돈이 많아 도구, 염장 식품, 가죽을 비싸게 산다고 해요.</p>' : ''}
      <p class="muted">${mem ? `${agoText(v.day, mem.day)} 본 시세를 기억하고 있어요. 지금은 달라졌을 수 있어요.` : '가 본 적 없는 마을이에요. 시세를 몰라요.'}</p>
      ${v.orders.length ? `<p class="warn">이 마을에 낸 신청 ${v.orders.length}개는 거둬요 (맡긴 돈과 짐은 돌려받아요).</p>` : ''}
      <p class="error" data-error hidden></p>
      <button type="button" class="primary-btn" data-go>떠나기</button>`;
    sheet.body.querySelector('[data-go]')!.addEventListener('click', () => {
      departing = true;
      const r = game.dispatch({ type: 'travel', to });
      departing = false;
      if (r.ok) {
        sheet.close();
        // 마을에서 길 위 첫 칸으로 걸어 나간다
        const target = myTile();
        const i = target.route?.indexOf(target.tile) ?? -1;
        if (target.route && i > 0) void view.animatePawn('me', target.route.slice(0, i + 1), 0);
        else render();
      } else {
        render();
        const err = sheet.body.querySelector<HTMLElement>('[data-error]')!;
        err.textContent = ERROR_TEXT[r.error];
        err.hidden = false;
      }
    });
  }

  render();
  return { setActive: (a) => view.setActive(a), render };
}
