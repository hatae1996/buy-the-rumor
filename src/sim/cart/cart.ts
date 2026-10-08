// 수레: 모양이 있는 짐 조각을 칸에 싣는다. 조각 하나에는 같은 물품을 쌓기 한도까지 담는다.
// 장날 신청이 걸린 조각은 "들어올 자리"(incoming)를 잡아 둔다:
//   사자 신청: 사게 될 만큼 빈자리를 미리 잡는다 (장날에 자리가 없어 못 받는 일이 없도록)
//   팔자 신청: 내놓은 물건이 안 팔리면 돌아올 자리를 남겨 둔다
import { shelfLife, type GoodId } from '../economy/goods';
import type { Lot } from '../economy/inventory';
import { cartSlots, distinctRotations, shapeOf, stackLimit, unitWeight, type CartType, type Cell } from './shapes';
import { CART } from '../constants';

export interface Piece {
  id: number;
  good: GoodId;
  /** 모양 왼쪽 위 칸 */
  x: number;
  y: number;
  /** 90도 회전 수 (0~3) */
  rot: number;
  lots: Lot[];
  /** 장날 신청 때문에 비워 둔 자리 (신청 번호별 개수) */
  incoming: { orderId: number; qty: number }[];
}

export interface Cart {
  type: CartType;
  pieces: Piece[];
  nextPieceId: number;
}

export function createCart(type: CartType): Cart {
  return { type, pieces: [], nextPieceId: 1 };
}

const key = (x: number, y: number) => `${x},${y}`;
const qtyOf = (p: Piece) => p.lots.reduce((s, l) => s + l.qty, 0);
const incomingOf = (p: Piece) => p.incoming.reduce((s, i) => s + i.qty, 0);
/** 조각에 더 담을 수 있는 양 */
const roomIn = (p: Piece) => stackLimit(p.good) - qtyOf(p) - incomingOf(p);

export function pieceCells(p: Pick<Piece, 'good' | 'x' | 'y' | 'rot'>): Cell[] {
  return shapeOf(p.good, p.rot).map(([dx, dy]) => [p.x + dx, p.y + dy] as const);
}

/** 그 자리에 놓을 수 있나 (except: 옮기는 중인 자기 자신) */
export function fits(cart: Cart, good: GoodId, x: number, y: number, rot: number, except?: number): boolean {
  const slots = new Set(cartSlots(cart.type).map(([sx, sy]) => key(sx, sy)));
  const taken = new Set(
    cart.pieces.filter((p) => p.id !== except).flatMap((p) => pieceCells(p).map(([cx, cy]) => key(cx, cy))),
  );
  return pieceCells({ good, x, y, rot }).every(([cx, cy]) => slots.has(key(cx, cy)) && !taken.has(key(cx, cy)));
}

/**
 * 빈자리 찾기: 놓을 수 있는 자리 중 벽이나 다른 짐에 가장 많이 닿는 곳 (구석부터 채워야 빈칸이 덜 생긴다).
 * 같으면 위에서 아래, 왼쪽에서 오른쪽 순서
 */
export function findSpot(cart: Cart, good: GoodId): { x: number; y: number; rot: number } | null {
  const slots = cartSlots(cart.type);
  const open = new Set(slots.map(([x, y]) => key(x, y)));
  for (const p of cart.pieces) for (const [cx, cy] of pieceCells(p)) open.delete(key(cx, cy));
  let best: { x: number; y: number; rot: number; contact: number } | null = null;
  for (const [x, y] of slots) {
    for (const rot of distinctRotations(good)) {
      // 빈칸 집합을 한 번만 만들어 쓴다 (fits와 같은 판단)
      const cells = pieceCells({ good, x, y, rot });
      if (!cells.every(([cx, cy]) => open.has(key(cx, cy)))) continue;
      const mine = new Set(cells.map(([cx, cy]) => key(cx, cy)));
      let contact = 0;
      for (const [cx, cy] of cells) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const k = key(cx + dx, cy + dy);
          if (!mine.has(k) && !open.has(k)) contact++;
        }
      }
      if (!best || contact > best.contact) best = { x, y, rot, contact };
    }
  }
  return best && { x: best.x, y: best.y, rot: best.rot };
}

function newPiece(cart: Cart, good: GoodId, spot: { x: number; y: number; rot: number }): Piece {
  const p: Piece = { id: cart.nextPieceId++, good, ...spot, lots: [], incoming: [] };
  cart.pieces.push(p);
  return p;
}

function addLotTo(p: Piece, lot: Lot): void {
  const same = p.lots.find((l) => l.age === lot.age);
  if (same) same.qty += lot.qty;
  else p.lots.push({ ...lot });
}

