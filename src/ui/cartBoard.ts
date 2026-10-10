// 짐칸 판 (0.1.2, 기획서 "수레 인벤토리 - 짐칸 화면", 참고 목업 docs/reference/cart-inventory-mockup.png, 게임 DREDGE의 배 짐칸).
// 위쪽 무게 막대, 수레 모양 칸 위의 짐 조각(구석에 묶음 수), 누르면 아래 정보판, 망가진 칸은 X.
// 0.1.6 목업(docs/reference/cart-tab-mockup-0.1.6.png): 제목과 무게 카드, 칸 안에 물품 그림, 고른 짐은 청록 테두리, 그림 칸이 있는 정보판.
// 수레 판은 수레 그림(assets/ui/carts/) 위, 그림 속 칸 자리(cartArtLayout.ts)에 짐을 놓는다. 그림이 없는 판(창고)은 나무색 테두리.
// 창고가 있는 마을에서는 창고 판과 수레 판을 위아래로 두고 끌어서 옮긴다.
// 처음 톡 누르면 고르고(정보판), 고른 짐을 한 번 더 누르면 돌린다. 끌어서 놓으면 옮긴다.
// 판은 화면 쪽이라 픽셀을 다루지만, 놓을 수 있는지는 시뮬레이션과 같은 모양 함수로 계산한다.
import { isGood, itemShelfLife, shapeOf, unitWeight, type ItemId } from '../sim/cart';
import { ECONOMY } from '../sim/constants';
import type { CartPieceView, Command, PlayerView } from '../sim/economy';
import { eulReul } from '../sim/josa';
import { agoText, ERROR_TEXT, freshness, goodName, money } from './format';
import type { Game } from './game';
import { itemArt } from './itemArt';
import { CART_ART_LAYOUT } from './cartArtLayout';
import type { CartType } from '../sim/cart';

/** 수레 그림 (수레방에서도 쓴다) */
export const CART_IMG = new Map(
  Object.entries(import.meta.glob<string>('../../assets/ui/carts/*.png', { eager: true, query: '?url', import: 'default' })).map(
    ([path, url]) => [path.split('/').pop()!.replace(/\.png$/, ''), url],
  ),
);

/** 물품 색 (화면 팔레트). 그림이 없는 짐(장비, 여행 식량)은 이 색 조각으로 그린다 */
const GOOD_COLOR: Record<ItemId, string> = {
  fish: '#2E9C98',
  meat: '#D2594B',
  grain: '#E6B43C',
  wood: '#8A6E4A',
  leather: '#B5834A',
  ore: '#5B6EA0',
  salt: '#C9CFD3',
  salted: '#B8402F',
  tools: '#6B4A32',
  // 장비와 여행 식량 (0.1.2)
  bow: '#7A8B3C',
  net: '#4E7F9A',
  trap: '#7C6F64',
  torch: '#E08A3C',
  rations: '#C9A26B',
};

const TAP_SLOP = 6;

/** 제목 양옆 잎 가지 (목업) */
const SPRIG = `<svg viewBox="0 0 48 48" width="40" height="40"><path d="M10 44 C16 34 20 24 22 8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><ellipse cx="22" cy="10" rx="5" ry="10" transform="rotate(18 22 10)" fill="currentColor"/><ellipse cx="11" cy="25" rx="4.5" ry="9.5" transform="rotate(-52 11 25)" fill="currentColor"/><ellipse cx="30" cy="25" rx="4.5" ry="9.5" transform="rotate(48 30 25)" fill="currentColor"/></svg>`;

type BoardId = 'cart' | 'warehouse';

/** 화면에 그리는 판 하나 */
interface BoardModel {
  id: BoardId;
  title: string;
  rows: readonly string[];
  pieces: CartPieceView[];
  broken: readonly (readonly [number, number])[];
  /** 수레 그림 (그림 위 칸 자리에 짐을 놓는다). 창고는 없다 */
  art: { src: string; layout: (typeof CART_ART_LAYOUT)[CartType] } | null;
}

