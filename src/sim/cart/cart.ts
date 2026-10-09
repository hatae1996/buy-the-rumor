// 수레: 모양이 있는 짐 조각을 칸에 싣는다. 조각 하나에는 같은 물품을 쌓기 한도까지 담는다.
// 장날 신청이 걸린 조각은 "들어올 자리"(incoming)를 잡아 둔다:
//   사자 신청: 사게 될 만큼 빈자리를 미리 잡는다 (장날에 자리가 없어 못 받는 일이 없도록)
//   팔자 신청: 내놓은 물건이 안 팔리면 돌아올 자리를 남겨 둔다
import type { GoodId } from '../economy/goods';
import { withCost, type Lot } from '../economy/inventory';
import { GROWTH } from '../constants';
import {
  cartSize,
  cartSlots,
  distinctRotations,
  isGood,
  itemShelfLife,
  shapeOf,
  stackLimit,
  unitWeight,
  type BoardType,
  type CartType,
  type Cell,
  type ItemId,
} from './shapes';

/** 짐칸 묶음: 장날 물품 묶음(Lot)과 같은 모양에 장비·여행 식량도 담는다 (0.1.2) */
export interface ItemLot<G extends ItemId = ItemId> {
  good: G;
  qty: number;
  age: number;
  /** 장날에 산 값 (하나당). 원정·채집으로 얻은 것은 0 */
  cost?: number;
}

export interface Piece {
  id: number;
  good: ItemId;
  /** 모양 왼쪽 위 칸 */
  x: number;
  y: number;
  /** 90도 회전 수 (0~3) */
  rot: number;
  lots: ItemLot[];
  /** 장비 조각: 남은 쓰는 횟수 (0이면 망가진 장비, 잡화점에서 고친다) */
  uses?: number;
  /** 장날 신청 때문에 비워 둔 자리 (신청 번호별 개수) */
  incoming: { orderId: number; qty: number }[];
}

/**
 * 짐 조각을 싣는 판. 수레(CartType)와 창고('warehouse')가 같은 규칙을 쓴다.
 * 타입 인자를 비우면 수레다
 */
export interface Cart<T extends BoardType = CartType> {
  type: T;
  pieces: Piece[];
  nextPieceId: number;
  /** 길 위 사건으로 망가진 칸 ("x,y"). 실을 수 없다. 수레방에서 고친다 (0.1.2). 없으면 멀쩡하다 */
  broken?: string[];
}

/** 수레든 창고든 판 하나 */
export type Board = Cart<BoardType>;

export function createCart<T extends BoardType = CartType>(type: T): Cart<T> {
  return { type, pieces: [], nextPieceId: 1 };
}

const key = (x: number, y: number) => `${x},${y}`;
const qtyOf = (p: Piece) => p.lots.reduce((s, l) => s + l.qty, 0);
const incomingOf = (p: Piece) => p.incoming.reduce((s, i) => s + i.qty, 0);
/** 조각에 더 담을 수 있는 양 */
const roomIn = (board: Board, p: Piece) => boardStack(board, p.good) - qtyOf(p) - incomingOf(p);

/** 실을 수 있는 칸: 판 모양에서 망가진 칸을 뺀다 */
export function openSlots(board: Board): Cell[] {
  const all = cartSlots(board.type);
  if (!board.broken?.length) return all;
  const broken = new Set(board.broken);
  return all.filter(([x, y]) => !broken.has(key(x, y)));
}

/** 이 판에서 한 조각에 쌓는 양. 창고는 수레보다 높이 쌓는다 (0.0.7 시간차 장사) */
export function boardStack(board: Board, good: ItemId): number {
  return stackLimit(good) * (board.type === 'warehouse' ? GROWTH.warehouse.stackFactor : 1);
}

export function pieceCells(p: { good: ItemId; x: number; y: number; rot: number }): Cell[] {
  return shapeOf(p.good, p.rot).map(([dx, dy]) => [p.x + dx, p.y + dy] as const);
}

