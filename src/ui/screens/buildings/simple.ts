// 잡화점·작업장·은행·길드 회관(페이지), 바깥(원정) 쪽지.
import mealImg from '../../../../assets/ui/store_meal.png';
import rationImg from '../../../../assets/ui/travel_food.png';
import houseImg from '../../../../assets/ui/house_red.png';
import coinImg from '../../../../assets/ui/coin.png';
import infoImg from '../../../../assets/ui/icon_info.png';
import { itemArt } from '../../itemArt';
import { openLivePage } from '../../livePage';
import workshopImg from '../../../../assets/ui/bld_workshop.png';
import bankImg from '../../../../assets/ui/bld_bank.png';
import guildImg from '../../../../assets/ui/bld_guild.png';
import signImg from '../../../../assets/ui/workshop_sign.png';
import anvilImg from '../../../../assets/ui/bld_anvil.png';
import barrelImg from '../../../../assets/ui/quest_winterFood.png';
import sackImg from '../../../../assets/ui/coins_sack.png';
import bookImg from '../../../../assets/ui/tab_ledger.png';
import lettersImg from '../../../../assets/ui/ledger_letters.png';
import coinsImg from '../../../../assets/ui/coins_stack.png';
import { goodName } from '../../format';
import type { GoodId } from '../../../sim/economy';
import { questSectionsHtml, themeEmblem } from '../newsGuild';
import { ECONOMY } from '../../../sim/constants';
import { money } from '../../format';

const USES = ECONOMY.expedition.usesPerTool;
import type { Game } from '../../game';
import { openLiveSheet } from '../../liveSheet';
import { openExpeditionSheet } from '../expeditionSheet';
import { openGearSheet } from '../gearSheet';
import { openMealSheet } from '../mealSheet';
import type { PlayerView } from '../../../sim/economy';

/** 피로 막대: 칸 10개 */
export function fatigueBar(v: PlayerView): string {
  const cells = Array.from({ length: v.fatigueMax }, (_, i) => `<i class="${i < v.fatigue ? 'on' : ''}"></i>`).join('');
  const word = v.fatigue === 0 ? '쌩쌩해요' : v.tired ? '많이 지쳤어요' : v.fatigue >= 4 ? '조금 지쳤어요' : '괜찮아요';
  return `<div class="fatigue"><div class="fatigue-cells" aria-hidden="true">${cells}</div><span>${word}</span></div>`;
}

/** 잡화점 페이지 (0.1.6 목업 docs/reference/store-mockup-0.1.6.png): 음식 먹기, 여행 식량, 장비 */
export function openStore(game: Game): void {
  const v0 = game.view();
  if (v0.location.kind !== 'town') return;
  const here = v0.location.town;
  openLivePage(game, { back: '마을', title: '잡화점', sub: game.map.towns[here]!.name, icon: houseImg }, (body, v, page) => {
    if (v.location.kind !== 'town' || v.location.town !== here) {
      page.close();
      return;
    }
    const rp = v.food.rationPrice;
    const options = [2, 4, 8]
      .map((n) => {
        const ok = rp !== null && v.gold >= n * rp && v.food.rationRoom >= n;
        return `<div class="shop-option">
          <b>${n}개</b>
          <span class="inn-fee"><img src="${coinImg}" alt="" />${rp !== null ? `${money(n * rp)}골드` : '-'}</span>
          <button type="button" class="shop-buy" data-rations="${n}" ${ok ? '' : 'disabled'}>${ok ? '구입' : '구입 불가'}</button>
        </div>`;
      })
      .join('');
    body.innerHTML = `
      <section class="shop-card">
        <h3>음식 먹기</h3>
        <div class="shop-main">
          <img src="${mealImg}" alt="" />
          <div><b>피로 ${v.fatigue} / ${v.fatigueMax}</b>${fatigueBar(v)}</div>
        </div>
        <button type="button" class="rumor-note shop-wide" data-meal ${v.fatigue > 0 && v.mealsLeft > 0 ? '' : 'disabled'}>짐에 있는 음식 먹기</button>
        <small class="shop-caption">${v.mealsLeft > 0 ? `오늘 ${v.mealsLeft}개 더 먹을 수 있어요.` : '오늘은 더 먹을 수 없어요.'}</small>
      </section>
      <section class="shop-card">
        <h3>여행 식량</h3>
        <div class="shop-main">
          <img src="${rationImg}" alt="" />
          <div><span class="shop-chip">보유 ${v.food.have}개</span><small>이동할 때 사람마다 하루 1개를 먹어요.${v.food.perDay > 1 ? ` 지금은 하루 ${v.food.perDay}개.` : ''}</small></div>
        </div>
        <div class="shop-options">${options}</div>
        <ul class="shop-notes">
          <li>여행 식량은 한 칸에 4개까지 쌓아요.${v.food.rationRoom < 8 ? ` 지금 ${v.food.rationRoom}개 더 실을 수 있어요.` : ''}</li>
          <li>생선·고기·곡물·염장 식품도 식량으로 먹어요.</li>
        </ul>
      </section>
      ${
        v.apprentice
          ? ''
          : `<section class="shop-card">
              <h3>장비</h3>
              <div class="shop-main">
                <img src="${itemArt('tools') ?? ''}" alt="" />
                <div>
                  <small>원정에서 쓸 장비를 준비하세요.</small>
                  <span class="shop-chip">보유 도구 ${v.tools}개</span>
                  <small>도구 1개로 나무 베기·광석 캐기 총 ${USES}회${v.tools ? ` · 지금 ${v.toolUsesLeft}회 남음` : ''}</small>
                </div>
              </div>
              <button type="button" class="shop-link" data-gear>장비 구입·수리 <span>${v.gear.filter((g) => (g.uses ?? 0) > 0).length}개 쓸 만함 ›</span></button>
              <p class="ledger-note plain"><img class="ledger-note-i" src="${infoImg}" alt="" />장비도 짐칸 공간을 차지해요. 실은 장비만 원정에서 써요.</p>
            </section>`
      }`;
    body.querySelector('[data-meal]')?.addEventListener('click', () => openMealSheet(game));
    body.querySelectorAll<HTMLButtonElement>('[data-rations]').forEach((b) =>
      b.addEventListener('click', () => page.send({ type: 'buyRations', qty: Number(b.dataset.rations) })),
    );
    body.querySelector('[data-gear]')?.addEventListener('click', () => openGearSheet(game));
  });
}