function cartArt(type: CartType): BoardModel['art'] {
  const src = CART_IMG.get(type);
  return src ? { src, layout: CART_ART_LAYOUT[type] } : null;
}

// 화면이 다시 그려져도 고른 짐과 안내 문구는 남긴다
let selected: { board: BoardId; piece: number } | null = null;
let message = '';

function boardsOf(v: PlayerView, townName: (id: number) => string): BoardModel[] {
  const out: BoardModel[] = [];
  const here = v.location.kind === 'town' ? v.location.town : null;
  const w = here === null ? null : v.warehouses.find((x) => x.town === here);
  if (w) out.push({ id: 'warehouse', title: `${townName(w.town)} 창고`, rows: w.rows, pieces: w.pieces, broken: [], art: null });
  out.push({ id: 'cart', title: v.cart.name, rows: v.cart.rows, pieces: v.cart.pieces, broken: v.cart.broken, art: cartArt(v.cart.type) });
  return out;
}

/** 짐칸 화면이 판 말고 함께 보여 주는 것 */
export interface CartBoardOptions {
  /** 다른 짐칸(짐꾼 수레, 두 번째 행렬, 다른 마을 창고) 수. 0이면 단추를 감춘다 */
  others: number;
  openOthers(): void;
}

/** 칸 크기 범위 (px). 화면에 다 들어가게 남은 자리에 맞추되 누르기 좋은 크기 아래로는 줄이지 않는다 */
const MIN_CELL = 30;
const MAX_CELL = 64;
/** 수레 그림 판에서 바라는 칸 크기 (px). 그림 전체를 넣어 이보다 작으면 그림을 키운다 */
const ART_CELL = 42;
/** 판 틀 안쪽 여백 (px, 위아래·좌우 합) */
const FRAME_PAD = 20;

// 화면 크기가 바뀌면 열려 있는 판을 다시 그린다 (판은 남은 높이에 맞춰 칸 크기를 정한다)
let redraw: (() => void) | null = null;
if (typeof window !== 'undefined') window.addEventListener('resize', () => redraw?.());

