// 지도 탭 (기획서 "화면 구성 - 지도 탭", 0.0.5): "어디로 갈까". 내 행렬과 두 번째 행렬의 말을 그리고,
// 마을을 누르면 마을 정보 카드(이동 시간, 아는 시세, 들은 특색, 건물, 여기로 가기), 행렬 단추로 지시서를 고친다.
// Three.js가 커서 이 탭을 처음 열 때 불러온다.
import './mapScreen.css';
import { ECONOMY } from '../sim/constants';
import { euro } from '../sim/josa';
import { findRoute } from '../sim/worldgen';
import { MapView, PAWN_COLORS, PAWN_SLOTS, type PawnSpec } from '../view3d';
import { agoText, ERROR_TEXT, money } from './format';
import type { Game } from './game';
import type { PlayerView } from '../sim/economy';
import { openSheet } from './sheet';
import { openCaravanSheet } from './screens/caravanSheet';

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
    view = new MapView(container, { onTownTap: (id) => openTownCard(id) });
  } catch {
    // WebGL을 못 쓰는 경우 (아주 오래된 기기, 메모리 부족)
    container.innerHTML = '<div class="map-error">지도를 그리지 못했어요. 앱을 다시 열어 보세요.</div>';
    return { setActive: () => {}, render: () => {} };
  }
  container.appendChild(status);
  const caravanBtn = document.createElement('button');
  caravanBtn.type = 'button';
  caravanBtn.className = 'map-caravan-btn';
  caravanBtn.textContent = '두 번째 행렬';
  caravanBtn.addEventListener('click', () => openCaravanSheet(game));
  container.appendChild(caravanBtn);
  view.setWorld(game.map);
  const name = (id: number) => game.map.towns[id]!.name;
  /** 떠나는 순간에는 상태가 먼저 바뀌어도 말을 순간이동시키지 않고 걸어가게 한다 */
  let departing = false;

  /** 내 말이 서 있는 칸: 마을이면 마을 칸, 길 위면 간 날만큼 경로를 따라간 칸 */
  function myTile(): { tile: number; route: number[] | null } {
    const v = game.view();
    return tileOf(v.location, v);
  }

  function tileOf(loc: PlayerView['location'], v: PlayerView): { tile: number; route: number[] | null } {
    if (loc.kind === 'town') return { tile: game.map.towns[loc.town]!.tile, route: null };
    const { from, to, days, daysLeft } = loc;
    const route = findRoute(game.map, from, to, v.season, new Set(v.roads.blocked))?.tiles ?? [game.map.towns[from]!.tile];
    // 떠난 날에도 마을 밖 첫 칸에 서서 길을 나섰다는 게 보이게 한다
    const inner = Math.max(1, route.length - 2);
    const i = Math.min(route.length - 1, 1 + Math.floor(((days - daysLeft) / days) * inner));
    return { tile: route[i]!, route };
  }

  /** 두 번째 행렬 말이 서 있는 칸 */
  function caravanTile(): number | null {
    const c = game.view().caravan;
    if (!c) return null;
    if (!c.travel) return game.map.towns[c.town]!.tile;
    const v = game.view();
    const route = findRoute(game.map, c.travel.from, c.travel.to, v.season, new Set(v.roads.blocked))?.tiles ?? [game.map.towns[c.travel.from]!.tile];
    return route[Math.max(1, Math.floor(route.length / 2))] ?? route[0]!;
  }

  function render() {
    const v = game.view();
    view.setSeason(v.season);
    if (!departing) {
      const me: PawnSpec = { key: 'me', color: PAWN_COLORS[0], tile: myTile().tile, slot: 0 };
      const ct = caravanTile();
      const pawns = [me];
      if (ct !== null) pawns.push({ key: 'caravan', color: PAWN_COLORS[1], tile: ct, slot: ct === me.tile ? 1 : 0 });
      // 다른 상단 말: 작게, 칸마다 빈 자리부터 (자리가 다 차면 더 그리지 않는다)
      const used = new Map<number, number>();
      for (const p of pawns) used.set(p.tile, Math.max(used.get(p.tile) ?? 0, p.slot + 1));
      v.rivals.forEach((r, i) => {
        const tile = tileOf(r.location, v).tile;
        const slot = used.get(tile) ?? 0;
        if (slot >= PAWN_SLOTS.length) return;
        used.set(tile, slot + 1);
        pawns.push({ key: `rival:${r.id}`, color: i % 2 ? PAWN_COLORS[3] : PAWN_COLORS[2], tile, slot, scale: 0.75 });
      });
      view.setPawns(pawns);
    }
    caravanBtn.hidden = !v.caravan && !v.hires.some((h) => h.role === 'carter');
    status.textContent =
      v.location.kind === 'town'
        ? `${name(v.location.town)}에 있어요. 다른 마을을 누르면 떠날 수 있어요.`
        : `${euro(name(v.location.to))} 가는 길 · ${v.location.daysLeft}일 남았어요.`;
  }

  /** 마을 정보 카드: 이동 시간, 아는 시세, 들은 특색, 건물, 여기로 가기 */
  function openTownCard(to: number) {
    const v = game.view();
    const here = v.location.kind === 'town' ? v.location.town : null;
    const traits = v.knownTraits[to] ?? [];
    const buildings = v.knownBuildings[to];
    const info = `
      ${traits.length ? `<p>들은 특색: ${traits.map((t) => `${t.name}${t.confirmed ? '' : ' (소문)'}`).join(', ')}</p>` : ''}
      <p class="muted">${buildings ? `건물: ${buildings.map((b) => b.name).join(', ')}` : '가 본 적 없는 마을이라 건물을 몰라요.'}</p>`;
    if (here === null || to === here) {
      const sheet = openSheet(name(to));
      sheet.body.innerHTML = `${to === here ? '<p>지금 여기 있어요.</p>' : '<p class="muted">길 위에서는 다른 곳으로 갈 수 없어요. 도착하고 나서 떠나세요.</p>'}${info}`;
      return;
    }
    // 신문에 실린 막힌 길은 돌아가고, 산적 길목에는 통행세를 낸다
    // 말이 있으면 말 걸음으로 (막힌 길은 돌아간다)
    const days = v.travel.days[to]!;
    const usual = v.travel.usual[to]!;
    const toll = (v.roads.tolls[here] ?? 0) + (v.roads.tolls[to] ?? 0);
    const fee = days * ECONOMY.player.travelFeePerDay + toll;
    const mem = v.memory[to];
    const city = game.map.towns[to]!.tier === 'city';
    const sheet = openSheet(name(to));
    sheet.body.innerHTML = `
      <p><b>${days}일</b> 걸려요. 여비 <b>${money(fee)}</b>.</p>
      ${info}
      ${days > usual ? `<p class="warn">길이 막혀 돌아가요. 보통은 ${usual}일 걸려요.</p>` : ''}
      ${v.horses.length ? `<p class="muted">말이 길에서 지쳐요. 길 위에서는 수레에 실은 곡물을 먹어요 (하루 ${v.horses.reduce((s, h) => s + h.feed, 0)}개).</p>` : ''}
      ${toll > 0 ? `<p class="warn">산적이 있는 길목이라 여비에 통행세 ${money(toll)} 포함이에요.</p>` : ''}
      ${city ? '<p class="muted">길이 모이는 도시예요. 사람과 돈이 많아 도구, 염장 식품, 가죽을 비싸게 산다고 해요.</p>' : ''}
      <p class="muted">${mem ? `${agoText(v.day, mem.day)} 본 시세를 기억하고 있어요. 지금은 달라졌을 수 있어요.` : '가 본 적 없는 마을이에요. 시세를 몰라요.'}</p>
      ${v.orders.some((o) => o.from === 'cart') ? `<p class="warn">이 마을에 수레 짐으로 낸 신청은 거둬요 (맡긴 돈과 짐은 돌려받아요).</p>` : ''}
      ${
        v.cart.horsesNeeded > v.horses.length
          ? `<p class="warn">말이 모자라 ${v.cart.name}가 움직이지 않아요. 손수레로 바꾸면 떠날 수 있어요.</p>
             <button type="button" class="secondary-btn" data-handcart>손수레로 바꾸기</button>`
          : ''
      }
      <p class="error" data-error hidden></p>
      <button type="button" class="primary-btn" data-go>여기로 가기</button>`;
    sheet.body.querySelector('[data-handcart]')?.addEventListener('click', () => {
      const r = game.dispatch({ type: 'buyCart', cart: 'handcart' });
      const err = sheet.body.querySelector<HTMLElement>('[data-error]')!;
      if (r.ok) {
        sheet.close();
        render();
      } else {
        err.textContent = ERROR_TEXT[r.error];
        err.hidden = false;
      }
    });
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