export function openOutside(game: Game): void {
  openLiveSheet(game, '바깥', (body, v, sheet) => {
    body.innerHTML = `
      <header class="card-head"><h3>원정</h3><span class="badge">기회 ${v.expeditionChances} / 6</span></header>
      <p class="muted">이 마을에 머무는 동안 하루에 한 번씩 원정 기회가 생겨요. 떠나면 사라져요.</p>
      ${fatigueBar(v)}
      <div class="btn-row">
        ${
          v.expedition
            ? '<button type="button" class="primary-btn" data-resume>원정 이어가기</button>'
            : `<button type="button" class="primary-btn" data-start ${v.expeditionChances > 0 && v.fatigue < v.fatigueMax ? '' : 'disabled'}>${
                v.expeditionChances === 0 ? '내일 기회가 생겨요' : v.fatigue >= v.fatigueMax ? '너무 지쳤어요' : '떠나기 (카드 3~4장)'
              }</button>`
        }
      </div>`;
    body.querySelector('[data-resume]')?.addEventListener('click', () => openExpeditionSheet(game));
    body.querySelector('[data-start]')?.addEventListener('click', () => {
      if (sheet.send({ type: 'startExpedition' })) openExpeditionSheet(game);
    });
  });
}

/** "마을로 돌아가기" (도시 건물 페이지 맨 아래) */
const BACK_LINK = '<button type="button" class="shop-link city-back" data-page-close>마을로 돌아가기 <span>›</span></button>';

/** 도시 건물 페이지: 같은 마을에 있는 동안만 연다 */
function cityPage(game: Game, title: string, draw: (body: HTMLElement, v: PlayerView) => void): void {
  const v0 = game.view();
  if (v0.location.kind !== 'town') return;
  const here = v0.location.town;
  openLivePage(game, { back: '마을', title, sub: game.map.towns[here]!.name, icon: houseImg }, (body, v, page) => {
    if (v.location.kind !== 'town' || v.location.town !== here) {
      page.close();
      return;
    }
    draw(body, v);
    body.querySelector('[data-page-close]')?.addEventListener('click', () => page.close());
  });
}

