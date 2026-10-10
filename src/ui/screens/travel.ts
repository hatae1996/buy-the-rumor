// 마을 탭의 길 위 화면 (0.1.6 목업 docs/reference/travel-mockup-0.1.6.png): "어디로 가는 길이고 언제 닿나".
// 계절별 길 그림 위를 말과 수레가 가고, 아래에 길 카드(떠난 마을 → 갈 마을, 도착 시각), 식량, 도착 준비(도착하면 팔기, 짐칸).
// 스크롤 없이 한 화면: 길 그림이 남은 높이를 차지한다.
import sprigL from '../../../assets/ui/orn_sprig_l.png';
import sprigR from '../../../assets/ui/orn_sprig_r.png';
import sproutImg from '../../../assets/ui/icon_sprout.png';
import arrowImg from '../../../assets/ui/icon_arrow.png';
import chevronImg from '../../../assets/ui/icon_chevron.png';
import noticeImg from '../../../assets/ui/icon_notice.png';
import fromHouse from '../../../assets/ui/tab_town.png';
import toHouse from '../../../assets/ui/travel_house.png';
import foodImg from '../../../assets/ui/travel_food.png';
import pawnImg from '../../../assets/ui/travel_wagon.png';
import marketImg from '../../../assets/ui/bld_market.png';
import roadSpring from '../../../assets/ui/road_spring.png';
import roadSummer from '../../../assets/ui/road_summer.png';
import roadAutumn from '../../../assets/ui/road_autumn.png';
import roadWinter from '../../../assets/ui/road_winter.png';
import type { PlayerView } from '../../sim/economy';
import { euro } from '../../sim/josa';
import { DAY_MS, type Game } from '../game';
import { clockAtText, durationText } from '../format';
import { RIG_ASPECT, RIG_PARTS, type RigPart } from '../travelRigLayout';

// 길 위 마차 부품 (assets/ui/rig/, scripts/ui/cut_wagon_parts.py)
const RIG_FILES = import.meta.glob<string>('../../../assets/ui/rig/*.png', { eager: true, query: '?url', import: 'default' });
const RIG_IMG = new Map(Object.entries(RIG_FILES).map(([path, url]) => [path.split('/').pop()!.replace(/\.png$/, ''), url]));

/** 부품 이름 → 그림 이름 (nearRearRim → rim_near) */
function rigFile(name: string): string {
  if (name === 'body' || name === 'horse') return name === 'horse' ? 'horse_walk' : 'body';
  if (name.startsWith('shaft')) return name === 'shaftNear' ? 'shaft_near' : 'shaft_far';
  const side = name.startsWith('near') ? 'near' : 'far';
  const kind = name.endsWith('Spokes') ? 'spokes' : name.endsWith('Rim') ? 'rim' : 'hub';
  return `${kind}_${side}`;
}

/** 말과 마차: 바퀴살은 돌고, 말은 걷기 그림을 넘기고, 몸체는 덜컹거린다 */
function rigHtml(): string {
  const box = (p: RigPart) => `left:${p.x}%;top:${p.y}%;width:${p.w}%;height:${p.h}%`;
  const parts = RIG_PARTS.map((p) => {
    const src = RIG_IMG.get(rigFile(p.name)) ?? '';
    if (p.frames) return `<span class="rig-part rig-horse" style="${box(p)};background-image:url('${src}')"></span>`;
    if (p.squash) return `<span class="rig-part rig-wheel" style="${box(p)};--squash:${p.squash}"><img src="${src}" alt="" /></span>`;
    return `<img class="rig-part${p.name === 'body' ? ' rig-body' : ''}" style="${box(p)}" src="${src}" alt="" />`;
  }).join('');
  return `<div class="trip-rig" style="aspect-ratio:${RIG_ASPECT}">${parts}</div>`;
}

/** 계절(봄, 여름, 가을, 겨울)별 길 그림 */
const ROAD = [roadSpring, roadSummer, roadAutumn, roadWinter] as const;

