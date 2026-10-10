// 여관 (0.1.6 목업 docs/reference/inn-rumors-mockup-0.1.6.png, inn-hire-mockup-0.1.6.png): 위 줄 아래를 덮는 페이지.
// 작은 탭: 소문(소문꾼, 오늘 들은 이야기, 술 한 잔, 전서구) / 숙박(묵기, 안내인) / 고용(게시판, 정보원, 데려온 사람).
// 소문꾼 이야기는 "듣기"를 눌러 듣고, 수첩에 적을지 고른다 (0.1.2, questions.md 60번 답을 바꿈).
// 얼굴은 아바타 키트로 그린다 (인물 그림은 따로 만들지 않는다).
import innImg from '../../../../assets/ui/bld_inn.png';
import drinkImg from '../../../../assets/ui/inn_drink.png';
import pigeonImg from '../../../../assets/ui/inn_pigeon.png';
import bedImg from '../../../../assets/ui/inn_bed.png';
import boardImg from '../../../../assets/ui/inn_board.png';
import outsideImg from '../../../../assets/ui/bld_outside.png';
import letterImg from '../../../../assets/ui/report_letter.png';
import paperImg from '../../../../assets/ui/tab_news.png';
import coinImg from '../../../../assets/ui/coin.png';
import chevronImg from '../../../../assets/ui/icon_chevron.png';
import noticeImg from '../../../../assets/ui/icon_notice.png';
import infoImg from '../../../../assets/ui/icon_info.png';
import { GROWTH } from '../../../sim/constants';
import type { NoteView } from '../../../sim/economy';
import { agoText, goodName, money } from '../../format';
import type { Game } from '../../game';
import { itemArt } from '../../itemArt';
import { openLivePage } from '../../livePage';
import { goToTab } from '../../nav';
import { portraitHtml } from '../../portrait/portrait';
import { showLedgerSection } from '../ledger';
import { showNewsTab } from '../news';
import { showRumorGroup } from '../newsRumors';
import { buyDrink, openPigeonSheet } from '../rumorSheet';

export type InnTab = 'rumors' | 'stay' | 'hire';

const ROLE_TEXT = {
  porter: '내 행렬에 손수레 하나 추가',
  gatherer: '내가 없어도 매일 이 마을 근교로 원정',
  carter: '두 번째 행렬을 운전',
} as const;

/** 고용에 필요한 것 (작게) */
const ROLE_NEED = {
  porter: '',
  gatherer: '거둔 것은 이 마을 창고로',
  carter: '말과 수레 필요',
} as const;

const won = (n: number) => `${money(n)}골드`;
const coin = (n: number) => `<span class="inn-fee"><img src="${coinImg}" alt="" />${won(n)}</span>`;