/** 짐 조각이 차지한 칸 수 (장날 신청으로 비워 둔 자리도 차지한 것으로 친다) */
export function usedCells(board: Board): number {
  return board.pieces.reduce((s, p) => s + shapeOf(p.good, p.rot).length, 0);
}

/** 그 자리에 놓을 수 있나 (except: 옮기는 중인 자기 자신) */
export function fits(cart: Board, good: ItemId, x: number, y: number, rot: number, except?: number): boolean {
  const slots = new Set(openSlots(cart).map(([sx, sy]) => key(sx, sy)));
  const taken = new Set(
    cart.pieces.filter((p) => p.id !== except).flatMap((p) => pieceCells(p).map(([cx, cy]) => key(cx, cy))),
  );
  return pieceCells({ good, x, y, rot }).every(([cx, cy]) => slots.has(key(cx, cy)) && !taken.has(key(cx, cy)));
}

/** 판의 칸을 숫자 격자로 (봇이 날마다 수없이 부른다: 문자열 집합보다 훨씬 빠르다). 0 벽, 1 빈칸, 2 짐 */
interface Grid {
  w: number;
  h: number;
  cells: Uint8Array;
  slots: readonly Cell[];
}

function gridOf(cart: Board): Grid {
  const { w, h } = cartSize(cart.type);
  const cells = new Uint8Array(w * h);
  const slots = openSlots(cart);
  for (const [x, y] of slots) cells[y * w + x] = 1;
  for (const p of cart.pieces) for (const [cx, cy] of pieceCells(p)) if (cx >= 0 && cy >= 0 && cx < w && cy < h) cells[cy * w + cx] = 2;
  return { w, h, cells, slots };
}


/**
 * 빈자리 찾기: 놓을 수 있는 자리 중 벽이나 다른 짐에 가장 많이 닿는 곳 (구석부터 채워야 빈칸이 덜 생긴다).
 * 같으면 위에서 아래, 왼쪽에서 오른쪽 순서
 */
export function findSpot(cart: Board, good: ItemId): { x: number; y: number; rot: number } | null {
  return spotOn(gridOf(cart), good);
}

function spotOn(g: Grid, good: ItemId): { x: number; y: number; rot: number } | null {
  // 가장 자주 도는 곳이라 배열을 새로 만들지 않고 격자 숫자만 본다 (모양 칸은 늘 0 이상이다)
  const { w, h, cells } = g;
  const rots = distinctRotations(good);
  let bx = 0;
  let by = 0;
  let brot = -1;
  let best = -1;
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < w && y < h ? cells[y * w + x]! : 0);
  for (const [x, y] of g.slots) {
    for (const rot of rots) {
      const shape = shapeOf(good, rot);
      let ok = true;
      for (const [dx, dy] of shape) {
        const cx = x + dx;
        const cy = y + dy;
        if (cx >= w || cy >= h || cells[cy * w + cx] !== 1) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      // 놓을 칸을 잠시 3으로 칠해 두고 이웃을 센다 (자기 칸은 닿는 것이 아니다)
      for (const [dx, dy] of shape) cells[(y + dy) * w + x + dx] = 3;
      let contact = 0;
      for (const [dx, dy] of shape) {
        const cx = x + dx;
        const cy = y + dy;
        let v = at(cx + 1, cy);
        if (v !== 3 && v !== 1) contact++;
        v = at(cx - 1, cy);
        if (v !== 3 && v !== 1) contact++;
        v = at(cx, cy + 1);
        if (v !== 3 && v !== 1) contact++;
        v = at(cx, cy - 1);
        if (v !== 3 && v !== 1) contact++;
      }
      for (const [dx, dy] of shape) cells[(y + dy) * w + x + dx] = 1;
      if (contact > best) {
        best = contact;
        bx = x;
        by = y;
        brot = rot;
      }
    }
  }
  return brot < 0 ? null : { x: bx, y: by, rot: brot };
}

