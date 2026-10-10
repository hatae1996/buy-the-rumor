// 지도 탭 (기획서 "화면 구성 - 지도 탭", 0.0.5 → 0.1.6 목업 docs/reference/map-mockup-0.1.6.png, map-town-card-mockup-0.1.6.png):
// "어디로 갈까". 내 행렬과 두 번째 행렬의 말을 그리고, 마을을 누르면 마을 카드(이동 날, 여비, 필요 식량, 들려오는 이야기,
// 건물, 시세 기록, 출발), 행렬 단추로 지시서를 고친다. 위에 현재 위치 칩과 내 위치, 오른쪽 아래 확대·축소, 아래에 상태 줄.
// Three.js가 커서 이 탭을 처음 열 때 불러온다.
import './mapScreen.css';
import pinImg from '../../assets/ui/icon_pin.png';
import hourglassImg from '../../assets/ui/icon_hourglass.png';
import coinImg from '../../assets/ui/coin.png';
import foodImg from '../../assets/ui/travel_food.png';
import noticeImg from '../../assets/ui/icon_notice.png';
import { ECONOMY } from '../sim/constants';
import { euro } from '../sim/josa';
import { findRoute } from '../sim/worldgen';
import { MapView, PAWN_COLORS, PAWN_SLOTS, type PawnSpec } from '../view3d';
import { agoText, arrivalText, ERROR_TEXT, money } from './format';
import type { Game } from './game';
import type { PlayerView } from '../sim/economy';
import { goToTab } from './nav';
import { openSheet } from './sheet';
import { openCaravanSheet } from './screens/caravanSheet';
import { openArrivalSheet } from './screens/arrivalSheet';
import { showLedgerSection } from './screens/ledger';
import { showPricesOf } from './screens/ledgerPrices';

export interface MapScreen {
  setActive(active: boolean): void;
  render(): void;
}

const won = (n: number) => `${money(n)}골드`;

/** 과녁 (내 위치 단추) */
const TARGET = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="12" cy="12" r="2.6" fill="currentColor"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`;
/** 마을 카드 줄 아이콘: 말풍선, 집, 막대 */
const ICON = {
  talk: `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M12 3C6.5 3 2.5 6.4 2.5 10.6c0 2.3 1.2 4.3 3.1 5.7L5 21l4.6-2.8c.8.2 1.6.2 2.4.2 5.5 0 9.5-3.4 9.5-7.8S17.5 3 12 3z" fill="currentColor"/><circle cx="8" cy="10.8" r="1.3" fill="#fff"/><circle cx="12" cy="10.8" r="1.3" fill="#fff"/><circle cx="16" cy="10.8" r="1.3" fill="#fff"/></svg>`,
  house: `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" fill="currentColor"/></svg>`,
  bars: `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><rect x="3" y="13" width="4.5" height="8" rx="1" fill="currentColor"/><rect x="9.75" y="8" width="4.5" height="13" rx="1" fill="currentColor"/><rect x="16.5" y="3" width="4.5" height="18" rx="1" fill="currentColor"/></svg>`,
};

