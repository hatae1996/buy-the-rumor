// 창고 (0.1.6 목업 docs/reference/warehouse-mockup-0.1.6.png): 위 줄 아래를 덮는 페이지.
// 빌리기 전에는 대여 조건과 좋은 점, 빌린 뒤에는 짐 넣고 빼기, 창고 짐으로 이 마을 장날에 팔기 (내가 없어도 맞춰진다).
// 기획서는 수레 판 두 개를 나란히 놓고 끌어 옮기는 화면이다. 지금은 물품마다 넣기·꺼내기 버튼으로 둔다.
import warehouseImg from '../../../../assets/ui/bld_warehouse.png';
import houseImg from '../../../../assets/ui/house_red.png';
import cellsImg from '../../../../assets/ui/warehouse_cells.png';
import coinImg from '../../../../assets/ui/coin.png';
import crateImg from '../../../../assets/ui/cargo_crate.png';
import marketImg from '../../../../assets/ui/bld_market.png';
import gatherImg from '../../../../assets/ui/report_gather.png';
import coinsImg from '../../../../assets/ui/coins_stack.png';
import infoImg from '../../../../assets/ui/icon_info.png';
import { GROWTH } from '../../../sim/constants';
import { isGood } from '../../../sim/cart';
import { count, GOODS, type GoodId, type PlayerView } from '../../../sim/economy';
import { goodName, money } from '../../format';
import type { Game } from '../../game';
import { itemArt } from '../../itemArt';
import { openLivePage } from '../../livePage';

const won = (n: number) => `${money(n)}골드`;

function stock(v: PlayerView, town: number): Record<GoodId, number> {
  const w = v.warehouses.find((x) => x.town === town);
  const out = Object.fromEntries(GOODS.map((g) => [g, 0])) as Record<GoodId, number>;
  for (const p of w?.pieces ?? []) if (isGood(p.good)) out[p.good] += p.qty;
  return out;
}

/** 그림, 제목과 설명, 오른쪽 값 한 줄 */
const infoRow = (img: string, title: string, text: string, value = '') =>
  `<li><img src="${img}" alt="" /><span><b>${title}</b><small>${text}</small></span>${value ? `<strong>${value}</strong>` : ''}</li>`;

