// 마을 탭 건물 (기획서 "화면 구성 - 마을 탭: 건물 카드", 0.1.6 목업 docs/reference/town-tab-mockup-0.1.6.png).
// 시장은 큰 카드, 여관과 바깥은 반 카드, 나머지 시설은 목록 줄, 신문팔이는 얇은 줄.
// 그 마을에 있는 건물만 보이고, 지금 할 일이 있으면 도장(!)이 찍힌다. 누르면 그 건물 쪽지가 열린다.
import anvilImg from '../../../../assets/ui/bld_anvil.png';
import innImg from '../../../../assets/ui/bld_inn.png';
import marketImg from '../../../../assets/ui/bld_market.png';
import outsideImg from '../../../../assets/ui/bld_outside.png';
import storeImg from '../../../../assets/ui/bld_store.png';
import warehouseImg from '../../../../assets/ui/bld_warehouse.png';
import arrowImg from '../../../../assets/ui/icon_arrow.png';
import chevronImg from '../../../../assets/ui/icon_chevron.png';
import bankImg from '../../../../assets/ui/bld_bank.png';
import fieldImg from '../../../../assets/ui/field.png';
import paperImg from '../../../../assets/ui/newsstand.png';
import sealImg from '../../../../assets/ui/bld_guild.png';
import smithyImg from '../../../../assets/ui/bld_workshop.png';
import type { BuildingId } from '../../../sim/growth';
import type { PlayerView } from '../../../sim/economy';
import { euro } from '../../../sim/josa';
import type { Game } from '../../game';
import { openCartShopSheet, openStableSheet } from '../horseSheet';
import { openInn } from './inn';
import { openMarket } from './market';
import { openBank, openGuildHall, openOutside, openStore, openWorkshop } from './simple';
import { openWarehouse } from './warehouse';
import { openNewsboy } from '../newspaper';
import { portraitHtml } from '../../portrait/portrait';

// 로우폴리 그림이 아직 없는 시설(마구간)은 예전 그림
const IMG: Record<BuildingId, string> = {
  market: marketImg,
  inn: innImg,
  newsboy: paperImg,
  store: storeImg,
  outside: outsideImg,
  warehouse: warehouseImg,
  stable: fieldImg,
  cartShop: anvilImg,
  workshop: smithyImg,
  bank: bankImg,
  guildHall: sealImg,
};

const CHEVRON = `<img class="town-chevron" src="${chevronImg}" alt="" />`;

/** 카드 아래 한 줄 (지금 상태) */
function status(id: BuildingId, v: PlayerView): string {
  const here = v.location.kind === 'town' ? v.location.town : -1;
  switch (id) {
    case 'market': {
      const n = v.orders.filter((o) => o.town === here).length;
      return n ? `신청 ${n}건이 걸려 있어요` : '오늘의 시세를 확인하세요';
    }
    case 'inn':
      return v.apprentice ? '묵기' : v.hireBoard.length ? '소문 · 구인' : '소문 · 묵기';
    case 'newsboy':
      return v.newspaper.onSale === null
        ? '새로운 신문이 없어요.'
        : v.newspaper.onSale.bought
          ? '오늘 신문을 샀어요.'
          : `오늘 신문이 나왔어요${v.newspaper.free ? '.' : ` · ${v.newspaper.fee}골드`}`;
    case 'store':
      return v.gear.some((g) => g.uses === 0) ? '장비 수리' : '음식 · 장비';
    case 'outside':
      return `탐색 기회 ${v.expeditionChances} / 6`;
    case 'warehouse': {
      const w = v.warehouses.find((x) => x.town === here);
      return w ? `짐 ${w.count}개 보관 중` : '보관 · 빌리기';
    }
    case 'stable': {
      const left = v.stable?.horses.reduce((s, h) => s + h.stock, 0) ?? 0;
      return left ? `말 ${left}마리` : '남은 말 없음';
    }
    case 'cartShop':
      return `지금 ${v.cart.name}`;
    case 'workshop':
      return '대장간 · 염장';
    case 'bank':
      return `이자 ${Math.round(v.bank.depositRate * 100)}%`;
    case 'guildHall': {
      const done = v.guild.quests.filter((q) => q.tier).length;
      return `의뢰 ${done}/${v.guild.quests.length}`;
    }
  }
}

