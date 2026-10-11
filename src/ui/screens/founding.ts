// 게임 시작 화면 (기획서 "게임 시작 화면과 부품", 0.1.7 답 129): 견습 전에 상단을 꾸린다.
// 상단 이름 → 내 얼굴 → 문장 → 견습. 세 단계 모두 "추천"이 미리 채워져 있어 그대로 넘어가도 된다(30초 안에).
// 추천 단추는 다시 뽑는다. 상단 이름 추천은 봇 상단 이름 목록에서, 로컬은 글자 수만 본다(금칙어·같은 시즌 중복은 서버, 0.2.0).
// 0.2.1 목업(docs/reference/founding-name-face-mockup-0.2.1.png, founding-emblem-mockup-0.2.1.png)대로 그린다.
// 다 고르면 done으로 넘긴다(부른 쪽이 새 판을 연다).
import { track } from '../track';
import '../parts.css';
import '../founding.css';
import diceImg from '../../../assets/ui/icon_dice.png';
import { recommendCompanyName } from '../../sim/bot';
import { rollPlayerFace, type Look } from '../../sim/looks';
import { cleanCompanyName, COMPANY_NAME_LENGTH, rollEmblem, type Emblem } from '../../sim/ranking';
import { createRng, mixSeed } from '../../sim/rng';
import { emblemSvg } from '../emblem';
import { portraitHtml } from '../portrait/portrait';
import { mountEmblemEditor } from './emblemEditor';
import { mountFaceEditor } from './faceEditor';

export interface Founding {
  name: string;
  face: Look;
  emblem: Emblem;
}

const STEPS = [
  { tab: '상단 이름', title: '상단 이름을 정해 주세요', sub: '앞으로 장터에서 불릴 이름이에요.', next: '다음: 내 얼굴' },
  { tab: '내 얼굴', title: '내 얼굴', sub: '상인 증서에 사용할 모습을 골라 주세요.', next: '다음: 문장' },
  { tab: '문장', title: '우리 상단의 문장', sub: '수레 깃발과 상인 증서에 사용할 문장이에요.', next: '견습 시작' },
] as const;

const DICE = `<img class="dice" src="${diceImg}" alt="" />`;
const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const INFO = '<span class="founding-info-icon" aria-hidden="true">i</span>';

export interface FoundingOptions {
  /** 1단계에서 다음으로 갈 때 이름을 물어본다 (서버: 금칙어, 같은 이름). 문제가 있으면 보일 글 */
  checkName?: (name: string) => Promise<string | null>;
}

/**
 * 시작 화면을 연다. seed는 추천을 뽑는 시드 (새 판 시드).
 * done이 글을 돌려주면(서버가 거절) 1단계로 돌아가 그 글을 보인다
 */
