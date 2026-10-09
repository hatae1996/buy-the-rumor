// 여관 (시안 prototypes/screens-0.0.5.html): 소문꾼, 술 한 잔, 묵기(말도 쉼), 고용 게시판(짐꾼, 채집꾼, 마부, 정보원),
// 전서구, 안내인. 소문꾼 이야기는 "듣기"를 눌러 듣고, 수첩에 적을지 고른다 (0.1.2, questions.md 60번 답을 바꿈).
import { GROWTH } from '../../../sim/constants';
import { money } from '../../format';
import type { Game } from '../../game';
import { openLiveSheet } from '../../liveSheet';
import { heardCard, wireHeard } from '../noteItem';
import { buyDrink, openPigeonSheet } from '../rumorSheet';

export function openInn(game: Game): void {
  const townName = (id: number) => game.map.towns[id]!.name;
  openLiveSheet(game, '여관', (body, v, sheet) => {
    if (v.location.kind !== 'town') {
      sheet.close();
      return;
    }
    const here = v.location.town;
    const rumorsOpen = v.unlocks.includes('rumors');
    const gossip = v.gossip;
    // 오늘 이 마을에서 들은 것 (적기 / 흘려듣기를 고르는 중)
    const heardHere = v.recentHeard.filter((n) => n.town === here && n.day === v.day);
    const board = v.hireBoard
      .map((o) => {
        const asked = v.draws.find((d) => d.kind === 'hire' && d.role === o.role && d.town === here);
        return `<li class="row">
          <span><b>${GROWTH.hire[o.role].name}</b> ${o.name} <small class="muted">(${o.jobName})</small><br /><small class="muted">${ROLE_TEXT[o.role]}</small></span>
          ${
            asked
              ? `<button type="button" class="secondary-btn" data-cancel="${asked.id}">신청 거두기<small>오늘 밤 추첨 · ${money(asked.reserved)} 맡김</small></button>`
              : `<button type="button" class="secondary-btn" data-hire="${o.role}" ${v.gold < o.wage ? 'disabled' : ''}>고용 신청<small>일당 ${money(o.wage)}${o.restWage !== null ? ` · 쉬는 날 ${money(o.restWage)}` : ''}</small></button>`
          }
        </li>`;
      })
      .join('');
    const informant = v.informant
      ? `<li class="row">
          <span><b>정보원</b> 이름 없음<br /><small class="muted">${townName(here)} 시세와 신청 현황을 매일</small></span>
          ${
            v.informant.here
              ? '<span class="badge">심어 둠</span>'
              : `<button type="button" class="secondary-btn" data-informant ${v.gold < v.informant.wage ? 'disabled' : ''}>고용<small>일당 ${money(v.informant.wage)}</small></button>`
          }
        </li>`
      : '';
    const mine = v.hires.filter((h) => h.town === here);
    body.innerHTML = `
      ${
        rumorsOpen
          ? `<h3>소문꾼</h3>
             <p class="muted">소문꾼에게 말을 걸면 이야기를 두세 개 들려줘요 (하루 한 번, 공짜). 들은 이야기는 수첩에 적거나 흘려들어요. 적은 것만 수첩에 남고, 맞았는지 도장이 찍혀요.</p>
             <div class="btn-row">
               <button type="button" class="primary-btn" data-listen ${gossip?.canListen && gossip.fresh > 0 ? '' : 'disabled'}>
                 소문꾼에게 듣기<small>${!gossip?.canListen ? '오늘은 들었어요' : gossip.fresh > 0 ? '새 이야기가 있어요' : '오늘은 새 이야기가 없어요'}</small>
               </button>
             </div>
             ${heardHere.length ? `<ul class="list">${heardHere.map((n) => heardCard(n, v.day, townName)).join('')}</ul>` : ''}
             <div class="btn-row">
               <button type="button" class="secondary-btn" data-drink ${v.drink && !v.drink.drank && v.gold >= v.drink.fee ? '' : 'disabled'}>
                 술 한 잔<small>${v.drink?.drank ? '오늘은 마셨어요' : `소문 하나 더 · ${money(v.drink?.fee ?? 0)}`}</small>
               </button>
               <button type="button" class="secondary-btn" data-pigeon>전서구<small>${v.pigeon.pending.length ? `${v.pigeon.pending.length}마리 날아가는 중` : `먼 마을 시세 · ${money(v.pigeon.fee)}`}</small></button>
             </div>`
          : ''
      }
      <h3>하룻밤 묵기</h3>
      <div class="btn-row">
        <button type="button" class="secondary-btn" data-rest ${v.inn && !v.inn.rested && v.gold >= v.inn.fee && (v.fatigue > 0 || v.horses.some((h) => h.fatigue > 0)) ? '' : 'disabled'}>
          묵기<small>${v.inn?.rested ? '오늘은 묵었어요' : `${money(v.inn?.fee ?? 0)} · 피로 −${v.inn?.recovery ?? 0} · 말도 쉼`}</small>
        </button>
        ${
          v.guide && !v.apprentice
            ? `<button type="button" class="secondary-btn" data-guide ${v.guide.hired || v.gold < v.guide.fee ? 'disabled' : ''}>안내인<small>${v.guide.hired ? '다음 원정에 따라가요' : `${money(v.guide.fee)} · 위험한 카드 1장 건너뜀`}</small></button>`
            : ''
        }
      </div>
      ${
        v.apprentice
          ? ''
          : `<h3>고용 게시판</h3>
             <p class="muted">일손이 모자라면 일당이 올라요. 일당을 못 주면 떠나요. 고용은 신청해 두면 오늘 밤 신청한 사람 중에서 한 사람을 뽑아요.</p>
             <ul class="list">${board}${informant || ''}${board || informant ? '' : '<li class="muted">지금은 데려올 사람이 없어요.</li>'}</ul>
             ${
               mine.length
                 ? `<h3>이 마을에서 데려온 사람</h3><ul class="list">${mine
                     .map((h) => `<li class="row"><span>${h.roleName} ${h.name} · 일당 ${money(h.wage)}${h.restWage !== null ? ` (쉬는 날 ${money(h.restWage)})` : ''}</span><button type="button" class="link-btn" data-dismiss="${h.id}">내보내기</button></li>`)
                     .join('')}</ul>`
                 : ''
             }`
      }`;
    body.querySelector('[data-listen]')?.addEventListener('click', () => sheet.send({ type: 'listenGossip' }));
    wireHeard(body, (cmd) => sheet.send(cmd));
    body.querySelector('[data-drink]')?.addEventListener('click', () => buyDrink(game));
    body.querySelector('[data-pigeon]')?.addEventListener('click', () => openPigeonSheet(game));
    body.querySelector('[data-rest]')?.addEventListener('click', () => sheet.send({ type: 'restAtInn' }));
    body.querySelector('[data-guide]')?.addEventListener('click', () => sheet.send({ type: 'hireGuide' }));
    body.querySelector('[data-informant]')?.addEventListener('click', () => sheet.send({ type: 'hireInformant' }));
    body.querySelectorAll<HTMLButtonElement>('[data-hire]').forEach((b) =>
      b.addEventListener('click', () => sheet.send({ type: 'hire', role: b.dataset.hire as 'porter' | 'gatherer' | 'carter' })),
    );
    body.querySelectorAll<HTMLButtonElement>('[data-cancel]').forEach((b) =>
      b.addEventListener('click', () => sheet.send({ type: 'cancelDraw', drawId: Number(b.dataset.cancel) })),
    );
    body.querySelectorAll<HTMLButtonElement>('[data-dismiss]').forEach((b) =>
      b.addEventListener('click', () => sheet.send({ type: 'dismissHire', hireId: Number(b.dataset.dismiss) })),
    );
  });
}

const ROLE_TEXT = {
  porter: '내 행렬에 손수레 하나 더',
  gatherer: '내가 없어도 매일 원정 (그 마을 창고로)',
  carter: '두 번째 행렬을 몬다 (말과 수레가 있어야)',
} as const;