export function mountCartBoard(host: HTMLElement, game: Game, opts: CartBoardOptions = { others: 0, openOthers: () => {} }): { render(): void } {
  let drag: {
    from: BoardId;
    piece: CartPieceView;
    /** 누른 칸이 조각 왼쪽 위에서 얼마나 떨어졌나 */
    grabX: number;
    grabY: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null = null;

  const render = () => {
    const v = game.view();
    const boards = boardsOf(v, (id) => game.map.towns[id]!.name);
    const cart = v.cart;
    // 칸 크기는 화면을 그린 뒤 판 자리를 재서 판마다 정한다 (아래)
    const cells = new Map<BoardId, number>();
    const cellOf = (id: BoardId) => cells.get(id) ?? 40;
    // 짐수레·마차는 말이 모자라면 움직이지 못한다 (끄는 무게 0)
    const noHorse = v.horses.length < cart.horsesNeeded;
    const over = !noHorse && cart.weight > cart.maxWeight;
    const selBoard = boards.find((b) => b.id === selected?.board) ?? null;
    const sel = selBoard?.pieces.find((p) => p.id === selected?.piece) ?? null;
    if (!sel) selected = null;

    const grid = (b: BoardModel) => {
      const cell = cellOf(b.id);
      const broken = new Set(b.broken.map(([x, y]) => `${x},${y}`));
      let slots = '';
      b.rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          if (row[x] !== '#') continue;
          const bad = broken.has(`${x},${y}`);
          // 그림이 있으면 칸은 그림에 그려져 있어 망가진 칸만 덮는다
          if (b.art && !bad) continue;
          slots += `<div class="cart-slot${bad ? ' broken' : ''}" style="left:${x * cell}px;top:${y * cell}px;width:${cell}px;height:${cell}px">${bad ? '<b aria-label="망가진 칸">✕</b>' : ''}</div>`;
        }
      });
      const pieces = b.pieces
        .map((p) => {
          const isSel = selected?.board === b.id && selected.piece === p.id;
          const art = itemArt(p.good);
          const blocks = p.cells
            .map(
              ([cx, cy]) =>
                `<div class="cart-block${art ? ' has-art' : ''}${p.qty === 0 ? ' ghost' : ''}${isSel ? ' selected' : ''}${p.uses?.left === 0 ? ' worn' : ''}" data-piece="${p.id}" data-board="${b.id}"
                  style="left:${cx * cell}px;top:${cy * cell}px;width:${cell}px;height:${cell}px;--c:${GOOD_COLOR[p.good]}"></div>`,
            )
            .join('');
          // 이름은 조각 가운데, 묶음 수는 오른쪽 아래 구석 (목업처럼)
          const xs = p.cells.map((c) => c[0]);
          const ys = p.cells.map((c) => c[1]);
          const [x0, y0, x1, y1] = [Math.min(...xs), Math.min(...ys), Math.max(...xs) + 1, Math.max(...ys) + 1];
          const name =
            p.qty === 0 ? (p.pending === 'buy' ? '살 자리' : '팔러 냄') : goodName(p.good);
          const badge = p.uses ? `${p.uses.left}회` : p.qty > 1 || p.incoming ? `${p.qty}${p.incoming ? `+${p.incoming}` : ''}` : '';
          const box = (x: number, y: number, w: number, h: number) => `left:${x * cell}px;top:${y * cell}px;width:${w * cell}px;height:${h * cell}px`;
          if (!art) {
            return `${blocks}<div class="cart-name${isSel ? ' selected' : ''}${p.qty === 0 ? ' ghost' : ''}" style="${box(x0, y0, x1 - x0, y1 - y0)}"><span>${name}</span>${badge ? `<b class="cart-qty">${badge}</b>` : ''}</div>`;
          }
          // 그림은 돌리지 않은 짐 모양 비율로 그려져 있다: 그 크기로 조각 가운데에 놓고 짐 방향만큼 돌린다 (ㄴ자도 모양 그대로)
          const base = shapeOf(p.good, 0);
          const bw = Math.max(...base.map((c) => c[0])) + 1;
          const bh = Math.max(...base.map((c) => c[1])) + 1;
          const cx = ((x0 + x1) / 2) * cell;
          const cy = ((y0 + y1) / 2) * cell;
          const artStyle = `left:${cx - (bw * cell) / 2}px;top:${cy - (bh * cell) / 2}px;width:${bw * cell}px;height:${bh * cell}px;transform:rotate(${p.rot * 90}deg)`;
          // 묶음 수는 돌리지 않고 짐의 오른쪽 아래 칸에
          const [qx, qy] = p.cells.reduce((a, c) => (c[0] + c[1] > a[0] + a[1] || (c[0] + c[1] === a[0] + a[1] && c[1] > a[1]) ? c : a));
          // 고른 짐: 네모 짐은 조각 둘레를, 네모가 아닌 짐은 칸마다 청록 테두리
          const rect = p.cells.length === (x1 - x0) * (y1 - y0);
          const outline = isSel && rect ? `<div class="cart-outline" style="${box(x0, y0, x1 - x0, y1 - y0)}"></div>` : '';
          return `${blocks}${outline}<div class="cart-name has-art${p.qty === 0 ? ' ghost' : ''}${p.uses?.left === 0 ? ' worn' : ''}" style="${artStyle}"><img class="cart-art" src="${art}" alt="${name}" draggable="false" /></div>${
            badge ? `<div class="cart-badge" style="${box(qx, qy, 1, 1)}"><b class="cart-qty">${badge}</b></div>` : ''
          }`;
        })
        .join('');
      const w = Math.max(...b.rows.map((r) => r.length));
      return `<div class="cart-grid" data-grid="${b.id}" style="width:${w * cell}px;height:${b.rows.length * cell}px">${slots}${pieces}<div class="cart-preview" hidden></div></div>`;
    };

    const store = boards.find((b) => b.id === 'warehouse');
    const cartBoard = boards.find((b) => b.id === 'cart')!;
    const weightPct = noHorse ? 100 : Math.min(100, (cart.weight / Math.max(1, cart.maxWeight)) * 100);

    // 알림 줄: 안내 문구 자리에 하나만 (오류 > 경고 > 사용법)
    const notice = message
      ? `<p class="error">${message}</p>`
      : noHorse
        ? `<p class="warn">${cart.name}는 말이 ${cart.horsesNeeded}필 있어야 움직여요. 목장 마을 마구간에서 말을 사세요.</p>`
        : over
          ? '<p class="warn">너무 무거워 떠날 수 없어요. 팔거나 버려서 무게를 줄이세요.</p>'
          : cart.broken.length
            ? `<p class="warn">망가진 칸 ${cart.broken.length}개. 수레방에서 ${money(cart.repairCost)}에 고칠 수 있어요.</p>`
            : '<p class="cart-hint">끌어서 이동 · 한 번 더 눌러 돌리기 · 같은 짐에 놓아 합치기</p>';

    host.innerHTML = `
      <header class="hold-title">
        <span class="hold-sprig" aria-hidden="true">${SPRIG}</span>
        <div><h2>짐칸</h2><p>${cartBoard.title} · 식량 ${v.food.have}</p></div>
        <span class="hold-sprig flip" aria-hidden="true">${SPRIG}</span>
        ${opts.others ? `<button type="button" class="hold-others" data-others>다른 짐칸 ${opts.others}</button>` : ''}
      </header>
      <div class="weight-card ${over || noHorse ? 'over' : ''}" role="img" aria-label="무게 ${cart.weight} / ${cart.maxWeight}">
        <span>${noHorse ? `말 ${cart.horsesNeeded}필이 끌어야 해요` : `무게 <b>${cart.weight}</b> / ${cart.maxWeight}`}</span>
        <div class="weight-bar"><i style="width:${weightPct}%"></i></div>
      </div>
      <div class="hold-boards">
        ${store ? `<div class="hold-frame store" data-frame="warehouse"><span class="hold-frame-label">${store.title} · 끌어서 수레로</span></div>` : ''}
        <div class="hold-frame${cartBoard.art ? ' art' : ''}" data-frame="cart"></div>
      </div>
      ${sel && selBoard ? infoPanel(v, selBoard.id, sel) : '<div class="hold-info empty"><p>짐을 누르면 이름과 무게, 산 값이 여기 보여요.</p></div>'}
      ${notice}
      <button type="button" class="pack-btn" data-pack title="짐을 위·왼쪽으로 모아 붙여요">빈칸 정리</button>`;

    // 판 자리(남은 높이를 판들이 나눠 가진다)를 재서 판마다 칸 크기를 정한다.
    // 수레 그림이 있으면 그림을 판 자리에 맞춰 줄이고, 칸은 그림 속 칸 간격 그대로. 없으면 칸 수로 나눈다
    const frames = boards.map((b) => ({ b, el: host.querySelector<HTMLElement>(`[data-frame="${b.id}"]`)! }));
    for (const { b, el } of frames) {
      const w = el.clientWidth;
      const h = el.clientHeight - (b.id === 'warehouse' ? 18 : 0);
      if (b.art) {
        const L = b.art.layout;
        const cols = Math.max(...b.rows.map((r) => r.length));
        // 그림 전체가 들어가는 크기. 그러면 칸이 너무 작은 큰 수레는 칸이 ART_CELL이 될 때까지 키운다
        // (격자는 늘 다 보이게, 덮개·바퀴는 판 자리 밖으로 조금 잘린다)
        const whole = w > 0 && h > 0 ? Math.min(w / L.w, h / L.h) : 0.4;
        const gridMax = w > 0 && h > 0 ? Math.min(w / (cols * L.pitch), h / (b.rows.length * L.pitch)) * 0.96 : whole;
        const scale = Math.max(whole, Math.min(ART_CELL / L.pitch, gridMax));
        const cell = L.pitch * scale;
        cells.set(b.id, cell);
        // 그림이 판 자리보다 크면 격자 가운데를 판 자리 가운데에 맞춘다
        const aw = L.w * scale;
        const ah = L.h * scale;
        const left = aw > w ? w / 2 - (L.x + (cols * L.pitch) / 2) * scale : (w - aw) / 2;
        const top = ah > h ? h / 2 - (L.y + (b.rows.length * L.pitch) / 2) * scale : (h - ah) / 2;
        el.insertAdjacentHTML(
          'beforeend',
          `<div class="cart-art-board" style="width:${aw}px;height:${ah}px;left:${left}px;top:${top}px">
            <img src="${b.art.src}" alt="" draggable="false" />
            <div class="cart-art-grid" style="left:${L.x * scale}px;top:${L.y * scale}px">${grid(b)}</div>
          </div>`,
        );
        continue;
      }
      const cols = Math.max(...b.rows.map((r) => r.length));
      const fit = w > 0 && h > 0 ? Math.floor(Math.min((w - FRAME_PAD) / cols, (h - FRAME_PAD) / b.rows.length)) : 40;
      cells.set(b.id, Math.max(MIN_CELL, Math.min(MAX_CELL, fit)));
      el.insertAdjacentHTML('beforeend', grid(b));
    }
    redraw = () => {
      if (host.isConnected && host.offsetParent !== null) render();
    };

    const grids = new Map(boards.map((b) => [b.id, host.querySelector<HTMLElement>(`[data-grid="${b.id}"]`)!] as const));
    const model = (id: BoardId) => boards.find((b) => b.id === id)!;

    const send = (cmd: Command) => {
      const r = game.dispatch(cmd);
      message = r.ok ? '' : ERROR_TEXT[r.error];
      if (!r.ok) render(); // 성공하면 game이 다시 그린다
      return r.ok;
    };

    host.querySelector('[data-pack]')!.addEventListener('click', () => send({ type: 'packCart' }));
    host.querySelector('[data-others]')?.addEventListener('click', () => opts.openOthers());
    host.querySelector('[data-discard]')?.addEventListener('click', () => {
      if (!sel || selected?.board !== 'cart') return;
      if (!confirm(`${eulReul(`${goodName(sel.good)} ${sel.qty}개`)} 버릴까요? 돌이킬 수 없어요.`)) return;
      selected = null;
      send({ type: 'discardCartPiece', pieceId: sel.id });
    });

    /** 손가락 아래 판과 칸 */
    const at = (e: PointerEvent): { board: BoardId; x: number; y: number } | null => {
      for (const [id, el] of grids) {
        const r = el.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX < r.right && e.clientY >= r.top && e.clientY < r.bottom)
          return { board: id, x: Math.floor((e.clientX - r.left) / cellOf(id)), y: Math.floor((e.clientY - r.top) / cellOf(id)) };
      }
      return null;
    };
    const hidePreviews = () => grids.forEach((el) => (el.querySelector<HTMLElement>('.cart-preview')!.hidden = true));
    const showPreview = (e: PointerEvent) => {
      hidePreviews();
      if (!drag) return;
      const c = at(e);
      if (!c) return;
      const x = c.x - drag.grabX;
      const y = c.y - drag.grabY;
      const ok = canDrop(model(c.board), drag.piece, drag.from === c.board, x, y, c);
      const preview = grids.get(c.board)!.querySelector<HTMLElement>('.cart-preview')!;
      preview.hidden = false;
      preview.className = `cart-preview ${ok ? 'ok' : 'bad'}`;
      const cell = cellOf(c.board);
      preview.innerHTML = shapeOf(drag.piece.good, drag.piece.rot)
        .map(([dx, dy]) => `<i style="left:${(x + dx) * cell}px;top:${(y + dy) * cell}px;width:${cell}px;height:${cell}px"></i>`)
        .join('');
    };

    /** 같은 판 안에서 옮기거나 돌린다. 수레는 전용 명령, 창고는 배치 전체를 보낸다 */
    const place = (board: BoardId, piece: CartPieceView, x: number, y: number, rot: number) => {
      if (board === 'cart') return send({ type: 'moveCartPiece', pieceId: piece.id, x, y, rot });
      const pieces = model(board).pieces.map((p) => (p.id === piece.id ? { id: p.id, x, y, rot } : { id: p.id, x: p.x, y: p.y, rot: p.rot }));
      return send({ type: 'arrangeCart', board, pieces });
    };

    // 누른 칸의 짐을 잡는다 (칸 사이 틈을 눌러도 그 칸의 짐이 잡히게 판 전체에서 받는다)
    grids.forEach((el, board) =>
      el.addEventListener('pointerdown', (e) => {
        const c = at(e);
        if (!c || c.board !== board) return;
        const piece = model(board).pieces.find((p) => p.cells.some(([x, y]) => x === c.x && y === c.y));
        if (!piece) return;
        drag = { from: board, piece, grabX: c.x - piece.x, grabY: c.y - piece.y, startX: e.clientX, startY: e.clientY, moved: false };
        host.setPointerCapture(e.pointerId);
        e.preventDefault();
      }),
    );
    host.onpointermove = (e) => {
      if (!drag) return;
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > TAP_SLOP) drag.moved = true;
      if (drag.moved) showPreview(e);
    };
    host.onpointerup = (e) => {
      if (!drag) return;
      const d = drag;
      drag = null;
      hidePreviews();
      // 빠르게 튕기면 pointermove 없이 바로 손을 뗄 수 있어 여기서도 거리를 본다
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > TAP_SLOP) d.moved = true;
      if (!d.moved) {
        // 톡: 처음엔 고르고(정보판), 고른 짐을 다시 누르면 돌린다
        if (selected?.board === d.from && selected.piece === d.piece.id) {
          if (d.from === 'cart') send({ type: 'rotateCartPiece', pieceId: d.piece.id });
          else place(d.from, d.piece, d.piece.x, d.piece.y, (d.piece.rot + 1) % 4);
        } else {
          selected = { board: d.from, piece: d.piece.id };
          message = '';
        }
        render();
        return;
      }
      const c = at(e);
      if (!c) return;
      const x = c.x - d.grabX;
      const y = c.y - d.grabY;
      // 같은 물품 위에 놓으면 그 칸을 놓을 자리로 보낸다 (합치기)
      const onto = sameGoodAt(model(c.board), d.piece, c);
      const [tx, ty] = onto ? [c.x, c.y] : [x, y];
      if (c.board === d.from) {
        selected = { board: d.from, piece: d.piece.id };
        place(d.from, d.piece, tx, ty, d.piece.rot);
      } else {
        selected = null;
        send({ type: 'transferPiece', from: d.from, pieceId: d.piece.id, x: tx, y: ty, rot: d.piece.rot });
      }
    };
    host.onpointercancel = () => {
      drag = null;
      hidePreviews();
    };
  };

  render();
  return { render };
}

