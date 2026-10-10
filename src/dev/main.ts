// 개발용 관찰 화면. 플레이어에게 보이지 않는 실제 상태를 모두 보여 준다.
import '../ui/theme.css';
import './dev.css';
import { mountWorldgenView } from './worldgen-view';
import { watchPortraits } from '../ui/portrait/portrait';

watchPortraits();
mountWorldgenView(document.getElementById('app')!);
