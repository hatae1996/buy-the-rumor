// 인장 그림 (0.2.1): assets/badge/<인장 id>.png. 지금은 "개척 상인"(pioneer) 하나.
// 다른 인장은 등급 색으로 바꿔 쓰는 메달이라 그림이 없고, 그림이 없는 인장은 등급 색 메달에 이름 첫 글자로 그린다.
// 원본(1254×1254)은 게임 빌드에 들어가지 않는 assets-src/badge/에 두고, npm run badges가 512로 줄여 여기에 넣는다.
const FILES = import.meta.glob<string>('../../assets/badge/*.png', { eager: true, query: '?url', import: 'default' });

const ART: Record<string, string> = Object.fromEntries(
  Object.entries(FILES).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -'.png'.length), url]),
);

/** 인장 그림 주소. 없으면 null */
export function badgeArt(id: string): string | null {
  return ART[id] ?? null;
}