/** 고른 짐 정보판: 이름, 칸·무게, 산 값, 남은 신선도, 내가 아는 이 마을 시세 (장비는 남은 횟수) */
function infoPanel(v: PlayerView, board: BoardId, p: CartPieceView): string {
  const rate = ECONOMY.spoilRate[v.season];
  const cells = p.cells.length;
  const weight = unitWeight(p.good) * Math.max(1, p.qty);
  // 첫 줄에 칸·무게·개수를 모은다 (정보판 높이를 늘 같게)
  const count = p.uses ? `남은 ${p.uses.left}/${p.uses.max}회` : p.uses === null && p.qty > 0 ? `${p.qty}/${p.stack}개` : '';
  const rows: string[] = [[`${cells}칸`, `무게 ${weight}`, count].filter(Boolean).join(' · ')];
  if (p.uses?.left === 0) rows.push('<span class="warn">망가졌어요. 잡화점에서 도구 하나로 고쳐요</span>');
  if (p.cost !== null) rows.push(p.cost === 0 ? '직접 얻은 것' : `산 값 개당 ${money(p.cost)}`);
  const life = itemShelfLife(p.good);
  if (p.oldest && life !== null) {
    const f = freshness(p.oldest, rate);
    const days = Math.max(0, Math.floor((life - p.oldest.age) / rate));
    rows.push(`<span class="chip ${f.level}">${f.text}</span> ${days}일쯤 남음`);
  }
  if (isGood(p.good)) {
    const good = p.good;
    const here = v.location.kind === 'town' ? v.location.town : null;
    if (v.market && v.market.town === here) rows.push(`이 마을 시세 ${money(v.market.price[good])}`);
    else {
      const town = v.location.kind === 'road' ? v.location.from : here;
      const mem = town === null ? null : v.memory[town];
      if (mem) rows.push(`${agoText(v.day, mem.day)} 본 시세 ${money(mem.prices[good])}`);
    }
  }
  // 목업처럼 왼쪽 그림 칸, 오른쪽 이름과 칸·무게, 줄을 긋고 나머지
  const art = itemArt(p.good);
  const [first, ...rest] = rows;
  return `<div class="hold-info">
    <div class="hold-pic">${art ? `<img src="${art}" alt="" />` : `<i style="--c:${GOOD_COLOR[p.good]}"></i>`}</div>
    <div class="hold-detail">
      <h3>${goodName(p.good)}${p.incoming ? ` <small class="muted">장날 신청 자리 ${p.incoming}</small>` : ''}</h3>
      <div>${first}</div>
      ${rest.length ? `<hr />${rest.map((r) => `<div>${r}</div>`).join('')}` : ''}
    </div>
    ${board === 'cart' ? `<button type="button" class="link-btn" data-discard ${p.incoming ? 'disabled' : ''}>버리기</button>` : ''}
  </div>`;
}

