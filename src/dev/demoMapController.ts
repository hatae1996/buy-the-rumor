// 개발용 3D 지도 시험: 경제 상태 없이 마을을 누르면 말이 바로 길을 따라 간다 (날짜는 흐르지 않음).
// 실제 게임 지도는 src/ui/mapScreen.ts가 경제 상태를 따라 그린다.
import type { Season } from '../sim/season';
import { findRoute, type WorldMap } from '../sim/worldgen';
import { euro } from '../sim/josa';
import { MapView, PAWN_COLORS, type MapStyle } from '../view3d';

export class DemoMapController {
  readonly view: MapView;
  private map: WorldMap | null = null;
  private season: Season = 2;
  private here = 0;

  constructor(
    container: HTMLElement,
    private readonly onStatus: (text: string) => void = () => {},
  ) {
    this.view = new MapView(container, { onTownTap: (id) => void this.travelTo(id) });
  }

  setWorld(map: WorldMap): void {
    this.map = map;
    this.here = 0;
    this.view.setWorld(map);
    // 내 말은 첫 마을, 다른 상단들은 나머지 마을에
    this.view.setPawns(
      map.towns.map((t, i) => ({ key: i === 0 ? 'me' : `other-${i}`, color: PAWN_COLORS[i]!, tile: t.tile, slot: i })),
    );
    this.status();
  }

  setSeason(season: Season): void {
    this.season = season;
    this.view.setSeason(season);
    if (!this.view.moving) this.status();
  }

  setStyle(style: Partial<MapStyle>): Promise<void> {
    return this.view.setStyle(style);
  }

  setActive(active: boolean): void {
    this.view.setActive(active);
  }

  private async travelTo(townId: number): Promise<void> {
    const map = this.map;
    if (!map || this.view.moving || townId === this.here) return;
    const route = findRoute(map, this.here, townId, this.season);
    const name = map.towns[townId]!.name;
    if (!route) {
      this.onStatus(`${euro(name)} 가는 길이 막혔어요.`);
      return;
    }
    this.onStatus(`${euro(name)} 가는 중 · ${route.days}일 걸려요`);
    await this.view.animatePawn('me', route.tiles, 0);
    this.here = townId;
    this.onStatus(`${name}에 도착했어요. ${route.days}일 걸렸어요.`);
  }

  private status(): void {
    if (!this.map) return;
    const name = this.map.towns[this.here]!.name;
    const snow = this.season === 3 ? ' 겨울엔 산과 언덕 길이 눈 때문에 느려요.' : '';
    this.onStatus(`${name}에 있어요. 다른 마을을 눌러 보세요.${snow}`);
  }
}