function newPiece(cart: Board, good: ItemId, spot: { x: number; y: number; rot: number }): Piece {
  const p: Piece = { id: cart.nextPieceId++, good, ...spot, lots: [], incoming: [] };
  cart.pieces.push(p);
  return p;
}

function addLotTo(p: Piece, lot: ItemLot): void {
  const same = p.lots.find((l) => l.age === lot.age && l.cost === lot.cost);
  if (same) same.qty += lot.qty;
  else p.lots.push({ ...lot });
}

/**
 * 물건을 싣는다. 같은 물품 조각의 남은 자리를 먼저 채우고, 모자라면 새 조각을 놓는다. 실은 양을 돌려준다.
 * cost: 장날에 산 값 (하나당). 원정·채집으로 얻은 것은 0, 모르면 비운다
 */
export function loadGoods(cart: Board, good: ItemId, qty: number, age = 0, cost?: number): number {
  let left = qty;
  for (const p of cart.pieces) {
    if (left <= 0) break;
    if (p.good !== good || p.uses !== undefined) continue;
    const n = Math.min(left, roomIn(cart, p));
    if (n > 0) {
      addLotTo(p, withCost<ItemLot>({ good, qty: n, age }, cost));
      left -= n;
    }
  }
  while (left > 0) {
    const spot = findSpot(cart, good);
    if (!spot) break;
    const n = Math.min(left, boardStack(cart, good));
    addLotTo(newPiece(cart, good, spot), withCost<ItemLot>({ good, qty: n, age }, cost));
    left -= n;
  }
  return qty - left;
}

/** 장비 하나를 싣는다 (조각 하나에 하나, 남은 횟수와 함께). 자리가 없으면 false */
export function loadGear(cart: Board, gear: ItemId, uses: number): boolean {
  const spot = findSpot(cart, gear);
  if (!spot) return false;
  const p = newPiece(cart, gear, spot);
  p.lots.push({ good: gear, qty: 1, age: 0 });
  p.uses = uses;
  return true;
}

/**
 * 판 하나의 짐을 다른 판으로 모두 옮겨 싣는다 (수레를 바꿀 때, 짐꾼이 떠날 때). 장비·여행 식량까지, 나이와 산 값 그대로.
 * 못 실은 양을 돌려준다 (옮기지 못한 것은 from에 남지 않는다: 부른 쪽이 버리거나 바꾸기를 그만둔다)
 */
export function moveAll(from: Board, to: Board): number {
  let lost = 0;
  for (const p of from.pieces) {
    if (p.uses !== undefined) {
      if (!loadGear(to, p.good, p.uses)) lost++;
      continue;
    }
    for (const l of p.lots) lost += l.qty - loadGoods(to, l.good, l.qty, l.age, l.cost);
  }
  return lost;
}

/** 실린 장날 물품 전부 (묶음 목록으로). 장비와 여행 식량은 빼고 */
export function cartLots(cart: Board): Lot[] {
  return cart.pieces.filter((p) => isGood(p.good)).flatMap((p) => p.lots as Lot[]);
}

export function cartCount(cart: Board, good: ItemId): number {
  return cart.pieces.filter((p) => p.good === good).reduce((s, p) => s + qtyOf(p), 0);
}

export function cartWeight(cart: Board): number {
  return cart.pieces.reduce((s, p) => s + qtyOf(p) * unitWeight(p.good), 0);
}

