// 게임 시작 화면 (기획서 "게임 시작 화면과 부품", 0.1.7 답 129): 견습 전에 상단을 꾸린다.
// 상단 이름 → 내 얼굴 → 문장 → 견습. 세 단계 모두 "추천"이 미리 채워져 있어 그대로 넘어가도 된다(30초 안에).
// 추천 단추는 다시 뽑는다. 상단 이름 추천은 봇 상단 이름 목록에서, 로컬은 글자 수만 본다(금칙어·같은 시즌 중복은 서버, 0.2.0).
// 목업이 오기 전이라 0.1.6 화면 틀(크림 바탕, 페이지 머리)로 그린다. 다 고르면 done으로 넘긴다(부른 쪽이 새 판을 연다).
import { track } from '../track';
import '../parts.css';
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
  { title: '상단 이름', hint: '"어서 오게, 젊은이. 장사를 하려면 상단 이름부터 있어야지. 마음에 드는 이름이 없으면 내가 하나 지어 주겠네."' },
  { title: '내 얼굴', hint: '"상인 증서에 붙일 얼굴일세. 길드 사람들이 이 얼굴로 자네를 알아볼 걸세."' },
  { title: '문장', hint: '"상단에는 문장이 있어야 하네. 수레 깃발에도, 증서 가운데에도 들어가지."' },
] as const;

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
  el.className = 'founding';
  el.setAttribute('aria-label', '상단 꾸리기');
  root.appendChild(el);

  const draw = () => {
    const s = STEPS[step]!;
    el.innerHTML = `
      <header class="founding-head">
        <ol class="founding-steps" aria-label="${step + 1} / ${STEPS.length} 단계">${STEPS.map(
          (x, i) => `<li class="${i === step ? 'now' : i < step ? 'done' : ''}"><span>${i + 1}</span>${x.title}</li>`,
        ).join('')}</ol>
        <h1>${s.title}</h1>
        <p class="founding-hint">${s.hint}</p>
      </header>
      <div class="founding-body" data-body></div>
      <footer class="founding-foot">
        ${step > 0 ? '<button type="button" class="founding-btn ghost" data-prev>‹ 이전</button>' : '<span></span>'}
        <button type="button" class="founding-btn ghost" data-roll>추천</button>
        <button type="button" class="founding-btn" data-next>${step === STEPS.length - 1 ? '견습 시작 ›' : '다음 ›'}</button>
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
      const ed = mountEmblemEditor(body, emblem, (e) => (emblem = e));
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

  /** 1단계: 이름 칸, 얼굴·문장 미리보기 (다음 단계에서 바꾼다) */
  const drawName = (body: HTMLElement) => {
    body.innerHTML = `
      <div class="founding-card">
        <div class="founding-marks">${portraitHtml(face, 72, '내 얼굴')}${emblemSvg(emblem, 64)}</div>
        <label class="founding-name">
          <span>상단 이름 <small>${COMPANY_NAME_LENGTH[0]}~${COMPANY_NAME_LENGTH[1]}글자</small></span>
          <input type="text" maxlength="${COMPANY_NAME_LENGTH[1]}" value="${name.replace(/"/g, '&quot;')}" data-name autocomplete="off" />
        </label>
        <p class="founding-error" data-name-error hidden>상단 이름은 ${COMPANY_NAME_LENGTH[0]}~${COMPANY_NAME_LENGTH[1]}글자로 지어 주세요.</p>
        <p class="pick-note">상단 이름은 시즌 사이에만(상인 증서에서) 바꿀 수 있어요. 얼굴과 문장은 언제든 바꿔요.</p>
      </div>`;
    const input = body.querySelector<HTMLInputElement>('[data-name]')!;
    input.addEventListener('input', () => {
      name = input.value;
      body.querySelector('[data-name-error]')!.setAttribute('hidden', '');
    });
    el.querySelector('[data-roll]')!.addEventListener('click', () => {
      name = recommendCompanyName(rng, [name]);
      input.value = name;
      body.querySelector('[data-name-error]')!.setAttribute('hidden', '');
    });
  };

  draw();
}
