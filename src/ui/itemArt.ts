// 짐 그림 (assets/ui/goods/<짐>.png): 물품 9, 장비 4, 여행 식량. 그림이 없으면 null (색 조각과 이름으로 그린다).
// 물품 그림은 로우폴리 그림을 짐 모양 비율로 잘랐다 (scripts/ui/cut_goods.py, 원본 assets-src/ui/goods/).
import type { ItemId } from '../sim/cart';

const FILES = import.meta.glob<string>('../../assets/ui/goods/*.png', { eager: true, query: '?url', import: 'default' });

const ART = new Map(Object.entries(FILES).map(([path, url]) => [path.split('/').pop()!.replace(/\.png$/, ''), url]));

export function itemArt(item: ItemId): string | null {
  return ART.get(item) ?? null;
}