/** 지금 그 물건을 몇 개 더 실을 수 있나 (잡아 둔 자리 빼고, 지금 배치 그대로) */
export function roomFor(cart: Board, good: ItemId, upTo = 99): number {
  // 같은 배치면 같은 답이다: 판마다 배치 글자를 열쇠로 기억해 둔다 (화면 데이터를 만들 때마다 실어 보면 봇이 느리다)
  const sig = layoutKey(cart);
  let memo = roomMemo.get(cart);
  if (!memo || memo.sig !== sig) {
    memo = { sig, room: new Map() };
    roomMemo.set(cart, memo);
  }
  const k = `${good}:${upTo}`;
  const hit = memo.room.get(k);
  if (hit !== undefined) return hit;
  const n = countRoom(cart, good, upTo);
  memo.room.set(k, n);
  return n;
}

const roomMemo = new WeakMap<Board, { sig: string; room: Map<string, number> }>();

/** 판 배치를 글자 하나로 (종류, 조각마다 물품·자리·방향·양·잡아 둔 자리) */
function layoutKey(cart: Board): string {
  let k: string = cart.type;
  if (cart.broken?.length) k += `x${cart.broken.join(';')}`;
  for (const p of cart.pieces) k += `|${p.good},${p.x},${p.y},${p.rot},${qtyOf(p)},${incomingOf(p)}`;
  return k;
}

function countRoom(cart: Board, good: ItemId, upTo: number): number {
  // loadGoods로 실어 보는 것과 같은 셈: 같은 물품 조각의 남은 자리, 그다음 새 조각을 놓을 자리마다 한 조각만큼
  let n = cart.pieces.reduce((s, p) => s + (p.good === good ? Math.max(0, roomIn(cart, p)) : 0), 0);
  if (n >= upTo) return upTo;
  const g = gridOf(cart);
  const stack = boardStack(cart, good);
  while (n < upTo) {
    const spot = spotOn(g, good);
    if (!spot) break;
    for (const [cx, cy] of pieceCells({ good, ...spot })) g.cells[cy * g.w + cx] = 2;
    n += stack;
  }
  return Math.min(n, upTo);
}

/**
 * 물건을 꺼낸다. canTake로 꺼낼 수 있는 묶음을 거르고, 오래된 것부터.
 * holdFor를 주면 꺼낸 자리를 그 신청 번호로 비워 둔다 (안 팔리면 돌아올 자리)
 */