export function openInn(game: Game, start?: InnTab): void {
  const v0 = game.view();
  if (v0.location.kind !== 'town') return;
  const here = v0.location.town;
  const townName = (id: number) => game.map.towns[id]!.name;
  let tab: InnTab | null = start ?? null;

  openLivePage(game, { back: '마을', title: `${townName(here)} 여관` }, (body, v, page) => {
    if (v.location.kind !== 'town' || v.location.town !== here) {
      page.close();
      return;
    }
    const rumorsOpen = v.unlocks.includes('rumors');
    const hireOpen = !v.apprentice;
    const tabs: { id: InnTab; label: string }[] = [
      ...(rumorsOpen ? [{ id: 'rumors' as const, label: '소문' }] : []),
      { id: 'stay', label: '숙박' },
      ...(hireOpen ? [{ id: 'hire' as const, label: '고용' }] : []),
    ];
    if (!tab || !tabs.some((t) => t.id === tab)) tab = tabs[0]!.id;
    // NPC 얼굴 (0.1.4): 그림이 없으면 단색 자리표시
    const faces = game.faces();

    const bodies: Record<InnTab, () => string> = {
      rumors: () => {
        const gossip = v.gossip;
        // 오늘 이 마을에서 들은 것 (적기 / 넘기기를 고르는 중)
        const heardHere = v.recentHeard.filter((n) => n.town === here && n.day === v.day);
        const tellers = faces?.gossips ?? [];
        const lookOf = (name: string) => tellers.find((g) => g.name === name)?.look;
        const listen =
          gossip?.canListen && gossip.fresh > 0
            ? `<button type="button" class="rumor-note inn-listen" data-listen>소문꾼에게 듣기 · 새 이야기가 있어요</button>`
            : `<p class="inn-done">✓ ${gossip?.canListen ? '오늘은 새 이야기가 없어요.' : '오늘의 무료 소문을 모두 들었어요.'}</p>`;
        const card = (n: NoteView) => {
          const art = n.good ? itemArt(n.good) : null;
          const title = [n.about !== null ? townName(n.about) : '', n.good ? goodName(n.good) : ''].filter(Boolean).join(' · ') || '소문';
          return `<li class="rumor-card${n.dismissed ? ' dismissed' : ''}">
            <div class="rumor-main">
              <span class="rumor-pic"><img src="${art ?? paperImg}" alt="" /></span>
              <div class="rumor-text">
                <h4>${title}</h4>
                <p>“${n.text.replace(/^["“]+|["”]+$/g, '')}”</p>
                <small class="inn-teller">${portraitHtml(lookOf(n.from), 22, n.from)}${agoText(v.day, n.day)} · ${n.from}</small>
              </div>
            </div>
            <div class="rumor-btns">
              <button type="button" class="rumor-note" data-note-rumor="${n.id}">수첩에 기록</button>
              ${n.dismissed ? '<span class="rumor-skipped">넘김</span>' : `<button type="button" class="rumor-skip" data-dismiss-rumor="${n.id}">넘기기</button>`}
            </div>
          </li>`;
        };
        return `
          ${
            tellers.length
              ? `<ul class="inn-tellers">${tellers
                  .map((g) => `<li>${portraitHtml(g.look, 64, g.name)}<span><b>${g.name}</b><small>이 마을 소문꾼</small></span></li>`)
                  .join('')}</ul>`
              : ''
          }
          ${listen}
          ${heardHere.length ? `<ul class="inn-heard">${heardHere.map(card).join('')}</ul>` : ''}
          <div class="inn-pair">
            <section class="inn-buy">
              <img src="${drinkImg}" alt="" />
              <div><b>술 한 잔</b><small>소문 하나 더</small>${coin(v.drink?.fee ?? 0)}</div>
              <button type="button" class="rumor-note" data-drink ${v.drink && !v.drink.drank && v.gold >= v.drink.fee ? '' : 'disabled'}>${v.drink?.drank ? '오늘은 마셨어요' : '술 사기'}</button>
            </section>
            <section class="inn-buy">
              <img src="${pigeonImg}" alt="" />
              <div><b>전서구</b><small>${v.pigeon.pending.length ? `${v.pigeon.pending.length}마리 날아가는 중` : '먼 마을 시세'}</small>${coin(v.pigeon.fee)}</div>
              <button type="button" class="rumor-note" data-pigeon>시세 알아보기</button>
            </section>
          </div>
          ${
            v.unlocks.includes('news')
              ? `<button type="button" class="town-row inn-link" data-noted>
                  <span class="town-row-pic"><img src="${paperImg}" alt="" /></span>
                  <span class="town-row-text"><span class="town-row-name">기록한 소문 보기</span><small>소식 탭 수첩</small></span>
                  <img class="town-chevron" src="${chevronImg}" alt="" />
                </button>`
              : ''
          }
          <p class="ledger-note plain"><img class="ledger-note-i" src="${infoImg}" alt="" />적은 이야기만 수첩에 남아요. 기록한 소문은 신문이나 방문으로 확인해요.</p>`;
      },
      stay: () => `
        ${faces?.innkeeper ? `<div class="inn-host">${portraitHtml(faces.innkeeper, 64, '여관 주인')}<p>여관 주인이 방과 마구간을 내줘요.</p></div>` : ''}
        <section class="inn-wide">
          <img src="${bedImg}" alt="" />
          <div><b>하룻밤 묵기</b><small>피로 −${v.inn?.recovery ?? 0} · 말도 쉬어요</small>${coin(v.inn?.fee ?? 0)}</div>
          <button type="button" class="rumor-note" data-rest ${v.inn && !v.inn.rested && v.gold >= v.inn.fee && (v.fatigue > 0 || v.horses.some((h) => h.fatigue > 0)) ? '' : 'disabled'}>${v.inn?.rested ? '오늘은 묵었어요' : '묵기'}</button>
        </section>
        ${
          v.guide && !v.apprentice
            ? `<section class="inn-wide">
                <img src="${outsideImg}" alt="" />
                <div><b>안내인</b><small>다음 원정에서 위험한 카드 1장 건너뜀</small>${coin(v.guide.fee)}</div>
                <button type="button" class="rumor-note" data-guide ${v.guide.hired || v.gold < v.guide.fee ? 'disabled' : ''}>${v.guide.hired ? '따라가요' : '고용'}</button>
              </section>`
            : ''
        }
        <p class="ledger-note plain"><img class="ledger-note-i" src="${infoImg}" alt="" />묵기는 하루 한 번이에요. 피로가 없으면 묵을 수 없어요.</p>`,
      hire: () => {
        const board = v.hireBoard
          .map((o) => {
            const asked = v.draws.find((d) => d.kind === 'hire' && d.role === o.role && d.town === here);
            const need = [ROLE_NEED[o.role], o.restWage !== null ? `쉬는 날 ${won(o.restWage)}` : ''].filter(Boolean).join(' · ');
            return `<li class="hire-card">
              <span class="hire-pic">${portraitHtml(faces?.board[o.role], 96, o.name)}</span>
              <div class="hire-body">
                <b>${o.name}</b><small>${GROWTH.hire[o.role].name} · ${o.jobName}</small>
                <p>${ROLE_TEXT[o.role]}</p>
                ${need ? `<small class="hire-need">${need}</small>` : ''}
              </div>
              <div class="hire-act">
                ${coin(o.wage).replace('inn-fee', 'inn-fee wage')}
                ${
                  asked
                    ? `<button type="button" class="order-btn" data-cancel="${asked.id}">신청 거두기</button><small>오늘 밤 추첨 · ${won(asked.reserved)} 맡김</small>`
                    : `<button type="button" class="rumor-note" data-hire="${o.role}" ${v.gold < o.wage ? 'disabled' : ''}>고용 신청</button>`
                }
              </div>
            </li>`;
          })
          .join('');
        const informant = v.informant
          ? `<li class="hire-card">
              <span class="hire-pic"><img src="${letterImg}" alt="" /></span>
              <div class="hire-body"><b>정보원</b><small>이름 없음</small><p>${townName(here)} 시세와 거래 신청 현황을 매일 보고</p></div>
              <div class="hire-act">
                ${coin(v.informant.wage).replace('inn-fee', 'inn-fee wage')}
                ${v.informant.here ? '<span class="order-chip sell">심어 둠</span>' : `<button type="button" class="order-btn edit" data-informant ${v.gold < v.informant.wage ? 'disabled' : ''}>고용</button>`}
              </div>
            </li>`
          : '';
        const mine = v.hires.filter((h) => h.town === here);
        return `
          <h3 class="inn-section">고용 게시판</h3>
          <p class="inn-strip">신청하면 오늘 밤 지원자 중 한 사람이 선정돼요.</p>
          <small class="inn-sub">일손이 부족하면 일당이 올라갈 수 있어요.</small>
          ${board || informant ? `<ul class="hire-list">${board}${informant}</ul>` : '<p class="ledger-note">지금은 데려올 사람이 없어요.</p>'}
          ${
            mine.length
              ? `<h3 class="inn-section">이 마을에서 데려온 사람</h3><ul class="hire-list">${mine
                  .map(
                    (h) => `<li class="hire-card">
                      <span class="hire-pic">${portraitHtml(faces?.hires[h.id], 72, h.name)}</span>
                      <div class="hire-body"><b>${h.name}</b><small>${h.roleName} · 일당 ${won(h.wage)}${h.restWage !== null ? ` (쉬는 날 ${won(h.restWage)})` : ''}</small></div>
                      <div class="hire-act"><button type="button" class="order-btn" data-dismiss="${h.id}">내보내기</button></div>
                    </li>`,
                  )
                  .join('')}</ul>`
              : ''
          }
          <p class="ledger-note plain"><img class="ledger-note-i" src="${noticeImg}" alt="" />일당을 지급하지 못하면 일꾼이 떠나요.</p>
          ${
            v.unlocks.includes('ledger')
              ? `<button type="button" class="town-row inn-link" data-people>
                  <span class="town-row-pic"><img src="${boardImg}" alt="" /></span>
                  <span class="town-row-text"><span class="town-row-name">고용 중인 인력 보기</span><small>지금 함께하는 일꾼들을 확인하세요.</small></span>
                  <img class="town-chevron" src="${chevronImg}" alt="" />
                </button>`
              : ''
          }`;
      },
    };

    body.innerHTML = `
      <section class="inn-hero">
        <img src="${innImg}" alt="" />
        <p>좋은 이야기와 새로운 인연이 있는 곳.</p>
      </section>
      ${
        tabs.length > 1
          ? `<div class="order-sides inn-tabs" role="tablist" style="grid-template-columns:repeat(${tabs.length},1fr)">${tabs
              .map((t) => `<button type="button" role="tab" data-inn-tab="${t.id}" aria-pressed="${t.id === tab}">${t.label}</button>`)
              .join('')}</div>`
          : ''
      }
      ${bodies[tab]()}`;

    body.querySelectorAll<HTMLButtonElement>('[data-inn-tab]').forEach((b) =>
      b.addEventListener('click', () => {
        tab = b.dataset.innTab as InnTab;
        page.redraw();
      }),
    );
    body.querySelector('[data-listen]')?.addEventListener('click', () => page.send({ type: 'listenGossip' }));
    body.querySelectorAll<HTMLButtonElement>('[data-note-rumor]').forEach((b) =>
      b.addEventListener('click', () => page.send({ type: 'noteRumor', id: Number(b.dataset.noteRumor) })),
    );
    body.querySelectorAll<HTMLButtonElement>('[data-dismiss-rumor]').forEach((b) =>
      b.addEventListener('click', () => page.send({ type: 'dismissRumor', id: Number(b.dataset.dismissRumor) })),
    );
    body.querySelector('[data-drink]')?.addEventListener('click', () => buyDrink(game));
    body.querySelector('[data-pigeon]')?.addEventListener('click', () => openPigeonSheet(game));
    body.querySelector('[data-noted]')?.addEventListener('click', () => {
      showNewsTab('rumors');
      showRumorGroup('noted');
      goToTab('news');
    });
    body.querySelector('[data-people]')?.addEventListener('click', () => {
      showLedgerSection('people');
      goToTab('ledger');
    });
    body.querySelector('[data-rest]')?.addEventListener('click', () => page.send({ type: 'restAtInn' }));
    body.querySelector('[data-guide]')?.addEventListener('click', () => page.send({ type: 'hireGuide' }));
    body.querySelector('[data-informant]')?.addEventListener('click', () => page.send({ type: 'hireInformant' }));
    body.querySelectorAll<HTMLButtonElement>('[data-hire]').forEach((b) =>
      b.addEventListener('click', () => page.send({ type: 'hire', role: b.dataset.hire as 'porter' | 'gatherer' | 'carter' })),
    );
    body.querySelectorAll<HTMLButtonElement>('[data-cancel]').forEach((b) =>
      b.addEventListener('click', () => page.send({ type: 'cancelDraw', drawId: Number(b.dataset.cancel) })),
    );
    body.querySelectorAll<HTMLButtonElement>('[data-dismiss]').forEach((b) =>
      b.addEventListener('click', () => page.send({ type: 'dismissHire', hireId: Number(b.dataset.dismiss) })),
    );
  });
}