/** 물건을 싣는다. 같은 물품 조각의 남은 자리를 먼저 채우고, 모자라면 새 조각을 놓는다. 실은 양을 돌려준다 */
export function loadGoods(cart: Cart, good: GoodId, qty: number, age = 0): number {
  let left = qty;
  for (const p of cart.pieces) {
    if (left <= 0) break;
    if (p.good !== good) continue;
    const n = Math.min(left, roomIn(p));
    if (n > 0) {
      addLotTo(p, { good, qty: n, age });
      left -= n;
    }
  }
  while (left > 0) {
    const spot = findSpot(cart, good);
    if (!spot) break;
    const n = Math.min(left, stackLimit(good));
    addLotTo(newPiece(cart, good, spot), { good, qty: n, age });
    left -= n;
  }
  return qty - left;
}

/** 실린 물건 전부 (묶음 목록으로) */
export function cartLots(cart: Cart): Lot[] {
  return cart.pieces.flatMap((p) => p.lots);
}

export function cartCount(cart: Cart, good: GoodId): number {
  return cart.pieces.filter((p) => p.good === good).reduce((s, p) => s + qtyOf(p), 0);
}

export function cartWeight(cart: Cart): number {
  return cart.pieces.reduce((s, p) => s + qtyOf(p) * unitWeight(p.good), 0);
}

export const maxWeight = (cart: Cart): number => CART.types[cart.type].maxWeight;

/** 지금 그 물건을 몇 개 더 실을 수 있나 (잡아 둔 자리 빼고, 지금 배치 그대로) */
export function roomFor(cart: Cart, good: GoodId, upTo = 99): number {
  const copy = JSON.parse(JSON.stringify(cart)) as Cart;
  return loadGoods(copy, good, upTo);
}

/**
 * 물건을 꺼낸다. canTake로 꺼낼 수 있는 묶음을 거르고, 오래된 것부터.
 * holdFor를 주면 꺼낸 자리를 그 신청 번호로 비워 둔다 (안 팔리면 돌아올 자리)
 */
export function takeGoods(
  cart: Cart,
  good: GoodId,
  qty: number,
  canTake: (lot: Lot) => boolean = () => true,
  holdFor?: number,
): Lot[] {
  const candidates = cart.pieces
    .filter((p) => p.good === good)
    .flatMap((p) => p.lots.filter(canTake).map((lot) => ({ p, lot })))
    .sort((a, b) => b.lot.age - a.lot.age);
  const out: Lot[] = [];
  let left = qty;
  for (const { p, lot } of candidates) {
    if (left <= 0) break;
    const n = Math.min(lot.qty, left);
    lot.qty -= n;
    left -= n;
    out.push({ good, qty: n, age: lot.age });
    if (holdFor !== undefined) addIncoming(p, holdFor, n);
  }
  tidy(cart);
  return out;
}

function addIncoming(p: Piece, orderId: number, qty: number): void {
  const same = p.incoming.find((i) => i.orderId === orderId);
  if (same) same.qty += qty;
  else p.incoming.push({ orderId, qty });
}

/** 사게 될 물건 자리를 미리 잡는다. 다 못 잡으면 아무것도 잡지 않고 false */
export function reserveRoom(cart: Cart, good: GoodId, qty: number, orderId: number): boolean {
  const before = JSON.stringify(cart.pieces);
  const nextId = cart.nextPieceId;
  let left = qty;
  for (const p of cart.pieces) {
    if (left <= 0) break;
    if (p.good !== good) continue;
    const n = Math.min(left, roomIn(p));
    if (n > 0) {
      addIncoming(p, orderId, n);
      left -= n;
    }
  }
  while (left > 0) {
    const spot = findSpot(cart, good);
    if (!spot) {
      // 되돌린다
      cart.pieces = JSON.parse(before) as Piece[];
      cart.nextPieceId = nextId;
      return false;
    }
    const n = Math.min(left, stackLimit(good));
    addIncoming(newPiece(cart, good, spot), orderId, n);
    left -= n;
  }
  return true;
}

/** 장날 뒤: 그 신청으로 받은 물건(산 것, 안 팔려 돌아온 것)을 잡아 둔 자리에 넣고 자리를 푼다 */
export function settleIncoming(cart: Cart, orderId: number, lots: readonly Lot[]): void {
  const slots = cart.pieces.filter((p) => p.incoming.some((i) => i.orderId === orderId));
  const queue = lots.map((l) => ({ ...l }));
  for (const p of slots) {
    const entry = p.incoming.find((i) => i.orderId === orderId)!;
    let room = entry.qty;
    while (room > 0 && queue.length) {
      const lot = queue[0]!;
      const n = Math.min(room, lot.qty);
      addLotTo(p, { good: lot.good, qty: n, age: lot.age });
      lot.qty -= n;
      room -= n;
      if (lot.qty === 0) queue.shift();
    }
    p.incoming = p.incoming.filter((i) => i.orderId !== orderId);
  }
  // 잡아 둔 자리보다 많이 오는 일은 없어야 하지만, 혹시 남으면 빈자리에 싣는다
  for (const lot of queue) loadGoods(cart, lot.good, lot.qty, lot.age);
  tidy(cart);
}

