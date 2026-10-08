// 수레 판: 짐 조각을 끌어다 놓고, 톡 눌러 돌린다 (기획서 "수레 인벤토리").
// 놓을 자리에 미리보기(흰색은 들어감, 빨간색은 안 들어감)를 띄우고, 놓으면 명령을 보낸다.
// 판은 화면 쪽이라 픽셀을 다루지만, 놓을 수 있는지는 시뮬레이션과 같은 모양 함수로 계산한다.
import { shapeOf } from '../sim/cart';
import { ECONOMY } from '../sim/constants';
import type { CartPieceView, CartView, GoodId } from '../sim/economy';
import { eulReul } from '../sim/josa';
import { ERROR_TEXT, freshness, goodName } from './format';
import type { Game } from './game';

/** 물품 색 (화면 팔레트) */
const GOOD_COLOR: Record<GoodId, string> = {
  fish: '#2E9C98',
  meat: '#D2594B',
  grain: '#E6B43C',
  wood: '#8A6E4A',
  leather: '#B5834A',
  ore: '#5B6EA0',
  salt: '#C9CFD3',
  salted: '#B8402F',
  tools: '#6B4A32',
};

const TAP_SLOP = 6;

// 장부 화면이 다시 그려져도 고른 짐과 안내 문구는 남긴다
let selected: number | null = null;
let message = '';

