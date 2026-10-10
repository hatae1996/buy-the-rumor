// 마을 탭 건물 카드 (기획서 "화면 구성 - 마을 탭: 건물 카드", 시안 prototypes/screens-0.0.5.html).
// 그 마을에 있는 건물만 카드로 보이고, 지금 할 일이 있으면 도장(!)이 찍힌다. 누르면 그 건물 쪽지가 열린다.
import bankImg from '../../../../assets/ui/bank.png';
import fieldImg from '../../../../assets/ui/field.png';
import forestImg from '../../../../assets/ui/forest.png';
import innImg from '../../../../assets/ui/inn.png';
import marketImg from '../../../../assets/ui/market.png';
import mineImg from '../../../../assets/ui/mine.png';
import plankImg from '../../../../assets/ui/plank_long.png';
import seaImg from '../../../../assets/ui/sea.png';
import sealImg from '../../../../assets/ui/seal_big.png';
import smithyImg from '../../../../assets/ui/smithy.png';
import tagImg from '../../../../assets/ui/tag.png';
import paperImg from '../../../../assets/ui/paper_small.png';
import woodblockImg from '../../../../assets/ui/woodblock.png';
import type { BuildingId } from '../../../sim/growth';
import type { PlayerView } from '../../../sim/economy';
import type { Game } from '../../game';
import { openCartShopSheet, openStableSheet } from '../horseSheet';
import { openInn } from './inn';
import { openMarket } from './market';
import { openBank, openGuildHall, openOutside, openStore, openWorkshop } from './simple';
import { openWarehouse } from './warehouse';
import { openNewsboy } from '../newspaper';
import { portraitHtml } from '../../portrait/portrait';

const IMG: Record<BuildingId, string> = {
  market: marketImg,
  inn: innImg,
  newsboy: paperImg,
  store: tagImg,
  outside: forestImg,
  warehouse: woodblockImg,
  stable: fieldImg,
  cartShop: plankImg,
  workshop: smithyImg,
  bank: bankImg,
  guildHall: sealImg,
};

/** 바깥 그림은 그 마을 자원지에 맞춘다 (시세를 보면 아는 것이 아니라 마을 이름표의 특산으로) */
function outsideImg(game: Game, v: PlayerView): string {
  if (v.location.kind !== 'town') return forestImg;
  const spec = game.map.towns[v.location.town]!.specialties[0];
  return spec === 'ore' ? mineImg : spec === 'fish' || spec === 'salt' ? seaImg : spec === 'field' ? fieldImg : forestImg;
}

/** 카드 아래 한 줄 (지금 상태) */
function status(id: BuildingId, v: PlayerView): string {
  const here = v.location.kind === 'town' ? v.location.town : -1;
  switch (id) {
    case 'market': {
      const n = v.orders.filter((o) => o.town === here).length;
      return n ? `신청 ${n}건` : '오늘 시세';
    }
    case 'inn':
      return v.apprentice ? '묵기' : v.hireBoard.length ? '소문 · 구인' : '소문 · 묵기';
    case 'newsboy':
      return v.newspaper.onSale === null ? '신문 없음' : v.newspaper.onSale.bought ? '샀어요' : `오늘 신문${v.newspaper.free ? '' : ` ${v.newspaper.fee}냥`}`;
    case 'store':
      return v.gear.some((g) => g.uses === 0) ? '장비 수리' : '음식 · 장비';
    case 'outside':
      return `기회 ${v.expeditionChances} / 6`;
    case 'warehouse': {
      const w = v.warehouses.find((x) => x.town === here);
      return w ? `짐 ${w.count}개` : '빌리기';
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

export function buildingCards(game: Game, v: PlayerView): string {
  // 견습 동안은 장면 하나에 새것 하나만: 시장, 여관, 잡화점, 바깥만
  // 신문팔이는 첫 신문 장면부터 (소식 탭이 열릴 때, 0.1.2)
  const apprenticeShown = ['market', 'inn', 'store', 'outside', ...(v.unlocks.includes('news') ? ['newsboy'] : [])];
  const shown = v.apprentice ? v.buildings.filter((b) => apprenticeShown.includes(b.id)) : v.buildings;
  // 시장 카드에 장 상인 얼굴 (0.1.4, 자리만)
  const merchant = shown.some((b) => b.id === 'market') ? game.faces()?.merchant : null;
  return `<div class="building-grid">${shown
    .map(
      (b) => `<button type="button" class="building-card" data-building="${b.id}">
        <img src="${b.id === 'outside' ? outsideImg(game, v) : IMG[b.id]}" alt="" />
        <span class="building-name">${b.name}</span>
        <small>${status(b.id, v)}</small>
        ${b.id === 'market' && merchant ? `<span class="building-face">${portraitHtml(merchant, 34, '장 상인')}</span>` : ''}
        ${b.alert ? `<span class="building-alert" title="${b.alert}">!</span>` : ''}
      </button>`,
    )
    .join('')}</div>`;
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
