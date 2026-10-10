// 아래에서 올라오는 크림색 쪽지 (0.1.6: 지도 마을 카드의 틀을 모든 쪽지에). 위 손잡이, 제목, 닫기.

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
    <header class="sheet-head"><div>
      <h2>${title}</h2>
      <button type="button" class="sheet-close" aria-label="닫기">✕</button>
    </div></header>
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
