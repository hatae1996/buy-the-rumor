// 자동 생성 (scripts/ui/cut_carts.py). 고치지 말고 스크립트를 다시 돌린다.
// 수레·창고 그림(assets/ui/carts/<판>.png) 크기와, 그림 속 칸 격자 (0, 0) 칸의 왼쪽 위·칸 간격 (그림 px)
import type { CartType } from '../sim/cart';

export const CART_ART_LAYOUT: Record<CartType | 'warehouse', { w: number; h: number; x: number; y: number; pitch: number }> = {
  pack: { w: 1024, h: 991, x: 195.1, y: 281.7, pitch: 207.8 },
  handcart: { w: 544, h: 1024, x: 111.9, y: 144.5, pitch: 110.76 },
  wagon: { w: 631, h: 1024, x: 123.4, y: 154.5, pitch: 97.46 },
  carriage: { w: 671, h: 1024, x: 117.6, y: 141.8, pitch: 87.16 },
  warehouse: { w: 1024, h: 663, x: 60.6, y: 63.9, pitch: 180.72 },
};
