// 마을 탭 (기획서 "화면 구성", 0.0.5 → 0.1.6 목업 docs/reference/town-tab-mockup-0.1.6.png): "여기서 무엇을 할까".
// 크림 바탕에 마을 이름과 특색, 그 마을에 있는 건물만 보인다. 길 위에서는 길 화면 (travel.ts)
// 건물을 누르면 그 건물 쪽지(시장, 여관, 잡화점, 바깥, 창고, 마구간, 수레방, 작업장, 은행, 길드 회관)가 열린다.
import sprigL from '../../../assets/ui/orn_sprig_l.png';
import sprigR from '../../../assets/ui/orn_sprig_r.png';
import wavesImg from '../../../assets/ui/orn_waves.png';
import sproutImg from '../../../assets/ui/icon_sprout.png';
import fishIcon from '../../../assets/ui/icon_fish.png';
import wheatIcon from '../../../assets/ui/icon_wheat.png';
import coinImg from '../../../assets/ui/coin.png';
import trophyImg from '../../../assets/ui/rank_trophy.png';
import { GOOD_NAME, type GoodId } from '../../sim/economy/goods';
import { SEASON_NAME } from '../../sim/season';
import type { ResourceKind, Terrain } from '../../sim/worldgen';
import { itemArt } from '../itemArt';
import type { BuildingId } from '../../sim/growth';
import type { PlayerView } from '../../sim/economy';
import type { Game } from '../game';
import { travelHtml } from './travel';
import { buildingCards, openBuilding } from './buildings';
import { openArrivalSheet } from './arrivalSheet';
import { portraitHtml } from '../portrait/portrait';
import type { Look } from '../../sim/looks';

/** 마을 땅의 말 (부제와 땅 칩) */
const TERRAIN_WORD: Record<Terrain, string> = {
  sea: '바닷가',
  coast: '바닷가',
  plain: '들판',
  forest: '숲속',
  hills: '언덕',
  mountain: '산골',
};

/** 자원지에서 나는 대표 물품 (특산 칩) */
const SPECIALTY_GOOD: Record<ResourceKind, GoodId> = {
  forest: 'wood',
  ore: 'ore',
  field: 'grain',
  fish: 'fish',
  salt: 'salt',
};

/** 땅 칩 아이콘: 바닷가는 물고기, 들판은 밀, 나머지는 새싹 */
function terrainIcon(t: Terrain): string {
  return t === 'coast' || t === 'sea' ? fishIcon : t === 'plain' ? wheatIcon : sproutImg;
}

/** 마을 이름, 부제, 계절 칩, 땅과 특산 칩 */
function townHead(game: Game, v: PlayerView, place: string): string {
  const season = `<span class="town-season"><img src="${sproutImg}" alt="" />${SEASON_NAME[v.season]}</span>`;
  const title = `<div class="town-title">
      <img class="town-sprig" src="${sprigL}" alt="" />
      <h2>${place}</h2>
      <img class="town-sprig" src="${sprigR}" alt="" />
    </div>`;
  if (v.location.kind !== 'town') return '';
  const town = game.map.towns[v.location.town]!;
  const terrain = game.map.tiles[town.tile]!.terrain;
  const word = TERRAIN_WORD[terrain];
  const city = town.tier === 'city';
  const goods = town.specialties.map((k) => SPECIALTY_GOOD[k]);
  const goodsChip = goods.length
    ? `<span class="town-chip"><img src="${itemArt(goods[0]!) ?? wheatIcon}" alt="" />${goods.map((g) => GOOD_NAME[g]).join(' · ')}</span>`
    : `<span class="town-chip"><img src="${coinImg}" alt="" />사람과 돈이 많아요</span>`;
  return `<header class="town-head">
      ${title}
      ${season}
      <p class="town-sub"><img src="${wavesImg}" alt="" /><span>${word} ${city ? '교역 도시' : '생산 마을'}</span><img src="${wavesImg}" alt="" /></p>
      <div class="town-chips">
        <span class="town-chip"><img src="${terrainIcon(terrain)}" alt="" />${word} ${city ? '도시' : '마을'}</span>
        ${goodsChip}
      </div>
    </header>`;
}

const TEST_BTN = '<button type="button" class="test-btn" data-pass-day>시험용: 장날 열기</button>';

export interface TownScreenActions {
  /** 지금 실제 시각 (도착 예상 시각을 셈한다) */
  now: number;
  passDay: () => void;
  passApprenticeDay: () => void;
  openSettlement: () => void;
  /** 짐칸 탭으로 (길 위 "짐칸 정리") */
  openCart: () => void;
}

/** 시즌이 끝났으면 결산 카드 (다음 시즌을 시작할 때까지 날이 가지 않는다) */
function settlementCard(v: PlayerView): string {
  if (!v.settlement) return '';
  return `<section class="town-pin settle">
      <img class="town-pin-pic" src="${trophyImg}" alt="" />
      <div class="town-pin-text">
        <h2>${v.settlement.season}시즌이 끝났어요</h2>
        <p>마지막 장날 뒤 순위를 매겼어요. 결산을 보고 다음 시즌을 시작하세요.</p>
      </div>
      <button type="button" class="cv-btn coral" data-settlement>결산 보기</button>
    </section>`;
}

/** 견습: 지금 장면과 노상인 한마디, 하루 보내기 (대사와 연출은 나중 버전) */
function apprenticeCard(v: PlayerView, elder: Look | null): string {
  const ap = v.apprentice;
  if (!ap) return '';
  return `<section class="town-pin apprentice">
      <span class="town-pin-face">${portraitHtml(elder, 64, '노상인')}</span>
      <div class="town-pin-text">
        <h2>견습 · ${ap.title}<span class="town-pin-step">${ap.step} / ${ap.steps}</span></h2>
        <p class="town-pin-say">${ap.hint}</p>
      </div>
      <button type="button" class="cv-btn outline" data-apprentice-day>하루 보내기<small>견습 마을에서만 바로 다음 날로</small></button>
    </section>`;
}

export function renderTown(el: HTMLElement, game: Game, v: PlayerView, act: TownScreenActions): void {
  // 서버 게임에는 시험용 장날 열기가 없다 (장날은 서버가 연다)
  const test = v.settlement || game.server ? '' : TEST_BTN;
  el.innerHTML =
    v.location.kind === 'road'
      ? `${settlementCard(v)}${travelHtml(game, v, act.now, test)}`
      : `
    ${townHead(game, v, game.map.towns[v.location.town]!.name)}
    ${settlementCard(v)}
    ${apprenticeCard(v, v.apprentice ? (game.faces()?.elder ?? null) : null)}
    ${buildingCards(game, v, test)}
  `;

  el.querySelectorAll<HTMLButtonElement>('[data-building]').forEach((b) =>
    b.addEventListener('click', () => openBuilding(game, b.dataset.building as BuildingId)),
  );
  el.querySelector('[data-arrival]')?.addEventListener('click', () => openArrivalSheet(game));
  el.querySelector('[data-open-cart]')?.addEventListener('click', act.openCart);
  el.querySelector('[data-pass-day]')?.addEventListener('click', act.passDay);
  el.querySelector('[data-settlement]')?.addEventListener('click', act.openSettlement);
  el.querySelector('[data-apprentice-day]')?.addEventListener('click', act.passApprenticeDay);
}
