// 자원지 표시 (로우폴리): 칸 위에 그 자원을 얻는 모습을 작게 세운다.
// 곡물밭은 이랑과 밀 다발, 광맥은 바위 무더기와 파란 결정과 광산 입구, 소금은 염전 판과 소금 더미, 생선은 돛단배와 부두.
// 숲은 숲 칸 자체가 자원지라 따로 표시하지 않는다.
// 표시는 칸을 돌리지 않고 늘 화면 앞쪽(+z) 가장자리에 둔다 (산·언덕 소품에 가리지 않게). 배는 옆 바다 칸 쪽 물 위에 띄운다.
import type { Season } from '../sim/season';
import type { Tile } from '../sim/worldgen';
import { tileTop } from './layout';
import type { InstanceBatcher, Placement } from './batcher';
import type { MaterialKit } from './materials';
import type { PropGeometries } from './props';
import { BASE_HEIGHT, RESOURCE_COLOR as C } from './palette';

const BASE_SEA = BASE_HEIGHT.sea;

/** 칸 가운데 기준 자리 (돌리지 않음) */
export type Fixed = (dx: number, dz: number, dy: number, scale: number | readonly [number, number, number], rotY?: number) => Placement;

/** 해안 칸에서 이웃한 바다 칸 쪽 방향 (단위 벡터). 없으면 null */
export type SeaDir = readonly [number, number] | null;

export function addResource(t: Tile, b: InstanceBatcher, geo: PropGeometries, kit: MaterialKit, season: Season, at: Fixed, sea: SeaDir): void {
  switch (t.resource) {
    case 'field':
      addField(b, geo, kit, season, at);
      break;
    case 'ore':
      addOre(b, geo, kit, at);
      break;
    case 'salt':
      addSalt(b, geo, kit, at);
      break;
    case 'fish':
      addBoat(b, geo, kit, at, sea, tileTop(t));
      break;
    default:
      break;
  }
}

/** 곡물밭: 흙 이랑 세 줄에 금색 밀 다발. 겨울엔 거둬들여 이랑만 */
function addField(b: InstanceBatcher, geo: PropGeometries, kit: MaterialKit, season: Season, at: Fixed): void {
  const soil = kit.solid(season === 3 ? C.soilWinter : C.soil);
  for (const z of [-0.3, 0, 0.3]) b.add(geo.box, soil, at(0, z, 0.025, [1.05, 0.05, 0.13]));
  if (season === 3) return;
  const wheat = [kit.solid(C.wheat), kit.solid(C.wheatDark)];
  [-0.3, 0, 0.3].forEach((z, row) => {
    for (const x of row === 1 ? [-0.36, -0.12, 0.12, 0.36] : [-0.28, 0, 0.28]) {
      b.add(geo.bundle, wheat[(row + Math.round(x * 10)) & 1]!, at(x, z, 0.05 + 0.11, [0.06, 0.22, 0.06], x * 7));
    }
  });
}

/** 광맥: 바위 무더기 사이로 파란 결정이 솟고, 옆에 나무 기둥으로 받친 광산 입구 */
function addOre(b: InstanceBatcher, geo: PropGeometries, kit: MaterialKit, at: Fixed): void {
  const rock = kit.solid(C.oreRock);
  b.add(geo.rock, rock, at(-0.3, 0.45, 0.07, [0.17, 0.13, 0.15], 0.4));
  b.add(geo.rock, rock, at(-0.08, 0.55, 0.05, [0.12, 0.1, 0.11], 1.3));
  const crystal = kit.solid(C.crystal);
  b.add(geo.crystal, crystal, at(-0.24, 0.5, 0.19, [0.055, 0.17, 0.055], 0.2));
  b.add(geo.crystal, crystal, at(-0.13, 0.46, 0.15, [0.045, 0.13, 0.045], 0.9));
  b.add(geo.crystal, crystal, at(-0.36, 0.56, 0.12, [0.04, 0.1, 0.04], 1.6));
  // 광산 입구: 어두운 굴 앞에 기둥 둘과 들보
  const wood = kit.solid(C.mineWood);
  b.add(geo.box, kit.solid(C.mineHole), at(0.28, 0.42, 0.12, [0.2, 0.24, 0.04]));
  b.add(geo.box, wood, at(0.16, 0.45, 0.13, [0.045, 0.26, 0.045]));
  b.add(geo.box, wood, at(0.4, 0.45, 0.13, [0.045, 0.26, 0.045]));
  b.add(geo.box, wood, at(0.28, 0.45, 0.27, [0.32, 0.05, 0.07]));
}

/** 소금: 얕은 염전 판 위에 하얀 소금 더미 넷 */
function addSalt(b: InstanceBatcher, geo: PropGeometries, kit: MaterialKit, at: Fixed): void {
  b.add(geo.box, kit.solid(C.saltPanRim), at(0, 0.2, 0.025, [0.8, 0.05, 0.6]));
  b.add(geo.box, kit.solid(C.saltPan), at(0, 0.2, 0.035, [0.7, 0.05, 0.5]));
  const salt = kit.solid(C.salt);
  b.add(geo.spike, salt, at(-0.17, 0.08, 0.16, [0.17, 0.24, 0.17], 0.3));
  b.add(geo.spike, salt, at(0.15, 0.1, 0.14, [0.15, 0.2, 0.15], 1.1));
  b.add(geo.spike, salt, at(-0.05, 0.32, 0.13, [0.14, 0.19, 0.14], 2));
  b.add(geo.spike, salt, at(0.22, 0.33, 0.11, [0.11, 0.15, 0.11], 0.7));
}

/** 생선: 바다 쪽으로 뻗은 부두와 그 끝 물 위의 돛단배 (바다 칸이 없으면 칸 앞쪽에) */
function addBoat(b: InstanceBatcher, geo: PropGeometries, kit: MaterialKit, at: Fixed, sea: SeaDir, top: number): void {
  const [ux, uz] = sea ?? [0, 1];
  const rot = -Math.atan2(uz, ux);
  const along = (d: number, dy: number, scale: readonly [number, number, number]) => at(ux * d, uz * d, dy, scale, rot);
  const dock = kit.solid(C.dock);
  b.add(geo.box, dock, along(0.62, 0.03, [0.7, 0.04, 0.16]));
  for (const d of [0.4, 0.75, 0.95]) b.add(geo.box, dock, along(d, -0.15, [0.04, 0.36, 0.04]));
  // 배는 칸 바깥 물 위 (바다 윗면 높이). 해안과 나란히 대어 돛의 넓은 면이 보이게 한다
  const water = BASE_SEA - top;
  const side = (d: number, dy: number, scale: readonly [number, number, number]) => at(ux * d, uz * d, dy, scale, rot + Math.PI / 2);
  b.add(geo.box, kit.solid(C.hull), side(1.2, water + 0.07, [0.56, 0.12, 0.22]));
  b.add(geo.box, kit.solid(C.hull), side(1.2, water + 0.15, [0.42, 0.05, 0.27]));
  b.add(geo.box, kit.solid(C.mast), side(1.2, water + 0.42, [0.03, 0.52, 0.03]));
  b.add(geo.sail, kit.solid(C.sail), at(ux * 1.2 + uz * 0.08, uz * 1.2 - ux * 0.08, water + 0.42, [0.2, 0.42, 0.03], rot + Math.PI / 2));
}