export function openFounding(root: HTMLElement, seed: number, done: (f: Founding) => void | Promise<string | null>, opt: FoundingOptions = {}): void {
  track('founding_start');
  const rng = createRng(mixSeed(seed, 0xf00d));
  let step = 0;
  let name = recommendCompanyName(rng);
  let face = rollPlayerFace(rng);
  let emblem = rollEmblem(rng);

  const el = document.createElement('section');
  el.className = 'founding founding-flow';
  el.setAttribute('aria-label', '상단 꾸리기');
  root.appendChild(el);

  const draw = () => {
    const s = STEPS[step]!;
    el.innerHTML = `
      <header class="founding-head">
        <ol class="founding-steps" aria-label="${step + 1} / ${STEPS.length} 단계">${STEPS.map(
          (x, i) => `<li class="${i === step ? 'now' : i < step ? 'done' : ''}"><span>${i < step ? CHECK : i + 1}</span>${x.tab}</li>`,
        ).join('')}</ol>
        <h1>${s.title}</h1>
        <p class="founding-sub">${s.sub}</p>
      </header>
      <div class="founding-body" data-body></div>
      <footer class="founding-foot${step === 0 ? ' single' : ''}">
        ${step > 0 ? `<button type="button" class="founding-btn ghost" data-prev>‹ 이전</button><button type="button" class="founding-btn ghost" data-roll>${DICE}추천</button>` : ''}
        <button type="button" class="founding-btn coral" data-next>${s.next} ›</button>
      </footer>`;
    const body = el.querySelector<HTMLElement>('[data-body]')!;
    if (step === 0) drawName(body);
    else if (step === 1) {
      const ed = mountFaceEditor(body, face, (f) => (face = f));
      el.querySelector('[data-roll]')!.addEventListener('click', () => {
        face = rollPlayerFace(rng);
        ed.set(face);
      });
    } else {
      const box = document.createElement('div');
      body.append(box);
      body.insertAdjacentHTML('beforeend', `<p class="founding-info">${INFO}문장은 나중에도 바꿀 수 있어요.</p>`);
      const ed = mountEmblemEditor(box, emblem, (e) => (emblem = e));
      el.querySelector('[data-roll]')!.addEventListener('click', () => {
        emblem = rollEmblem(rng);
        ed.set(emblem);
      });
    }
    el.querySelector('[data-prev]')?.addEventListener('click', () => {
      step--;
      draw();
    });
    el.querySelector<HTMLButtonElement>('[data-next]')!.addEventListener('click', async (e) => {
      if (step === 0 && cleanCompanyName(name) === null) {
        return showNameError(body, `상단 이름은 ${COMPANY_NAME_LENGTH[0]}~${COMPANY_NAME_LENGTH[1]}글자로 지어 주세요.`);
      }
      const btn = e.currentTarget as HTMLButtonElement;
      if (step === 0 && opt.checkName) {
        btn.disabled = true;
        const problem = await opt.checkName(cleanCompanyName(name)!);
        btn.disabled = false;
        if (problem) return showNameError(body, problem);
      }
      if (step < STEPS.length - 1) {
        step++;
        draw();
        return;
      }
      btn.disabled = true;
      const problem = await done({ name: cleanCompanyName(name)!, face, emblem });
      if (problem) {
        step = 0;
        draw();
        return showNameError(el.querySelector<HTMLElement>('[data-body]')!, problem);
      }
      track('founding_done');
      el.remove();
    });
    el.scrollTop = 0;
  };

  const showNameError = (body: HTMLElement, text: string) => {
    const e = body.querySelector<HTMLElement>('[data-name-error]');
    if (!e) return;
    e.textContent = text;
    e.removeAttribute('hidden');
  };

  /** 1단계: 얼굴·문장과 이름 미리보기, 이름 칸, 이름 추천 (얼굴과 문장은 다음 단계에서 바꾼다) */
  const drawName = (body: HTMLElement) => {
    body.innerHTML = `
      <div class="founding-card">
        <div class="founding-marks"><span class="ring-frame">${portraitHtml(face, 96, '내 얼굴')}</span>${emblemSvg(emblem, 84)}</div>
        <p class="founding-label">미리보기</p>
        <p class="founding-preview" data-preview></p>
        <label class="founding-name">
          <span>상단 이름 <small>${COMPANY_NAME_LENGTH[0]}~${COMPANY_NAME_LENGTH[1]}글자</small></span>
          <input type="text" maxlength="${COMPANY_NAME_LENGTH[1]}" value="${name.replace(/"/g, '&quot;')}" data-name autocomplete="off" />
        </label>
        <p class="founding-error" data-name-error hidden>상단 이름은 ${COMPANY_NAME_LENGTH[0]}~${COMPANY_NAME_LENGTH[1]}글자로 지어 주세요.</p>
        <button type="button" class="founding-btn outline" data-roll-name>${DICE}이름 추천</button>
        <div class="founding-info">${INFO}<div><p>상단 이름은 시즌 사이에 상인 증서에서 바꿀 수 있어요.</p><small>얼굴과 문장은 언제든 바꿀 수 있어요.</small></div></div>
      </div>`;
    const input = body.querySelector<HTMLInputElement>('[data-name]')!;
    const preview = body.querySelector<HTMLElement>('[data-preview]')!;
    const show = () => (preview.textContent = name.trim() || ' ');
    show();
    input.addEventListener('input', () => {
      name = input.value;
      show();
      body.querySelector('[data-name-error]')!.setAttribute('hidden', '');
    });
    body.querySelector('[data-roll-name]')!.addEventListener('click', () => {
      name = recommendCompanyName(rng, [name]);
      input.value = name;
      show();
      body.querySelector('[data-name-error]')!.setAttribute('hidden', '');
    });
  };

  draw();
}
