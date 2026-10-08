// 아래에서 올라오는 종이 쪽지. 판매 신청, 이동 확인, 자리를 비운 사이 요약에 쓴다.

export interface Sheet {
  el: HTMLElement;
  body: HTMLElement;
  close(): void;
}

let open: Sheet | null = null;

export function openSheet(title: string, onClose?: () => void): Sheet {
  open?.close();
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  const el = document.createElement('section');
  el.className = 'sheet';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', title);
  el.innerHTML = `
    <header class="sheet-head">
      <h2>${title}</h2>
      <button type="button" class="sheet-close" aria-label="닫기">✕</button>
    </header>
    <div class="sheet-body"></div>`;
  backdrop.appendChild(el);
  document.body.appendChild(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('is-open'));

  const sheet: Sheet = {
    el,
    body: el.querySelector('.sheet-body')!,
    close() {
      if (open === sheet) open = null;
      backdrop.remove();
      onClose?.();
    },
  };
  el.querySelector('.sheet-close')!.addEventListener('click', () => sheet.close());
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) sheet.close();
  });
  open = sheet;
  return sheet;
}
