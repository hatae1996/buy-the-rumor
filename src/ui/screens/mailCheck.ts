// 메일 확인 (0.2.1 목업 docs/reference/entry-mail-invite-mockup-0.2.1.png): 로그인 메일을 보낸 뒤 인증번호 6자리를 넣는다.
// 메일을 다른 기기(컴퓨터 등)에서 봐도 숫자만 넣으면 이 기기에서 로그인된다. 이 기기에서는 메일 속 링크를 눌러도 된다.
// 숫자 칸 여섯은 보이는 모양이고, 실제 입력은 그 위를 덮은 투명한 칸 하나다 (아이폰이 메일의 숫자를 자동으로 채울 수 있게).
import mailImg from '../../../assets/ui/entry_mail_check.png';
import { entryBrand, entryLeaf } from './entryParts';

/** 인증번호 자리 수 (supabase/config.toml auth.email otp_length, 대시보드 설정과 같아야 한다) */
export const OTP_LENGTH = 6;

export interface MailCheckActions {
  /** 로그인 메일을 (다시) 보낸다. 실패하면 까닭 */
  email: (email: string) => Promise<string | null>;
  /** 인증번호로 로그인. 실패하면 까닭 */
  verify: (email: string, code: string) => Promise<string | null>;
  /** 로그인했다 (다시 연다) */
  done: () => void;
}

export function showMailCheck(root: HTMLElement, email: string, act: MailCheckActions, privacy: string): void {
  const el = document.createElement('section');
  el.className = 'entry-screen entry-mail';
  el.innerHTML = `<div class="entry-scroll">
      ${entryBrand(false)}
      <div class="entry-hero letter"><img src="${mailImg}" alt="" /></div>
      <h2 class="entry-title">메일을 확인해 주세요</h2>
      <p class="entry-lead soft">이메일로 받은 인증번호를 입력해 주세요.</p>
      <div class="entry-card">
        <label class="entry-field"><span>이메일 주소</span>
          <input type="email" inputmode="email" autocomplete="email" data-email /></label>
        <button type="button" class="entry-chip" data-resend>메일 다시 받기</button>
        <p class="entry-field-title" id="otp-label">인증번호 ${OTP_LENGTH}자리</p>
        <div class="otp" data-otp>
          <input class="otp-input" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="one-time-code" maxlength="${OTP_LENGTH}" aria-labelledby="otp-label" data-code />
          ${'<span class="otp-box" aria-hidden="true"></span>'.repeat(OTP_LENGTH)}
        </div>
        <button type="button" class="entry-btn coral" data-verify>로그인</button>
        <p class="entry-error" data-error hidden></p>
        <p class="entry-note">다른 기기에서 메일을 열어도 인증번호를 입력하면 돼요.</p>
      </div>
      <p class="entry-callout"><span aria-hidden="true">!</span>이 기기에서는 메일 속 로그인 링크를 눌러도 돼요.</p>
      <footer class="entry-foot">${entryLeaf()}<p>${privacy}</p></footer>
    </div>`;
  root.replaceChildren(el);
  const $ = <T extends HTMLElement>(s: string) => el.querySelector<T>(s)!;
  const emailInput = $<HTMLInputElement>('[data-email]');
  emailInput.value = email;
  const code = $<HTMLInputElement>('[data-code]');
  const boxes = [...el.querySelectorAll<HTMLElement>('.otp-box')];
  const err = $('[data-error]');
  const show = (m: string | null, ok = false) => {
    err.textContent = m ?? '';
    err.hidden = !m;
    err.classList.toggle('ok', ok);
  };
  // 숫자만, 자리 수까지. 다음에 넣을 칸을 표시한다
  const paint = () => {
    const digits = code.value.replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (digits !== code.value) code.value = digits;
    const focused = document.activeElement === code;
    boxes.forEach((b, i) => {
      b.textContent = digits[i] ?? '';
      b.classList.toggle('now', focused && i === Math.min(digits.length, OTP_LENGTH - 1));
      b.classList.toggle('filled', i < digits.length);
    });
  };
  code.addEventListener('input', () => {
    show(null);
    paint();
  });
  code.addEventListener('focus', paint);
  code.addEventListener('blur', paint);
  paint();
  code.focus();

  $('[data-resend]').addEventListener('click', async (e) => {
    const to = emailInput.value.trim();
    if (!/^\S+@\S+\.\S+$/.test(to)) return show('이메일 주소를 확인해 주세요.');
    const btn = e.currentTarget as HTMLButtonElement;
    btn.disabled = true;
    const m = await act.email(to);
    btn.disabled = false;
    show(m ?? '메일을 다시 보냈어요.', m === null);
  });
  $('[data-verify]').addEventListener('click', async (e) => {
    const to = emailInput.value.trim();
    if (code.value.length !== OTP_LENGTH) return show(`메일에 온 숫자 ${OTP_LENGTH}자리를 넣어 주세요.`);
    const btn = e.currentTarget as HTMLButtonElement;
    btn.disabled = true;
    const m = await act.verify(to, code.value);
    btn.disabled = false;
    if (m) return show(m);
    act.done();
  });
}
