// 창고: 빌리기, 짐 넣고 빼기, 창고 짐으로 이 마을 장날에 팔기 (내가 없어도 맞춰진다).
// 기획서는 수레 판 두 개를 나란히 놓고 끌어 옮기는 화면이다. 지금은 물품마다 넣기·꺼내기 버튼으로 둔다.
import { GROWTH } from '../../../sim/constants';
import { count, GOODS, type GoodId, type PlayerView } from '../../../sim/economy';
import { goodName, money } from '../../format';
import type { Game } from '../../game';
import { openLiveSheet } from '../../liveSheet';

function stock(v: PlayerView, town: number): Record<GoodId, number> {
  const w = v.warehouses.find((x) => x.town === town);
  const out = Object.fromEntries(GOODS.map((g) => [g, 0])) as Record<GoodId, number>;
  for (const p of w?.pieces ?? []) out[p.good] += p.qty;
  return out;
}

export function openWarehouse(game: Game): void {
  openLiveSheet(game, '창고', (body, v, sheet) => {
    if (v.location.kind !== 'town') {
      sheet.close();
      return;
    }
    const here = v.location.town;
    const w = v.warehouses.find((x) => x.town === here);
    if (!w) {
      body.innerHTML = `
        <p>짐을 두고 다니고, 내가 없어도 이 마을 장날에 팔 수 있어요. 채집꾼이 거둔 것도 여기에 모여요.</p>
        <p class="muted">${GROWTH.warehouse.rows.length * GROWTH.warehouse.rows[0]!.length}칸 · 보관료는 짐 ${GROWTH.warehouse.cellsPerCoin}칸마다 하루 ${money(1)} (비어 있으면 없어요) · 음식은 창고에서도 상해요.</p>
        <button type="button" class="primary-btn" data-rent ${v.gold < GROWTH.warehouse.deposit ? 'disabled' : ''}>빌리기 (${money(GROWTH.warehouse.deposit)})</button>`;
      body.querySelector('[data-rent]')?.addEventListener('click', () => sheet.send({ type: 'rentWarehouse' }));
      return;
    }
    const inStore = stock(v, here);
    const price = v.market?.price;
    const rows = GOODS.filter((g) => inStore[g] > 0 || count(v.cargo, g) > 0)
      .map(
        (g) => `<li class="row">
          <span>${goodName(g)} <small class="muted">수레 ${count(v.cargo, g)} · 창고 ${inStore[g]}</small></span>
          <span class="btn-row">
            <button type="button" class="secondary-btn" data-store="${g}" ${count(v.cargo, g) ? '' : 'disabled'}>넣기</button>
            <button type="button" class="secondary-btn" data-take="${g}" ${inStore[g] && !w.owed ? '' : 'disabled'}>꺼내기</button>
            <button type="button" class="secondary-btn" data-sell="${g}" ${inStore[g] && !w.owed && price ? '' : 'disabled'}>장에 내기<small>${price ? `${Math.max(1, Math.round(price[g] * 0.9))} 이상` : ''}</small></button>
          </span>
        </li>`,
      )
      .join('');
    body.innerHTML = `
      <p class="muted">짐 ${w.count}개 · 오늘 보관료 ${money(w.fee)} (${w.usedCells}/${w.cells}칸)${w.owed ? ` · <span class="warn">밀린 보관료 ${money(w.owed)}</span>` : ''}</p>
      <ul class="list">${rows || '<li class="muted">수레와 창고가 비었어요.</li>'}</ul>
      <p class="muted">"넣기·꺼내기"는 한 번에 다 옮겨요. "장에 내기"는 창고 짐 전부를 이 마을 다음 장날에 팔아요. 길을 떠나도 남아요.</p>
      <button type="button" class="link-btn" data-release ${w.count ? 'disabled' : ''}>빈 창고 돌려주기</button>`;
    body.querySelectorAll<HTMLButtonElement>('[data-store]').forEach((b) =>
      b.addEventListener('click', () => sheet.send({ type: 'storeGoods', good: b.dataset.store as GoodId, qty: count(v.cargo, b.dataset.store as GoodId) })),
    );
    body.querySelectorAll<HTMLButtonElement>('[data-take]').forEach((b) =>
      b.addEventListener('click', () => sheet.send({ type: 'retrieveGoods', good: b.dataset.take as GoodId, qty: inStore[b.dataset.take as GoodId] })),
    );
    body.querySelectorAll<HTMLButtonElement>('[data-sell]').forEach((b) =>
      b.addEventListener('click', () => {
        const g = b.dataset.sell as GoodId;
        sheet.send({ type: 'placeStoreSellOrder', town: here, good: g, qty: inStore[g], minPrice: Math.max(1, Math.round(price![g] * 0.9)) });
      }),
    );
    body.querySelector('[data-release]')?.addEventListener('click', () => sheet.send({ type: 'releaseWarehouse', town: here }));
  });
}