export function takeGoods<G extends ItemId = GoodId>(
  cart: Board,
  good: G,
  qty: number,
  canTake: (lot: ItemLot<G>) => boolean = () => true,
  holdFor?: number,
): ItemLot<G>[] {
  const candidates = cart.pieces
    .filter((p) => p.good === good && p.uses === undefined)
    .flatMap((p) => (p.lots as ItemLot<G>[]).filter(canTake).map((lot) => ({ p, lot })))
    .sort((a, b) => b.lot.age - a.lot.age);
  const out: ItemLot<G>[] = [];
  let left = qty;
  for (const { p, lot } of candidates) {
    if (left <= 0) break;
    const n = Math.min(lot.qty, left);
    lot.qty -= n;
    left -= n;
    out.push(withCost<ItemLot<G>>({ good, qty: n, age: lot.age }, lot.cost));
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
export function reserveRoom(cart: Board, good: ItemId, qty: number, orderId: number): boolean {
  const before = JSON.stringify(cart.pieces);
  const nextId = cart.nextPieceId;
  let left = qty;
  for (const p of cart.pieces) {
    if (left <= 0) break;
    if (p.good !== good) continue;
    const n = Math.min(left, roomIn(cart, p));
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
    const n = Math.min(left, boardStack(cart, good));
    addIncoming(newPiece(cart, good, spot), orderId, n);
    left -= n;
  }
  return true;
}

/** 장날 뒤: 그 신청으로 받은 물건(산 것, 안 팔려 돌아온 것)을 잡아 둔 자리에 넣고 자리를 푼다 */
export function settleIncoming(cart: Board, orderId: number, lots: readonly ItemLot[]): void {
  const slots = cart.pieces.filter((p) => p.incoming.some((i) => i.orderId === orderId));
  const queue = lots.map((l) => ({ ...l }));
  for (const p of slots) {
    const entry = p.incoming.find((i) => i.orderId === orderId)!;
    let room = entry.qty;
    while (room > 0 && queue.length) {
      const lot = queue[0]!;
      const n = Math.min(room, lot.qty);
      addLotTo(p, withCost<ItemLot>({ good: lot.good, qty: n, age: lot.age }, lot.cost));
      lot.qty -= n;
      room -= n;
      if (lot.qty === 0) queue.shift();
    }
    p.incoming = p.incoming.filter((i) => i.orderId !== orderId);
  }
  // 잡아 둔 자리보다 많이 오는 일은 없어야 하지만, 혹시 남으면 빈자리에 싣는다
  for (const lot of queue) loadGoods(cart, lot.good, lot.qty, lot.age, lot.cost);
  tidy(cart);
}

/** 하루 지나 상한 정도를 올리고 상한 것을 버린다 */
export function ageCart(cart: Board, rate: number): Partial<Record<ItemId, number>> {
  const spoiled: Partial<Record<ItemId, number>> = {};
  for (const p of cart.pieces) {
    // 장비는 나이를 먹지 않는다 (닳는 것은 쓸 때)
    if (p.uses !== undefined) continue;
    for (const l of p.lots) {
      l.age += rate;
      const life = itemShelfLife(l.good);
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
export function movePiece(cart: Board, pieceId: number, x: number, y: number, rot: number): boolean {
  const p = cart.pieces.find((q) => q.id === pieceId);
  if (!p) return false;
  // 같은 물품 조각 위에 놓았나: 놓을 자리 왼쪽 위 칸이 그 조각 칸이면 합친다
  const target = cart.pieces.find(
    (q) => q.id !== p.id && q.good === p.good && pieceCells(q).some(([cx, cy]) => cx === x && cy === y),
  );
  if (target && p.incoming.length === 0 && p.uses === undefined && target.uses === undefined) {
    const n = Math.min(roomIn(cart, target), qtyOf(p));
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
export function rotatePiece(cart: Board, pieceId: number): boolean {
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
export function discardPiece(cart: Board, pieceId: number): ItemLot[] | null {
  const p = cart.pieces.find((q) => q.id === pieceId);
  if (!p || p.incoming.length > 0) return null;
  cart.pieces = cart.pieces.filter((q) => q !== p);
  return p.lots;
}

/**
 * 빈칸 정리: 조각을 큰 것부터 다시 놓는다. 다 들어가지 않으면 원래대로 두고 false.
 * 같은 물품은 먼저 합쳐 조각 수를 줄인다 (신청이 걸린 조각은 그대로 둔다)
 */
export function packCart(cart: Board): boolean {
  const before = JSON.stringify(cart);
  // 합치기
  for (const p of cart.pieces) {
    if (p.incoming.length) continue;
    for (const q of cart.pieces) {
      if (q === p || q.good !== p.good || q.incoming.length || qtyOf(q) === 0 || p.uses !== undefined || q.uses !== undefined) continue;
      const n = Math.min(roomIn(cart, p), qtyOf(q));
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

function takeFromPiece(p: Piece, qty: number): ItemLot[] {
  const out: ItemLot[] = [];
  let left = qty;
  for (const l of [...p.lots].sort((a, b) => a.age - b.age)) {
    if (left <= 0) break;
    const n = Math.min(l.qty, left);
    l.qty -= n;
    left -= n;
    out.push(withCost<ItemLot>({ good: l.good, qty: n, age: l.age }, l.cost));
  }
  p.lots = p.lots.filter((l) => l.qty > 0);
  return out;
}

/** 빈 묶음을 지우고, 물건도 잡아 둔 자리도 없는 조각을 치운다 */
function tidy(cart: Board): void {
  for (const p of cart.pieces) p.lots = p.lots.filter((l) => l.qty > 0);
  cart.pieces = cart.pieces.filter((p) => p.lots.length > 0 || p.incoming.length > 0);
}
