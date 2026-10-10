// 서버 함수 부르기 (0.2.0 11번). 화면은 game·account 함수만 부르고, 로그인 토큰은 auth.ts가 준다.
// 시험에서는 이 모양으로 서버 코드(src/server)를 바로 부르는 가짜 연결을 꽂는다 (tests/ui/serverGame.test.ts).

export type FunctionName = 'game' | 'account';

export interface Api {
  /** 함수 하나를 부른다. 서버가 { ok: false, error }로 답한 것도 그대로 돌려준다. 닿지 못하면 ApiError */
  call<T>(fn: FunctionName, body: unknown): Promise<T>;
}

export class ApiError extends Error {
  constructor(
    /** null이면 서버에 닿지 못했다 (끊김) */
    readonly status: number | null,
    message: string,
  ) {
    super(message);
  }
}

export function httpApi(url: string, anonKey: string, token: () => Promise<string | null>): Api {
  return {
    async call<T>(fn: FunctionName, body: unknown): Promise<T> {
      const t = await token();
      let res: Response;
      try {
        res = await fetch(`${url}/functions/v1/${fn}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', apikey: anonKey, ...(t ? { authorization: `Bearer ${t}` } : {}) },
          body: JSON.stringify(body),
        });
      } catch {
        throw new ApiError(null, 'offline');
      }
      if (res.status === 401) throw new ApiError(401, 'noLogin');
      const json = (await res.json().catch(() => null)) as T | null;
      if (json === null) throw new ApiError(res.status, 'badResponse');
      return json;
    },
  };
}
