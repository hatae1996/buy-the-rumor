"""소리 빌드 (0.2.1): assets-src/audio/의 원본을 게임용 MP3로 줄여 assets/audio/에 넣는다.

    npm run audio        (= python scripts/audio/build.py, ffmpeg가 PATH에 있어야 한다)

- 아이폰은 <audio>의 음량(volume)을 무시한다. 그래서 소리마다 들릴 크기(평균 dB)를 파일에 미리 넣고, 게임은 음량 1로 튼다.
  평균을 목표에 맞추고(volume), 튀는 소리는 리미터로 눌러 찢어지지 않게 한다.
- 효과음(sfx/): 누르자마자 나도록 다듬는다.
  · 앞 무음을 잘라 낸다(원본은 0.03~0.47초 뒤에 소리가 났다). 자른 자리는 아주 짧게 키워 딸깍 소리가 나지 않게.
  · 낮은 웅웅거림을 거르고(하이패스), 원본이 작아 크게 키워야 하는 지도·시장 소리는 잡음을 줄인다(afftdn).
  · 뒤 무음도 잘라 내고, 긴 것(이동·시장·짐칸)은 앞부분만 쓰고 끝을 서서히 줄인다.
  · WAV(모노 44.1kHz 16비트)로 낸다: MP3는 앞에 빈 틈이 붙고 풀어야 해서 늦게 난다. 짧아서 크기는 작다.
  터치음은 작게, 시장은 기획대로 "작게 들리게".
- 배경음(bgm/): 스테레오 44.1kHz 128kbps, 효과음 뒤에 깔리게. 원본 WAV(25MB)는 저장소에 넣지 않는다.
원본 파일 이름(기획자가 붙인 이름)과 게임 이름의 짝은 아래 표에 있다.
"""
import os
import re
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'assets-src', 'audio')
OUT = os.path.join(ROOT, 'assets', 'audio')

# (원본, 게임 이름, 쓸 길이(초, None이면 전부), 끝 줄이기(초), 목표 평균 크기(dB), 잡음 줄이기)
SFX = [
    ('터치음.mp3', 'sfx_tap', None, 0, -27, False),
    ('지도탭 눌렀을때.mp3', 'sfx_map', None, 0, -21, True),
    ('짐칸.mp3', 'sfx_cart', 1.8, 0.5, -20, False),
    ('장부확인.mp3', 'sfx_ledger', None, 0, -20, False),
    ('신문.mp3', 'sfx_paper', None, 0, -19, False),
    ('시장(눌렀을때 작게 들리기).mp3', 'sfx_market', 2.5, 0.9, -30, True),
    ('구매했을때.mp3', 'sfx_buy', None, 0, -18, False),
    ('말이동소리(이동중짧게).mp3', 'sfx_travel', 2.2, 0.7, -20, False),
]
# 앞 무음으로 볼 크기 (이보다 작으면 잘라 낸다)
LEAD_DB = -45
BGM = [('Merchant Square Morning.wav', 'bgm_merchant_square', -25)]
# 리미터: 이보다 큰 소리는 누른다 (약 -2dBFS, MP3로 줄이면 조금 넘친다)
LIMIT = 0.79


def mean_db(path: str, pre: list[str]) -> float:
    """평균 크기 (dBFS). pre: 재기 전에 거칠 필터 (자르기·끝 줄이기)"""
    af = ','.join([*pre, 'volumedetect'])
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', af, '-f', 'null', '-'], capture_output=True, encoding='utf-8', errors='replace')
    m = re.search(r'mean_volume: (-?[\d.]+) dB', r.stderr)
    if not m:
        sys.exit(f'{path}: 소리 크기를 못 쟀다')
    return float(m.group(1))


def encode(src: str, dst: str, filters: list[str], args: list[str]) -> None:
    cmd = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-af', ','.join(filters), *args, dst]
    subprocess.run(cmd, check=True)
    print(f'{os.path.basename(dst)}: {os.path.getsize(dst) // 1024}KB')


def level(path: str, pre: list[str], target: float) -> list[str]:
    """평균을 목표로 올리거나 내리고, 튀는 곳은 리미터로 누른다"""
    return [*pre, f'volume={target - mean_db(path, pre):.2f}dB', f'alimiter=limit={LIMIT}:level=false']


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    for src, name, length, fade, target, denoise in SFX:
        path = os.path.join(SRC, 'sfx', src)
        pre = ['highpass=f=70']
        if denoise:
            pre.append('afftdn=nf=-55')
        # 앞 무음 자르기 (4ms만 남긴다)
        pre.append(f'silenceremove=start_periods=1:start_threshold={LEAD_DB}dB:start_silence=0.004')
        if length:
            pre += [f'atrim=0:{length}', f'afade=t=out:st={length - fade}:d={fade}']
        else:
            # 뒤 무음 자르기: 뒤집어 앞을 자르고 다시 뒤집는다. 끝은 20ms로 줄인다
            pre += ['areverse', 'silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.02', 'afade=t=in:d=0.02', 'areverse']
        pre.append('afade=t=in:d=0.004')
        encode(path, os.path.join(OUT, f'{name}.wav'), level(path, pre, target), ['-ac', '1', '-ar', '44100', '-c:a', 'pcm_s16le'])
    for src, name, target in BGM:
        path = os.path.join(SRC, 'bgm', src)
        encode(path, os.path.join(OUT, f'{name}.mp3'), level(path, [], target), ['-ac', '2', '-ar', '44100', '-b:a', '128k'])


if __name__ == '__main__':
    main()