const alertHtml = (b: PlayerView['buildings'][number]): string =>
  b.alert ? `<span class="building-alert" title="${b.alert}">!</span>` : '';

/** 마을 탭 건물들. sectionExtra는 "마을 시설" 제목 줄 오른쪽에 붙는다 (시험용 단추) */
export function buildingCards(game: Game, v: PlayerView, sectionExtra = ''): string {
  // 견습 동안은 장면 하나에 새것 하나만: 시장, 여관, 잡화점, 바깥만
  // 신문팔이는 첫 신문 장면부터 (소식 탭이 열릴 때, 0.1.2)
  const apprenticeShown = ['market', 'inn', 'store', 'outside', ...(v.unlocks.includes('news') ? ['newsboy'] : [])];
  const shown = v.apprentice ? v.buildings.filter((b) => apprenticeShown.includes(b.id)) : v.buildings;
  const market = shown.find((b) => b.id === 'market');
  const halves = shown.filter((b) => b.id === 'inn' || b.id === 'outside');
  const rows = shown.filter((b) => !['market', 'inn', 'outside', 'newsboy'].includes(b.id));
  const news = shown.find((b) => b.id === 'newsboy');
  // 시장 카드에 장 상인 얼굴 (0.1.4, 자리만)
  const merchant = market ? game.faces()?.merchant : null;

  const marketHtml = market
    ? `<button type="button" class="town-hero" data-building="market">
        <span class="town-hero-text">
          <span class="town-hero-name">${market.name}</span>
          <small>${status('market', v)}</small>
          <span class="town-go">${euro(market.name)} <img src="${arrowImg}" alt="" /></span>
        </span>
        <img class="town-hero-img" src="${IMG.market}" alt="" />
        ${merchant ? `<span class="building-face">${portraitHtml(merchant, 34, '장 상인')}</span>` : ''}
        ${alertHtml(market)}
      </button>`
    : '';
  // 바깥이 없는 마을(도시 등)은 신문팔이를 반 카드 자리에 올린다 (한 화면에 넣으려고)
  const newsHalf = news && !halves.some((b) => b.id === 'outside');
  if (newsHalf) halves.push(news);
  const halfHtml = halves.length
    ? `<div class="town-halves">${halves
        .map(
          (b) => `<button type="button" class="town-half" data-building="${b.id}">
            <span class="town-half-name">${b.name}</span>
            <small>${status(b.id, v)}</small>
            <img class="town-half-img${b.id === 'newsboy' ? ' small' : ''}" src="${IMG[b.id]}" alt="" />
            ${CHEVRON}
            ${alertHtml(b)}
          </button>`,
        )
        .join('')}</div>`
    : '';
  const rowHtml = rows.length
    ? `<div class="town-section"><h3>마을 시설</h3>${sectionExtra}</div>
      <div class="town-rows${rows.length > 4 ? ' many' : ''}">${rows
        .map(
          (b) => `<button type="button" class="town-row" data-building="${b.id}">
            <span class="town-row-pic"><img src="${IMG[b.id]}" alt="" /></span>
            <span class="town-row-text"><span class="town-row-name">${b.name}</span><small>${status(b.id, v)}</small></span>
            ${alertHtml(b)}
          </button>`,
        )
        .join('')}</div>`
    : '';
  const newsHtml = news && !newsHalf
    ? `<button type="button" class="town-news" data-building="newsboy">
        <img src="${IMG.newsboy}" alt="" />
        <span class="town-row-name">${news.name}</span>
        <small>${status('newsboy', v)}</small>
        ${alertHtml(news)}
      </button>`
    : '';
  return marketHtml + halfHtml + (rowHtml || sectionExtra) + newsHtml;
}

export function openBuilding(game: Game, id: BuildingId): void {
  const open: Record<BuildingId, () => void> = {
    market: () => openMarket(game),
    inn: () => openInn(game),
    newsboy: () => openNewsboy(game),
    store: () => openStore(game),
    outside: () => openOutside(game),
    warehouse: () => openWarehouse(game),
    stable: () => openStableSheet(game),
    cartShop: () => openCartShopSheet(game),
    workshop: () => openWorkshop(game),
    bank: () => openBank(game),
    guildHall: () => openGuildHall(game),
  };
  open[id]();
}
