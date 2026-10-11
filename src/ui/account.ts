// 계정 일 (0.2.1 설정): 서버 게임만 로그아웃할 수 있다. 서버 게임이 여는 곳(net/boot.ts)이 꽂는다. 로컬 게임에서는 단추를 숨긴다.
type SignOut = () => Promise<void>;

let signOutFn: SignOut | null = null;

export function setSignOut(fn: SignOut | null): void {
  signOutFn = fn;
}

export function canSignOut(): boolean {
  return signOutFn !== null;
}

export async function signOut(): Promise<void> {
  await signOutFn?.();
}
