// AI Module - Manufacturing Monitoring Agent
// Exports all AI functionality for the MES system

export { chat, chatStream, isAIEnabled } from './openrouter';
export type { ChatMessage, ChatOptions } from './openrouter';

export {
  analyzeProduction,
  answerQuestion,
  getProductionContext,
} from './analyzer';
export type { AIInsightData, AnalysisResult, ProductionContext } from './analyzer';

export { ANALYST_SYSTEM_PROMPT, CHAT_ASSISTANT_PROMPT } from './prompts';