/** 놓으려는 칸 위에 같은 물품 조각이 있나 (합치기) */
function sameGoodAt(board: BoardModel, piece: CartPieceView, at: { x: number; y: number }): CartPieceView | null {
  if (piece.uses) return null;
  return (
    board.pieces.find(
      (q) => !(q.id === piece.id) && q.good === piece.good && !q.uses && q.cells.some(([cx, cy]) => cx === at.x && cy === at.y),
    ) ?? null
  );
}

/** 미리보기용: 그 자리에 놓을 수 있나 (시뮬레이션의 fits와 같은 규칙. 망가진 칸에는 놓을 수 없다) */
function canDrop(board: BoardModel, piece: CartPieceView, same: boolean, x: number, y: number, at: { x: number; y: number }): boolean {
  const onto = sameGoodAt(board, piece, at);
  if (onto && !(same && onto.id === piece.id)) return piece.incoming === 0 && onto.qty + onto.incoming < onto.stack;
  const broken = new Set(board.broken.map(([bx, by]) => `${bx},${by}`));
  const taken = new Set(board.pieces.filter((p) => !(same && p.id === piece.id)).flatMap((p) => p.cells.map(([cx, cy]) => `${cx},${cy}`)));
  return shapeOf(piece.good, piece.rot).every(([dx, dy]) => {
    const cx = x + dx;
    const cy = y + dy;
    return board.rows[cy]?.[cx] === '#' && !taken.has(`${cx},${cy}`) && !broken.has(`${cx},${cy}`);
  });
}
