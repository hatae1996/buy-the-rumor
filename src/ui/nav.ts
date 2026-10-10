// 화면 안에서 다른 탭으로 넘어가기 (여관의 "기록한 소문 보기" → 소식 탭). 셸이 이 이벤트를 듣고 탭을 고른다.
import type { TabId } from './shell';

export const TAB_EVENT = 'btr:tab';

export function goToTab(id: TabId): void {
  window.dispatchEvent(new CustomEvent<TabId>(TAB_EVENT, { detail: id }));
}