/** 남은 식량 (0.1.2): 남은 길에 먹을 만큼 있는지 */
function foodCard(v: PlayerView, daysLeft: number): string {
  const need = Math.ceil(daysLeft) * v.food.perDay;
  const have = v.food.have;
  const people = v.food.perDay > 1 ? `${v.food.perDay}명이 ` : '';
  const line =
    have >= need
      ? `<small class="ok">남은 길 ${daysLeft}일, ${people}먹기 넉넉해요</small>`
      : `<small class="warn">남은 길에 ${need}이 필요해요</small>`;
  return `<section class="trip-food">
      <img src="${foodImg}" alt="" />
      <div><span class="trip-food-have">남은 식량 ${have}</span>${line}</div>
    </section>`;
}

/** 길 위 화면 전체 (머리부터). sectionExtra는 "도착 준비" 제목 줄 오른쪽 (시험용 단추) */
export function travelHtml(game: Game, v: PlayerView, now: number, sectionExtra: string): string {
  if (v.location.kind !== 'road') return '';
  const name = (id: number) => game.map.towns[id]!.name;
  const { from, to, days, daysLeft } = v.location;
  const msLeft = game.msUntilArrival(daysLeft, now);
  // 간 만큼: 지난 날 + 오늘 하루 중 지난 몫 (견습은 날 단위로만)
  const todayDone = msLeft === null ? 0 : 1 - game.msUntilMarket(now) / DAY_MS;
  const pct = Math.round(Math.min(1, Math.max(0, (days - daysLeft + todayDone) / days)) * 100);
  const eta = msLeft === null ? '도착까지' : `${clockAtText(now + msLeft, now)} 도착 예정`;
  const left = msLeft === null ? `${daysLeft}일 남음` : `${durationText(msLeft)} 남음`;

  const reserved = v.reservations.some((r) => r.kind === 'onArrival');
  const arrival = v.unlocks.includes('reservation')
    ? `<button type="button" class="trip-arrival" data-arrival>
        <img class="trip-arrival-img" src="${marketImg}" alt="" />
        <span class="trip-arrival-text">
          <span class="trip-arrival-name">도착하면 팔기</span>
          <small>${reserved ? '예약해 둔 것이 있어요' : '첫 장날에 팔 물건을 예약해요'}</small>
          <span class="town-go">${reserved ? '예약 보기' : '판매 예약'} <img src="${arrowImg}" alt="" /></span>
        </span>
      </button>`
    : '';
  const cart = v.unlocks.includes('cart')
    ? `<button type="button" class="town-row trip-cart" data-open-cart>
        <span class="town-row-pic"><img src="${pawnImg}" alt="" /></span>
        <span class="town-row-text"><span class="town-row-name">짐칸 정리</span><small>가져가는 물건을 확인해요</small></span>
        <img class="town-chevron" src="${chevronImg}" alt="" />
      </button>`
    : '';
  const notice = `길 위에서는 장에 신청할 수 없어요.${v.warehouses.length ? ' 창고 짐은 장부 탭에서 팔아요.' : ''}`;

  return `
    <header class="town-head trip-head">
      <div class="town-title">
        <img class="town-sprig" src="${sprigL}" alt="" />
        <h2>${euro(name(to))} 가는 길</h2>
        <img class="town-sprig" src="${sprigR}" alt="" />
      </div>
      <span class="town-chip trip-moving"><img src="${sproutImg}" alt="" />이동 중</span>
    </header>
    <div class="trip-scene" aria-hidden="true">
      <div class="trip-stage">
        <img class="trip-road" src="${ROAD[v.season]}" alt="" />
        <span class="trip-dust"><i></i><i></i><i></i></span>
        ${rigHtml()}
      </div>
    </div>
    <section class="trip-card">
      <div class="trip-ends"><span>${name(from)}</span><span>${name(to)}</span></div>
      <div class="trip-track">
        <img class="trip-house" src="${fromHouse}" alt="" />
        <span class="trip-line">
          <span class="trip-done" style="width:${pct}%"></span>
          <img class="trip-pawn" style="--pct:${pct / 100}" src="${pawnImg}" alt="" />
        </span>
        <img class="trip-house" src="${toHouse}" alt="" />
      </div>
      <p class="trip-eta">${eta}</p>
      <p class="trip-left">${left}</p>
    </section>
    ${foodCard(v, daysLeft)}
    ${arrival || cart || sectionExtra ? `<div class="town-section"><h3>도착 준비</h3>${sectionExtra}</div>` : ''}
    ${arrival}
    ${cart}
    <p class="trip-notice"><img src="${noticeImg}" alt="" />${notice}</p>
  `;
}