export function mountMapScreen(container: HTMLElement, game: Game, now: () => number): MapScreen {
  const status = document.createElement('div');
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
  // 왼쪽 위: 지금 있는 곳
  const where = document.createElement('div');
  where.className = 'map-where';
  container.appendChild(where);
  // 오른쪽 위 단추 줄: 내 위치, 두 번째 행렬, 도착하면 팔기
  const tools = document.createElement('div');
  tools.className = 'map-tools';
  const locateBtn = document.createElement('button');
  locateBtn.type = 'button';
  locateBtn.className = 'map-pill map-locate-btn';
  locateBtn.addEventListener('click', () => {
    view.focusPawn(view.focused ? null : 'me');
    syncLocate();
  });
  const syncLocate = () => {
    locateBtn.innerHTML = `${TARGET}<span>${view.focused ? '전체 보기' : '내 위치'}</span>`;
    locateBtn.setAttribute('aria-pressed', String(view.focused));
  };
  syncLocate();
  const caravanBtn = document.createElement('button');
  caravanBtn.type = 'button';
  caravanBtn.className = 'map-pill';
  caravanBtn.textContent = '두 번째 행렬';
  caravanBtn.addEventListener('click', () => openCaravanSheet(game));
  // 예약 주문이 열렸으면 길 위에서 "도착하면 팔기"를 걸어 둘 수 있다 (0.1.0)
  const arrivalBtn = document.createElement('button');
  arrivalBtn.type = 'button';
  arrivalBtn.className = 'map-pill';
  arrivalBtn.textContent = '도착하면 팔기';
  arrivalBtn.addEventListener('click', () => openArrivalSheet(game));
  tools.append(locateBtn, caravanBtn, arrivalBtn);
  container.appendChild(tools);
  // 오른쪽 아래: 확대·축소 (두 손가락 확대가 어려울 때)
  const zoom = document.createElement('div');
  zoom.className = 'map-zoom';
  zoom.innerHTML = '<button type="button" data-zoom="in" aria-label="확대">+</button><button type="button" data-zoom="out" aria-label="축소">−</button>';
  zoom.querySelector('[data-zoom="in"]')!.addEventListener('click', () => view.zoom(0.75));
  zoom.querySelector('[data-zoom="out"]')!.addEventListener('click', () => view.zoom(1.33));
  container.appendChild(zoom);
  view.setWorld(game.map);
  const name = (id: number) => game.map.towns[id]!.name;
  /** 떠나는 순간에는 상태가 먼저 바뀌어도 말을 순간이동시키지 않고 걸어가게 한다 */
  let departing = false;
  /** 마을 카드를 연 마을 (이름표에 과녁 표시) */
  let selected: number | null = null;

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
      // 내 말: 크게, 발밑 고리와 깃발 (다른 상단 말 사이에서 찾기 쉽게)
      const me: PawnSpec = { key: 'me', color: PAWN_COLORS[0], tile: myTile().tile, slot: 0, scale: 1.3, marker: true };
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
        pawns.push({ key: `rival:${r.id}`, color: i % 2 ? PAWN_COLORS[3] : PAWN_COLORS[2], tile, slot, scale: 0.65 });
      });
      view.setPawns(pawns);
    }
    caravanBtn.hidden = !v.caravan && !v.hires.some((h) => h.role === 'carter');
    arrivalBtn.hidden = v.location.kind !== 'road' || !v.unlocks.includes('reservation');
    const loc = v.location;
    view.markTowns(loc.kind === 'town' ? loc.town : null, selected);
    where.innerHTML =
      loc.kind === 'town'
        ? `<img src="${pinImg}" alt="" /><span>현재 위치 · <b>${name(loc.town)}</b></span>`
        : `<img src="${pinImg}" alt="" /><span>이동 중 · <b>${euro(name(loc.to))}</b></span>`;
    status.innerHTML =
      loc.kind === 'town'
        ? `<img src="${pinImg}" alt="" /><b>${name(loc.town)}에 머무는 중</b><span>마을을 누르면 이동 정보를 볼 수 있어요.</span>`
        : `<img src="${pinImg}" alt="" /><b>${euro(name(loc.to))} 가는 길</b><span>${arrivalText(game.msUntilArrival(loc.daysLeft, now()), loc.daysLeft, now())}</span>`;
  }

  /** 마을 카드 줄: 아이콘, 제목, 오른쪽 또는 아래 글 */
  const infoRow = (icon: string, title: string, text: string, attr = '') =>
    `<li ${attr}><span class="map-card-icon">${icon}</span><b>${title}</b><span>${text}</span></li>`;

  /** 마을 카드: 이동 날, 여비, 필요 식량, 들려오는 이야기, 건물, 시세 기록, 출발 */
  function openTownCard(to: number) {
    const v = game.view();
    const here = v.location.kind === 'town' ? v.location.town : null;
    const traits = v.knownTraits[to] ?? [];
    const buildings = v.knownBuildings[to];
    const mem = v.memory[to];
    const city = game.map.towns[to]!.tier === 'city';
    const visited = here === to || !!buildings;
    const talk = [
      ...(city ? ['길이 모이는 도시예요. 도구·염장 식품·가죽을 비싸게 산다고 해요.'] : []),
      ...traits.map((t) => `${t.name}${t.confirmed ? '' : ' (소문)'}`),
    ];
    const rows = `<ul class="map-card-rows">
        ${talk.length ? infoRow(ICON.talk, '들려오는 이야기', talk.join(' · '), 'class="wide"') : ''}
        ${infoRow(ICON.house, '건물 정보', buildings ? buildings.map((b) => b.name).join(', ') : '방문 후 확인')}
        ${infoRow(
          ICON.bars,
          '시세 기록',
          here === to ? '지금 여기 · 오늘 시세' : mem ? `${agoText(v.day, mem.day)} 본 시세 ›` : '아직 아는 시세가 없어요.',
          (here === to || mem) && v.unlocks.includes('ledger') ? 'class="link" data-prices' : '',
        )}
      </ul>`;

    // 쪽지를 먼저 연다 (앞 쪽지가 닫히며 고른 마을을 지운 뒤에 새로 고른다)
    const sheet = openSheet(name(to), () => {
      selected = null;
      render();
    });
    selected = to;
    render();
    sheet.el.classList.add('map-card');
    sheet.el.querySelector('.sheet-head h2')!.insertAdjacentHTML(
      'beforeend',
      ` <span class="paper-chip${here === to ? ' now' : ''}">${here === to ? '지금 여기' : visited ? '방문함' : '미방문'}</span>`,
    );
    const bindPrices = () =>
      sheet.body.querySelector('[data-prices]')?.addEventListener('click', () => {
        sheet.close();
        showPricesOf(to);
        showLedgerSection('prices');
        goToTab('ledger');
      });

    if (here === null || to === here) {
      sheet.body.innerHTML = `
        <p class="map-card-note">${to === here ? '지금 이 마을에 있어요.' : '길 위에서는 다른 곳으로 갈 수 없어요. 도착하고 나서 떠나세요.'}</p>
        ${rows}`;
      bindPrices();
      return;
    }
    // 신문에 실린 막힌 길은 돌아가고, 산적 길목에는 통행세를 낸다
    // 말이 있으면 말 걸음으로 (막힌 길은 돌아간다)
    const days = v.travel.days[to]!;
    const usual = v.travel.usual[to]!;
    const toll = (v.roads.tolls[here] ?? 0) + (v.roads.tolls[to] ?? 0);
    const fee = days * ECONOMY.player.travelFeePerDay + toll;
    // 길의 식량 (0.1.2): 하루에 사람 하나에 식량 하나
    const needFood = Math.ceil(days) * v.food.perDay;
    const short = Math.max(0, needFood - v.food.have);
    const price = v.food.rationPrice;
    const canBuy = price !== null ? Math.min(short, v.food.rationRoom, Math.floor(v.gold / price)) : 0;
    const notes = [
      days > usual ? `<p class="warn">길이 막혀 돌아가요. 보통은 ${usual}일 걸려요.</p>` : '',
      toll > 0 ? `<p class="warn">산적이 있는 길목이라 여비에 통행세 ${won(toll)} 포함이에요.</p>` : '',
      v.horses.length ? `<p>말이 길에서 지쳐요. 길 위에서는 수레에 실은 곡물을 먹어요 (하루 ${v.horses.reduce((s, h) => s + h.feed, 0)}개).</p>` : '',
      v.orders.some((o) => o.from === 'cart') ? `<p class="warn">이 마을에 수레 짐으로 낸 신청은 거둬요 (맡긴 돈과 짐은 돌려받아요).</p>` : '',
    ].join('');
    sheet.body.innerHTML = `
      <div class="map-card-stats">
        <div><img src="${hourglassImg}" alt="" /><span>이동<b>${days}일</b></span></div>
        <div><img src="${coinImg}" alt="" /><span>여비<b>${won(fee)}</b></span></div>
        <div><img src="${foodImg}" alt="" /><span>필요 식량<b>${needFood}개</b></span></div>
      </div>
      ${
        short
          ? `<section class="map-card-short">
              <img src="${noticeImg}" alt="" />
              <div>
                <b>식량 ${short}개 부족</b>
                <span>보유 ${v.food.have}개 / 필요 ${needFood}개${v.food.perDay > 1 ? ` · 하루 ${v.food.perDay}명이 먹어요` : ''}</span>
                <small>식량이 떨어지면 지치고 이동이 늦어져요.</small>
              </div>
              ${
                canBuy > 0
                  ? `<div class="map-card-buy"><button type="button" data-rations>잡화점에서 식량 ${canBuy}개 구입</button><small>개당 ${won(price!)} · 합계 ${won(canBuy * price!)}</small></div>`
                  : ''
              }
            </section>`
          : ''
      }
      ${rows}
      ${notes ? `<div class="map-card-notes">${notes}</div>` : ''}
      ${
        v.cart.horsesNeeded > v.horses.length
          ? `<p class="warn">말이 모자라 ${v.cart.name}가 움직이지 않아요. 손수레로 바꾸면 떠날 수 있어요.</p>
             <button type="button" class="order-btn" data-handcart>손수레로 바꾸기</button>`
          : ''
      }
      <p class="error" data-error hidden></p>
      <p class="map-card-sum">여비 ${won(fee)} · 이동 ${days}일</p>
      <button type="button" class="rumor-note map-card-go" data-go>${euro(name(to))} 출발</button>`;
    bindPrices();
    sheet.body.querySelector('[data-rations]')?.addEventListener('click', async () => {
      const r = await game.dispatch({ type: 'buyRations', qty: canBuy });
      sheet.close();
      if (r.ok) openTownCard(to);
      else render();
    });
    sheet.body.querySelector('[data-handcart]')?.addEventListener('click', async () => {
      const r = await game.dispatch({ type: 'buyCart', cart: 'handcart' });
      const err = sheet.body.querySelector<HTMLElement>('[data-error]')!;
      if (r.ok) {
        sheet.close();
        render();
      } else {
        err.textContent = ERROR_TEXT[r.error];
        err.hidden = false;
      }
    });
    sheet.body.querySelector('[data-go]')!.addEventListener('click', async () => {
      departing = true;
      const r = await game.dispatch({ type: 'travel', to });
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
