// 의견 보내기 (handoff 0.2.0 5번): 상인 증서 페이지의 버튼. 글을 상인 번호(계정), 게임 날, 실제 시각, 지금 화면 이름과 함께
// feedback 표에 넣는다(서버가 시각을 붙인다). 사진은 받지 않는다. 로컬 게임에서는 보낼 곳이 없어 버튼을 숨긴다.
import { openSheet } from './sheet';

type Sender = (body: string) => Promise<boolean>;

let sender: Sender | null = null;

/** 서버 게임이 보낼 곳을 꽂는다 */
export function setFeedbackSender(fn: Sender | null): void {
  sender = fn;
}

export function canSendFeedback(): boolean {
  return sender !== null;
}

export const FEEDBACK_MAX = 2000;

export function openFeedbackSheet(): void {
  const send = sender;
  if (!send) return;
  const sheet = openSheet('의견 보내기');
  sheet.body.innerHTML = `
    <p>불편한 점, 헷갈린 점, 좋았던 점을 적어 주세요. 지금 날짜와 화면이 함께 남아요.</p>
    <textarea class="feedback-text" rows="6" maxlength="${FEEDBACK_MAX}" aria-label="의견" data-text></textarea>
    <p class="error" data-error hidden></p>
    <div class="sheet-actions">
      <button type="button" class="cv-btn" data-cancel>그만두기</button>
      <button type="button" class="cv-btn coral" data-send>보내기</button>
    </div>`;
  const text = sheet.body.querySelector<HTMLTextAreaElement>('[data-text]')!;
  const err = sheet.body.querySelector<HTMLElement>('[data-error]')!;
  sheet.body.querySelector('[data-cancel]')!.addEventListener('click', () => sheet.close());
  sheet.body.querySelector<HTMLButtonElement>('[data-send]')!.addEventListener('click', async (e) => {
    const body = text.value.trim();
    if (!body) {
      err.textContent = '글을 적어 주세요.';
      err.hidden = false;
      return;
    }
    const btn = e.currentTarget as HTMLButtonElement;
    btn.disabled = true;
    const ok = await send(body);
    btn.disabled = false;
    if (ok) {
      sheet.body.innerHTML = '<p>고마워요. 잘 받았어요.</p>';
      setTimeout(() => sheet.close(), 1200);
    } else {
      err.textContent = '보내지 못했어요. 잠시 뒤에 다시 보내 주세요.';
      err.hidden = false;
    }
  });
  text.focus();
}
