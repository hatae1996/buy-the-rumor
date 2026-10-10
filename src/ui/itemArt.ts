// 짐 그림 (assets/ui/goods/<물품>.png). 그림이 있는 물품만, 없으면 null (장비와 여행 식량은 색 조각으로 그린다).
// 지금 그림은 예전 그림판(sheet A)에서 잘랐다 (scripts/ui/cut_sheets.py). 로우폴리 물품 그림이 오면 같은 이름으로 바꾸면 된다.
import type { ItemId } from '../sim/cart';

const FILES = import.meta.glob<string>('../../assets/ui/goods/*.png', { eager: true, query: '?url', import: 'default' });

const ART = new Map(Object.entries(FILES).map(([path, url]) => [path.split('/').pop()!.replace(/\.png$/, ''), url]));

export function itemArt(item: ItemId): string | null {
  return ART.get(item) ?? null;
}