export function mountCartBoard(host: HTMLElement, game: Game): { render(): void } {
  let drag: {
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
    const cart = v.cart;
    const rate = ECONOMY.spoilRate[v.season];
    const w = Math.max(...cart.rows.map((r) => r.length));
    const h = cart.rows.length;
    const cell = Math.max(36, Math.min(60, Math.floor((host.clientWidth || 320) / w)));
    const over = cart.weight > cart.maxWeight;
    const sel = cart.pieces.find((p) => p.id === selected) ?? null;

    let slots = '';
    cart.rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] === '#') slots += `<div class="cart-slot" style="left:${x * cell}px;top:${y * cell}px;width:${cell}px;height:${cell}px"></div>`;
      }
    });

    const pieces = cart.pieces
      .map((p) => {
        const color = GOOD_COLOR[p.good];
        const blocks = p.cells
          .map(
            ([cx, cy]) =>
              `<div class="cart-block${p.qty === 0 ? ' ghost' : ''}${p.id === selected ? ' selected' : ''}" data-piece="${p.id}"
                style="left:${cx * cell}px;top:${cy * cell}px;width:${cell}px;height:${cell}px;--c:${color}"></div>`,
          )
          .join('');
        const [lx, ly] = p.cells[0]!;
        const label =
          p.qty === 0
            ? p.pending === 'buy'
              ? '살 자리'
              : '팔러 냄'
            : `${goodName(p.good)} ${p.qty}${p.incoming ? `<small>+${p.incoming}</small>` : ''}`;
        return `${blocks}<div class="cart-label" style="left:${lx * cell}px;top:${ly * cell}px;width:${cell * 2}px">${label}</div>`;
      })
      .join('');

    const info = sel
      ? (() => {
          const f = sel.oldest ? freshness(sel.oldest, rate) : null;
          return `<div class="cart-info">
            <span><b>${goodName(sel.good)}</b> ${sel.qty}/${sel.stack}개 ${f ? `<span class="chip ${f.level}">${f.text}</span>` : ''}
            ${sel.incoming ? `<span class="muted">장날 신청 자리 ${sel.incoming}</span>` : ''}</span>
            <button type="button" class="link-btn" data-discard ${sel.incoming ? 'disabled' : ''}>버리기</button>
          </div>`;
        })()
      : '<p class="muted cart-hint">짐을 끌어다 옮기고, 톡 누르면 돌아가요. 같은 물건 위에 놓으면 합쳐져요.</p>';

    host.innerHTML = `
      <div class="cart-head">
        <span>${cart.name}</span>
        <div class="weight ${over ? 'over' : ''}" role="img" aria-label="무게 ${cart.weight} / ${cart.maxWeight}">
          <i style="width:${Math.min(100, (cart.weight / cart.maxWeight) * 100)}%"></i>
          <span>무게 ${cart.weight} / ${cart.maxWeight}</span>
        </div>
      </div>
      ${over ? '<p class="warn">너무 무거워 떠날 수 없어요. 팔거나 버려서 무게를 줄이세요.</p>' : ''}
      <div class="cart-grid" style="width:${w * cell}px;height:${h * cell}px">${slots}${pieces}<div class="cart-preview" hidden></div></div>
      ${info}
      ${message ? `<p class="error">${message}</p>` : ''}
      <div class="btn-row"><button type="button" class="secondary-btn" data-pack>빈칸 정리<small>큰 짐부터 다시 쌓기</small></button></div>`;

    const grid = host.querySelector<HTMLElement>('.cart-grid')!;
    const preview = host.querySelector<HTMLElement>('.cart-preview')!;

    const send = (r: ReturnType<Game['dispatch']>) => {
      message = r.ok ? '' : ERROR_TEXT[r.error];
      if (!r.ok) render(); // 성공하면 game이 다시 그린다
    };

    host.querySelector('[data-pack]')!.addEventListener('click', () => send(game.dispatch({ type: 'packCart' })));
    host.querySelector('[data-discard]')?.addEventListener('click', () => {
      if (!sel) return;
      if (!confirm(`${eulReul(`${goodName(sel.good)} ${sel.qty}개`)} 버릴까요? 돌이킬 수 없어요.`)) return;
      selected = null;
      send(game.dispatch({ type: 'discardCartPiece', pieceId: sel.id }));
    });

    // 끌어다 놓기와 톡 눌러 돌리기
    const cellAt = (e: PointerEvent) => {
      const r = grid.getBoundingClientRect();
      return { x: Math.floor((e.clientX - r.left) / cell), y: Math.floor((e.clientY - r.top) / cell) };
    };
    const target = (e: PointerEvent, d: { grabX: number; grabY: number }) => {
      const c = cellAt(e);
      return { x: c.x - d.grabX, y: c.y - d.grabY, anchor: c };
    };
    const showPreview = (e: PointerEvent) => {
      if (!drag) return;
      const t = target(e, drag);
      const ok = canDrop(cart, drag.piece, t.x, t.y, t.anchor);
      preview.hidden = false;
      preview.className = `cart-preview ${ok ? 'ok' : 'bad'}`;
      preview.innerHTML = shapeOf(drag.piece.good, drag.piece.rot)
        .map(([dx, dy]) => `<i style="left:${(t.x + dx) * cell}px;top:${(t.y + dy) * cell}px;width:${cell}px;height:${cell}px"></i>`)
        .join('');
    };

    grid.querySelectorAll<HTMLElement>('[data-piece]').forEach((el) =>
      el.addEventListener('pointerdown', (e) => {
        const piece = cart.pieces.find((p) => p.id === Number(el.dataset.piece))!;
        const c = cellAt(e);
        drag = { piece, grabX: c.x - piece.x, grabY: c.y - piece.y, startX: e.clientX, startY: e.clientY, moved: false };
        grid.setPointerCapture(e.pointerId);
        e.preventDefault();
      }),
    );
    grid.addEventListener('pointermove', (e) => {
      if (!drag) return;
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > TAP_SLOP) drag.moved = true;
      if (drag.moved) showPreview(e);
    });
    grid.addEventListener('pointerup', (e) => {
      if (!drag) return;
      const d = drag;
      drag = null;
      preview.hidden = true;
      // 빠르게 튕기면 pointermove 없이 바로 손을 뗄 수 있어 여기서도 거리를 본다
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > TAP_SLOP) d.moved = true;
      if (!d.moved) {
        // 톡: 고르고 돌린다
        selected = d.piece.id;
        send(game.dispatch({ type: 'rotateCartPiece', pieceId: d.piece.id }));
        render();
        return;
      }
      const t = target(e, d);
      selected = d.piece.id;
      // 같은 물품 위에 놓으면 그 칸을 놓을 자리로 보낸다 (합치기)
      const onto = sameGoodAt(cart, d.piece, t.anchor);
      send(
        onto
          ? game.dispatch({ type: 'moveCartPiece', pieceId: d.piece.id, x: t.anchor.x, y: t.anchor.y, rot: d.piece.rot })
          : game.dispatch({ type: 'moveCartPiece', pieceId: d.piece.id, x: t.x, y: t.y, rot: d.piece.rot }),
      );
    });
    grid.addEventListener('pointercancel', () => {
      drag = null;
      preview.hidden = true;
    });
  };

  render();
  return { render };
}

/** 놓으려는 칸 위에 같은 물품 조각이 있나 (합치기) */
function sameGoodAt(cart: CartView, piece: CartPieceView, at: { x: number; y: number }): CartPieceView | null {
  return (
    cart.pieces.find(
      (q) => q.id !== piece.id && q.good === piece.good && q.cells.some(([cx, cy]) => cx === at.x && cy === at.y),
    ) ?? null
  );
}

/** 미리보기용: 그 자리에 놓을 수 있나 (시뮬레이션의 fits와 같은 규칙) */
function canDrop(cart: CartView, piece: CartPieceView, x: number, y: number, at: { x: number; y: number }): boolean {
  const onto = sameGoodAt(cart, piece, at);
  if (onto) return piece.incoming === 0 && onto.qty + onto.incoming < onto.stack;
  const taken = new Set(cart.pieces.filter((p) => p.id !== piece.id).flatMap((p) => p.cells.map(([cx, cy]) => `${cx},${cy}`)));
  return shapeOf(piece.good, piece.rot).every(([dx, dy]) => {
    const cx = x + dx;
    const cy = y + dy;
    return cart.rows[cy]?.[cx] === '#' && !taken.has(`${cx},${cy}`);
  });
}
