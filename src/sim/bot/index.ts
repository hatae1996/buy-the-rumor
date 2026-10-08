export { BOT_PROFILES, botProfile, type BotGrowth, type BotProfile, type BotProfileId } from './profiles';
export { type AffordKind, type GrowthKind } from './growth';
export { botStep, createMind, type BotMind } from './bot';
export { runBot, runBotOn, type BotRun, type BotRunOptions } from './run';
// 순자산은 랭킹과 같은 계산을 쓴다
export { netWorth } from '../ranking/worth';
