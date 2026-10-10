// 위 줄(날짜·돈) 아래를 덮는 페이지 (0.1.6 시장·거래 예약 목업): "‹ 마을"처럼 돌아가는 단추와 가운데 제목.
// 페이지 위에 페이지를 쌓을 수 있다 (시장 → 거래 예약). 돌아가기, Esc, 기기 뒤로 가기 대신 단추로 닫는다.

export interface Page {
  el: HTMLElement;
  body: HTMLElement;
  close(): void;
  onClose(fn: () => void): void;
}

const stack: Page[] = [];

export function openPage(opts: { back: string; title: string; sub?: string; icon?: string }): Page {
  const el = document.createElement('section');
  el.className = 'page';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', opts.title);
  // 위 줄 바로 아래부터 (위 줄의 날짜·피로·돈은 그대로 보인다)
  const bar = document.querySelector('.status-bar');
  el.style.top = `${bar ? Math.round(bar.getBoundingClientRect().bottom) : 0}px`;
  el.innerHTML = `
    <header class="page-head">
      <button type="button" class="page-back" data-page-back>‹ ${opts.back}</button>
      <h2>${opts.title}${opts.sub ? `<small>${opts.sub}</small>` : ''}</h2>
      <span class="page-icon">${opts.icon ? `<img src="${opts.icon}" alt="" />` : ''}</span>
    </header>
    <div class="page-body"></div>`;
  const closers: (() => void)[] = [];
  const page: Page = {
    el,
    body: el.querySelector('.page-body')!,
    close() {
      const i = stack.indexOf(page);
      if (i < 0) return;
      // 이 페이지 위에 쌓인 것도 함께 닫는다
      for (const above of stack.slice(i + 1).reverse()) above.close();
      stack.splice(stack.indexOf(page), 1);
      el.remove();
      closers.forEach((fn) => fn());
    },
    onClose(fn) {
      closers.push(fn);
    },
  };
  el.querySelector('[data-page-back]')!.addEventListener('click', () => page.close());
  stack.push(page);
  document.body.appendChild(el);
  return page;
}

/** 열린 페이지를 모두 닫는다 (다른 탭으로 넘어갈 때) */
export function closeAllPages(): void {
  for (const page of [...stack].reverse()) page.close();
}

document.addEventListener('keydown', (e) => {
  // 쪽지가 떠 있으면 쪽지가 먼저 (쪽지는 따로 닫는다)
  if (e.key === 'Escape' && stack.length && !document.querySelector('.sheet-backdrop')) stack[stack.length - 1]!.close();
});