export function openWarehouse(game: Game): void {
  const v0 = game.view();
  if (v0.location.kind !== 'town') return;
  const here = v0.location.town;
  const town = game.map.towns[here]!.name;
  openLivePage(game, { back: '마을', title: '창고', sub: town, icon: houseImg }, (body, v, page) => {
    if (v.location.kind !== 'town' || v.location.town !== here) {
      page.close();
      return;
    }
    const w = v.warehouses.find((x) => x.town === here);
    const cells = GROWTH.warehouse.rows.length * GROWTH.warehouse.rows[0]!.length;
    const per = GROWTH.warehouse.cellsPerCoin;
    const hero = `<section class="ware-hero">
        <img src="${warehouseImg}" alt="" />
        <div><h3>${town}에<br />짐을 맡기세요</h3><small>여행이 더 가벼워집니다.</small></div>
      </section>`;

    if (!w) {
      const fee = GROWTH.warehouse.deposit;
      body.innerHTML = `
        ${hero}
        <section class="shop-card">
          <div class="ware-head"><h3>창고 대여</h3><span class="paper-chip">미대여</span></div>
          <ul class="ware-rows">
            ${infoRow(cellsImg, '보관 공간', '보관할 수 있는 최대 칸 수예요.', `${cells}칸`)}
            ${infoRow(coinImg, '대여 비용', '창고를 한 번 빌리는 데 필요한 금액이에요.', won(fee))}
            ${infoRow(crateImg, '하루 보관료', `짐 ${per}칸마다 ${won(1)}가 붙어요. 창고가 비어 있으면 보관료가 없어요.`, `짐 ${per}칸마다 ${won(1)}`)}
          </ul>
        </section>
        <section class="shop-card">
          <h3>창고를 빌리면</h3>
          <ul class="ware-rows">
            ${infoRow(crateImg, '짐을 두고 가볍게 이동', '이동에 필요한 짐만 챙겨 갈 수 있어요.')}
            ${infoRow(marketImg, '내가 없어도 이 마을 장날에 판매', '창고 물품도 이 마을 장날에 판매 예약할 수 있어요.')}
            ${infoRow(gatherImg, '채집꾼이 거둔 물품 보관', '채집꾼이 가져온 물품도 창고에 보관돼요.')}
          </ul>
          <p class="ware-warn"><img src="${itemArt('rations') ?? ''}" alt="" /><span><b>음식은 창고에서도 상해요.</b><small>아무리 안전한 창고라도, 음식은 시간이 지나면 상할 수 있어요.</small></span></p>
        </section>
        <section class="ware-gold"><img src="${coinsImg}" alt="" /><b>보유 금화</b><strong>${won(v.gold)}</strong></section>
        <button type="button" class="rumor-note shop-wide" data-rent ${v.gold < fee ? 'disabled' : ''}>${won(fee)} · 창고 빌리기</button>`;
      body.querySelector('[data-rent]')?.addEventListener('click', () => page.send({ type: 'rentWarehouse' }));
      return;
    }

    const inStore = stock(v, here);
    const price = v.market?.price;
    const rows = GOODS.filter((g) => inStore[g] > 0 || count(v.cargo, g) > 0)
      .map((g) => {
        const art = itemArt(g);
        return `<li>
          <span class="acct-pic">${art ? `<img src="${art}" alt="" />` : ''}</span>
          <span class="ware-good"><b>${goodName(g)}</b><small>수레 ${count(v.cargo, g)} · 창고 ${inStore[g]}</small></span>
          <span class="ware-btns">
            <button type="button" class="order-btn" data-store="${g}" ${count(v.cargo, g) ? '' : 'disabled'}>넣기</button>
            <button type="button" class="order-btn" data-take="${g}" ${inStore[g] && !w.owed ? '' : 'disabled'}>꺼내기</button>
            <button type="button" class="order-btn edit" data-sell="${g}" ${inStore[g] && !w.owed && price ? '' : 'disabled'}>장에 내기</button>
          </span>
        </li>`;
      })
      .join('');
    body.innerHTML = `
      ${hero}
      <section class="shop-card">
        <div class="ware-head"><h3>내 창고</h3><span class="paper-chip now">대여 중</span></div>
        <ul class="ware-rows">
          ${infoRow(cellsImg, '쓰는 칸', `짐 ${w.count}개`, `${w.usedCells} / ${w.cells}칸`)}
          ${infoRow(crateImg, '오늘 보관료', `짐 ${per}칸마다 ${won(1)}`, won(w.fee))}
        </ul>
        ${w.owed ? `<p class="ware-warn"><span><b>밀린 보관료 ${won(w.owed)}</b><small>갚기 전에는 꺼내거나 장에 낼 수 없어요.</small></span></p>` : ''}
      </section>
      <section class="shop-card">
        <h3>짐 옮기기</h3>
        <ul class="ware-goods">${rows || '<li class="muted">수레와 창고가 비었어요.</li>'}</ul>
        <p class="ledger-note plain"><img class="ledger-note-i" src="${infoImg}" alt="" />넣기·꺼내기는 한 번에 다 옮겨요. 장에 내기는 창고 짐 전부를 이 마을 다음 장날에 시세의 0.9배 이상으로 팔아요. 길을 떠나도 남아요.</p>
      </section>
      <button type="button" class="shop-link" data-release ${w.count ? 'disabled' : ''}>빈 창고 돌려주기 <span>${w.count ? '짐을 다 빼야 해요' : '›'}</span></button>`;
    body.querySelectorAll<HTMLButtonElement>('[data-store]').forEach((b) =>
      b.addEventListener('click', () => page.send({ type: 'storeGoods', good: b.dataset.store as GoodId, qty: count(v.cargo, b.dataset.store as GoodId) })),
    );
    body.querySelectorAll<HTMLButtonElement>('[data-take]').forEach((b) =>
      b.addEventListener('click', () => page.send({ type: 'retrieveGoods', good: b.dataset.take as GoodId, qty: inStore[b.dataset.take as GoodId] })),
    );
    body.querySelectorAll<HTMLButtonElement>('[data-sell]').forEach((b) =>
      b.addEventListener('click', () => {
        const g = b.dataset.sell as GoodId;
        page.send({ type: 'placeStoreSellOrder', town: here, good: g, qty: inStore[g], minPrice: Math.max(1, Math.round(price![g] * 0.9)) });
      }),
    );
    body.querySelector('[data-release]')?.addEventListener('click', () => page.send({ type: 'releaseWarehouse', town: here }));
  });
}
