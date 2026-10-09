// 짐칸 판 (0.1.2, 기획서 "수레 인벤토리 - 짐칸 화면", 참고 목업 docs/reference/cart-inventory-mockup.png, 게임 DREDGE의 배 짐칸).
// 위쪽 무게 막대, 수레 모양 칸 위의 짐 조각(구석에 묶음 수), 누르면 아래 정보판, 망가진 칸은 X.
// 창고가 있는 마을에서는 창고 판과 수레 판을 위아래로 두고 끌어서 옮긴다.
// 처음 톡 누르면 고르고(정보판), 고른 짐을 한 번 더 누르면 돌린다. 끌어서 놓으면 옮긴다.
// 판은 화면 쪽이라 픽셀을 다루지만, 놓을 수 있는지는 시뮬레이션과 같은 모양 함수로 계산한다.
import { isGood, itemShelfLife, shapeOf, unitWeight, type ItemId } from '../sim/cart';
import { ECONOMY } from '../sim/constants';
import type { CartPieceView, Command, PlayerView } from '../sim/economy';
import { eulReul } from '../sim/josa';
import { agoText, ERROR_TEXT, freshness, goodName, money } from './format';
import type { Game } from './game';

/** 물품 색 (화면 팔레트). 그림이 오면 그림으로 바꾼다 */
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

type BoardId = 'cart' | 'warehouse';

/** 화면에 그리는 판 하나 */
interface BoardModel {
  id: BoardId;
  title: string;
  rows: readonly string[];
  pieces: CartPieceView[];
  broken: readonly (readonly [number, number])[];
}

// 화면이 다시 그려져도 고른 짐과 안내 문구는 남긴다
let selected: { board: BoardId; piece: number } | null = null;
let message = '';

function boardsOf(v: PlayerView, townName: (id: number) => string): BoardModel[] {
  const out: BoardModel[] = [];
  const here = v.location.kind === 'town' ? v.location.town : null;
  const w = here === null ? null : v.warehouses.find((x) => x.town === here);
  if (w) out.push({ id: 'warehouse', title: `${townName(w.town)} 창고`, rows: w.rows, pieces: w.pieces, broken: [] });
  out.push({ id: 'cart', title: v.cart.name, rows: v.cart.rows, pieces: v.cart.pieces, broken: v.cart.broken });
  return out;
}

