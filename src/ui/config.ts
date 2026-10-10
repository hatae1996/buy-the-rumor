// 화면 쪽 설정 (0.2.0). 서버 주소와 공개 키는 빌드 때 환경 값으로 넣는다(.env.local, 커밋하지 않음):
//   VITE_SUPABASE_URL=https://<프로젝트 ref>.supabase.co
//   VITE_SUPABASE_ANON_KEY=<공개 키>
// 둘 다 없으면 서버 게임을 쓰지 않고 로컬 게임(나 + 봇 11)으로 연다.

/** 시즌 결산 화면의 설문 링크 (handoff 0.2.0 5번). 기획자가 주소를 주면 넣는다. 비어 있으면 그 줄을 숨긴다 */
export const SURVEY_URL = '';

export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

/**
 * 구글 로그인 단추를 보일까 (VITE_LOGIN_GOOGLE=on). Supabase의 Google 공급자와 Google Cloud OAuth 클라이언트를
 * 설정한 뒤에 켠다. 꺼져 있으면 이메일 링크만 (supabase/README.md "로그인 설정")
 */
export const LOGIN_GOOGLE: boolean = import.meta.env.VITE_LOGIN_GOOGLE === 'on';

/** 서버 게임을 쓰는가 (주소와 공개 키가 있을 때) */
export const SERVER_MODE = SUPABASE_URL !== '' && SUPABASE_ANON_KEY !== '';