/** 하루 지나 상한 정도를 올리고 상한 것을 버린다 */
export function ageCart(cart: Cart, rate: number): Partial<Record<GoodId, number>> {
  const spoiled: Partial<Record<GoodId, number>> = {};
  for (const p of cart.pieces) {
    for (const l of p.lots) {
      l.age += rate;
      const life = shelfLife(l.good);
      if (life !== null && l.age >= life) {
        spoiled[l.good] = (spoiled[l.good] ?? 0) + l.qty;
        l.qty = 0;
      }
    }
  }
  tidy(cart);
  return spoiled;
}

/**
 * 조각을 옮기거나 돌린다. 같은 물품 조각 위에 놓으면 담을 수 있는 만큼 합친다.
 * 성공하면 true
 */
export function movePiece(cart: Cart, pieceId: number, x: number, y: number, rot: number): boolean {
  const p = cart.pieces.find((q) => q.id === pieceId);
  if (!p) return false;
  // 같은 물품 조각 위에 놓았나: 놓을 자리 왼쪽 위 칸이 그 조각 칸이면 합친다
  const target = cart.pieces.find(
    (q) => q.id !== p.id && q.good === p.good && pieceCells(q).some(([cx, cy]) => cx === x && cy === y),
  );
  if (target && p.incoming.length === 0) {
    const n = Math.min(roomIn(target), qtyOf(p));
    if (n <= 0) return false;
    for (const lot of takeFromPiece(p, n)) addLotTo(target, lot);
    tidy(cart);
    return true;
  }
  if (!fits(cart, p.good, x, y, rot, p.id)) return false;
  p.x = x;
  p.y = y;
  p.rot = ((rot % 4) + 4) % 4;
  return true;
}

/** 톡 누르면 돌린다. 그 자리에서 안 맞으면 옆으로 조금씩 비켜 본다 (프로토타입과 같은 순서) */
export function rotatePiece(cart: Cart, pieceId: number): boolean {
  const p = cart.pieces.find((q) => q.id === pieceId);
  if (!p) return false;
  const rot = (p.rot + 1) % 4;
  for (const [dx, dy] of [[0, 0], [-1, 0], [0, -1], [1, 0], [0, 1], [-1, -1]] as const) {
    if (fits(cart, p.good, p.x + dx, p.y + dy, rot, p.id)) {
      p.x += dx;
      p.y += dy;
      p.rot = rot;
      return true;
    }
  }
  return false;
}

/** 조각을 통째로 버린다 (신청이 걸린 조각은 안 된다). 버린 묶음을 돌려준다 */
export function discardPiece(cart: Cart, pieceId: number): Lot[] | null {
  const p = cart.pieces.find((q) => q.id === pieceId);
  if (!p || p.incoming.length > 0) return null;
  cart.pieces = cart.pieces.filter((q) => q !== p);
  return p.lots;
}

/**
 * 빈칸 정리: 조각을 큰 것부터 다시 놓는다. 다 들어가지 않으면 원래대로 두고 false.
 * 같은 물품은 먼저 합쳐 조각 수를 줄인다 (신청이 걸린 조각은 그대로 둔다)
 */
export function packCart(cart: Cart): boolean {
  const before = JSON.stringify(cart);
  // 합치기
  for (const p of cart.pieces) {
    if (p.incoming.length) continue;
    for (const q of cart.pieces) {
      if (q === p || q.good !== p.good || q.incoming.length || qtyOf(q) === 0) continue;
      const n = Math.min(roomIn(p), qtyOf(q));
      if (n > 0) for (const lot of takeFromPiece(q, n)) addLotTo(p, lot);
    }
  }
  tidy(cart);
  // 다시 놓기: 큰 조각부터
  const pieces = [...cart.pieces].sort((a, b) => shapeOf(b.good, 0).length - shapeOf(a.good, 0).length || a.id - b.id);
  cart.pieces = [];
  for (const p of pieces) {
    const spot = findSpot(cart, p.good);
    if (!spot) {
      Object.assign(cart, JSON.parse(before) as Cart);
      return false;
    }
    cart.pieces.push({ ...p, ...spot });
  }
  return true;
}

function takeFromPiece(p: Piece, qty: number): Lot[] {
  const out: Lot[] = [];
  let left = qty;
  for (const l of [...p.lots].sort((a, b) => a.age - b.age)) {
    if (left <= 0) break;
    const n = Math.min(l.qty, left);
    l.qty -= n;
    left -= n;
    out.push({ good: l.good, qty: n, age: l.age });
  }
  p.lots = p.lots.filter((l) => l.qty > 0);
  return out;
}

/** 빈 묶음을 지우고, 물건도 잡아 둔 자리도 없는 조각을 치운다 */
function tidy(cart: Cart): void {
  for (const p of cart.pieces) p.lots = p.lots.filter((l) => l.qty > 0);
  cart.pieces = cart.pieces.filter((p) => p.lots.length > 0 || p.incoming.length > 0);
}