export function mountCartBoard(host: HTMLElement, game: Game): { render(): void } {
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
    // 두 판이 같은 칸 크기를 쓰도록 가장 넓은 판에 맞춘다
    const widest = Math.max(...boards.map((b) => Math.max(...b.rows.map((r) => r.length))));
    const cell = Math.max(34, Math.min(56, Math.floor(((host.clientWidth || 320) - 24) / widest)));
    // 짐수레·마차는 말이 모자라면 움직이지 못한다 (끄는 무게 0)
    const noHorse = v.horses.length < cart.horsesNeeded;
    const over = !noHorse && cart.weight > cart.maxWeight;
    const selBoard = boards.find((b) => b.id === selected?.board) ?? null;
    const sel = selBoard?.pieces.find((p) => p.id === selected?.piece) ?? null;
    if (!sel) selected = null;

    const grid = (b: BoardModel) => {
      const broken = new Set(b.broken.map(([x, y]) => `${x},${y}`));
      let slots = '';
      b.rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          if (row[x] !== '#') continue;
          const bad = broken.has(`${x},${y}`);
          slots += `<div class="cart-slot${bad ? ' broken' : ''}" style="left:${x * cell}px;top:${y * cell}px;width:${cell}px;height:${cell}px">${bad ? '<b aria-label="망가진 칸">✕</b>' : ''}</div>`;
        }
      });
      const pieces = b.pieces
        .map((p) => {
          const isSel = selected?.board === b.id && selected.piece === p.id;
          const blocks = p.cells
            .map(
              ([cx, cy]) =>
                `<div class="cart-block${p.qty === 0 ? ' ghost' : ''}${isSel ? ' selected' : ''}${p.uses?.left === 0 ? ' worn' : ''}" data-piece="${p.id}" data-board="${b.id}"
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
          return `${blocks}<div class="cart-name" style="left:${x0 * cell}px;top:${y0 * cell}px;width:${(x1 - x0) * cell}px;height:${(y1 - y0) * cell}px"><span>${name}</span>${badge ? `<b class="cart-qty">${badge}</b>` : ''}</div>`;
        })
        .join('');
      const w = Math.max(...b.rows.map((r) => r.length));
      return `<div class="cart-grid" data-grid="${b.id}" style="width:${w * cell}px;height:${b.rows.length * cell}px">${slots}${pieces}<div class="cart-preview" hidden></div></div>`;
    };

    const store = boards.find((b) => b.id === 'warehouse');
    const cartBoard = boards.find((b) => b.id === 'cart')!;
    const weightPct = noHorse ? 100 : Math.min(100, (cart.weight / Math.max(1, cart.maxWeight)) * 100);

    host.innerHTML = `
      ${
        store
          ? `<section class="hold-board store">
              <header class="hold-head"><h3>${store.title}</h3><span class="muted">끌어서 수레로 옮겨요</span></header>
              <div class="hold-frame store">${grid(store)}</div>
            </section>`
          : ''
      }
      <section class="hold-board">
        <header class="hold-head"><h3>짐 · ${cartBoard.title}</h3></header>
        <div class="weight ${over || noHorse ? 'over' : ''}" role="img" aria-label="무게 ${cart.weight} / ${cart.maxWeight}">
          <i style="width:${weightPct}%"></i>
          <span>${noHorse ? `말 ${cart.horsesNeeded}필이 끌어야 해요` : `무게 ${cart.weight} / ${cart.maxWeight}`}</span>
        </div>
        <p class="hold-food muted">식량 ${v.food.have}${v.food.perDay ? ` · 길에서 하루 ${v.food.perDay}씩 먹어요` : ''}</p>
        ${noHorse ? `<p class="warn">${cart.name}는 말이 ${cart.horsesNeeded}필 있어야 움직여요. 목장 마을 마구간에서 말을 사세요.</p>` : ''}
        ${over ? '<p class="warn">너무 무거워 떠날 수 없어요. 팔거나 버려서 무게를 줄이세요.</p>' : ''}
        ${cart.broken.length ? `<p class="warn">망가진 칸 ${cart.broken.length}개. 수레방에서 ${money(cart.repairCost)}에 고칠 수 있어요.</p>` : ''}
        <div class="hold-frame">${grid(cartBoard)}</div>
      </section>
      ${sel && selBoard ? infoPanel(v, selBoard.id, sel) : ''}
      ${message ? `<p class="error">${message}</p>` : ''}
      <p class="muted cart-hint">끌어서 옮기기 · 고른 짐을 한 번 더 누르면 돌리기 · 같은 물건 위에 놓으면 합치기</p>
      <div class="btn-row"><button type="button" class="secondary-btn" data-pack>빈칸 정리<small>짐을 위·왼쪽으로 모아 붙여요</small></button></div>`;

    const grids = new Map(boards.map((b) => [b.id, host.querySelector<HTMLElement>(`[data-grid="${b.id}"]`)!] as const));
    const model = (id: BoardId) => boards.find((b) => b.id === id)!;

    const send = (cmd: Command) => {
      const r = game.dispatch(cmd);
      message = r.ok ? '' : ERROR_TEXT[r.error];
      if (!r.ok) render(); // 성공하면 game이 다시 그린다
      return r.ok;
    };

    host.querySelector('[data-pack]')!.addEventListener('click', () => send({ type: 'packCart' }));
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
          return { board: id, x: Math.floor((e.clientX - r.left) / cell), y: Math.floor((e.clientY - r.top) / cell) };
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

    host.querySelectorAll<HTMLElement>('[data-piece]').forEach((el) =>
      el.addEventListener('pointerdown', (e) => {
        const from = el.dataset.board as BoardId;
        const piece = model(from).pieces.find((p) => p.id === Number(el.dataset.piece))!;
        const c = at(e);
        if (!c) return;
        drag = { from, piece, grabX: c.x - piece.x, grabY: c.y - piece.y, startX: e.clientX, startY: e.clientY, moved: false };
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
  const rows: string[] = [`${cells}칸 · 무게 ${weight}`];
  if (p.uses) rows.push(`남은 횟수 ${p.uses.left} / ${p.uses.max}`);
  else if (p.uses === null && p.qty > 0) rows.push(`${p.qty} / ${p.stack}개`);
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
  return `<div class="hold-info">
    <div class="hold-swatch" style="--c:${GOOD_COLOR[p.good]}"></div>
    <div>
      <h3>${goodName(p.good)}${p.incoming ? ` <small class="muted">장날 신청 자리 ${p.incoming}</small>` : ''}</h3>
      ${rows.map((r) => `<div>${r}</div>`).join('')}
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