/** 작업장 (0.1.6 목업 docs/reference/workshop-mockup-0.1.6.png): 도시 공방 소개, 내 작업장은 다음 버전 */
export function openWorkshop(game: Game): void {
  const recipe = (k: keyof typeof ECONOMY.craft) => {
    const c = ECONOMY.craft[k];
    const ins = Object.entries(c.inputs).map(([g, n]) => `${goodName(g as GoodId)} ${n}`);
    if (c.rawFood) ins.push(`생선·고기 ${c.rawFood}`);
    const outs = Object.entries(c.output).map(([g, n]) => `${goodName(g as GoodId)} ${n}`);
    return `${ins.join(' · ')} → ${outs.join(' · ')}`;
  };
  cityPage(game, '작업장', (body) => {
    body.innerHTML = `
      <section class="city-hero"><img src="${workshopImg}" alt="" /><div><h3>재료가 새 물건이<br />되는 곳</h3><small>도시의 공방이 재료를 사서 물건을 만들어요.</small></div></section>
      <section class="shop-card">
        <h3>도시의 공방</h3>
        <ul class="city-rows">
          <li><img src="${anvilImg}" alt="" /><span><b>대장간</b><small>재료를 사서 도구를 만들어요.</small><small class="city-recipe">${recipe('smith')}</small></span><i><img src="${itemArt('tools') ?? ''}" alt="" /></i></li>
          <li><img src="${barrelImg}" alt="" /><span><b>염장 공방</b><small>재료를 사서 염장 식품을 만들어요.</small><small class="city-recipe">${recipe('curer')}</small></span><i><img src="${itemArt('salted') ?? ''}" alt="" /></i></li>
        </ul>
      </section>
      <section class="city-soon">
        <h3>내 작업장</h3>
        <div><img src="${signImg}" alt="" /><span><span class="paper-chip now">준비 중</span><small>내 작업장(염장소, 대장간) 구입과 건설은 다음 버전에서 열려요.</small><button type="button" class="rumor-note" disabled>구입·건설 준비 중</button></span></div>
      </section>
      ${BACK_LINK}`;
  });
}

/** 은행 (0.1.6 목업 docs/reference/bank-mockup-0.1.6.png): 계좌와 이자, 맡기기·빌리기는 다음 버전 */
export function openBank(game: Game): void {
  const won = (n: number) => `${money(n)}골드`;
  cityPage(game, '은행', (body, v) => {
    body.innerHTML = `
      <section class="city-hero"><img src="${bankImg}" alt="" /><div><h3>어느 도시에서나<br />같은 계좌</h3><small>도시가 달라도 예금과 대출은 이어져요.</small></div></section>
      <section class="shop-card">
        <h3>내 계좌</h3>
        <div class="city-account">
          <div><img src="${sackImg}" alt="" /><span>예금<b>${won(v.bank.deposit)}</b></span></div>
          <div><img src="${bookImg}" alt="" /><span>대출<b>${won(v.bank.loan)}</b></span></div>
        </div>
      </section>
      <section class="shop-card">
        <h3>이자 안내</h3>
        <ul class="city-rates">
          <li><span>예금 이자</span><b>시즌당 ${Math.round(v.bank.depositRate * 100)}%</b></li>
          <li><span>대출 이자</span><b>시즌당 ${Math.round(v.bank.loanRate * 100)}%</b></li>
        </ul>
        <p class="ledger-note plain"><img class="ledger-note-i" src="${infoImg}" alt="" />계좌는 하나라 어느 도시 은행에서나 같아요.</p>
      </section>
      <section class="city-soon">
        <div><img src="${lettersImg}" alt="" /><span><b>은행 업무 준비 중</b><small>예금과 대출은 다음 버전에서 이용할 수 있어요.</small></span></div>
        <div class="city-soon-btns"><button type="button" class="rumor-note" disabled>예금하기</button><button type="button" class="rumor-note" disabled>대출받기</button></div>
      </section>
      <section class="ware-gold"><img src="${coinsImg}" alt="" /><b>현재 보유 골드</b><strong>${won(v.gold)}</strong></section>
      ${BACK_LINK}`;
  });
}

/** 길드 회관 (0.1.6 목업 docs/reference/guildhall-mockup-0.1.6.png): 이번 시즌 테마와 의뢰 (소식 탭 길드와 같은 카드) */
export function openGuildHall(game: Game): void {
  cityPage(game, '길드 회관', (body, v) => {
    const g = v.guild;
    if (!g.theme) {
      body.innerHTML = `<p class="ledger-note">이번 시즌 테마가 아직 없어요.</p>${BACK_LINK}`;
      return;
    }
    const emblem = themeEmblem(g.themeId);
    body.innerHTML = `
      <section class="shop-card">
        <div class="city-guild-head">${emblem ? `<img src="${emblem}" alt="" />` : `<img src="${guildImg}" alt="" />`}<div><h3>${g.theme}</h3><small>시즌 의뢰 미리보기</small></div></div>
        <p class="city-guild-note"><img src="${infoImg}" alt="" />의뢰는 아직 다듬는 중이에요. 내용은 바뀔 수 있어요.</p>
      </section>
      <section class="guild-card">${questSectionsHtml(v)}</section>
      <p class="ledger-note plain"><img class="ledger-note-i" src="${infoImg}" alt="" />개인 의뢰는 장에 팔면 쌓이고, 동·은·금 문턱을 넘으면 인장이 찍혀요. 공동 목표는 지금은 내 몫만 세요.</p>
      ${BACK_LINK}`;
  });
}
