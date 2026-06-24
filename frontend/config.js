/**
 * 服务端配置 — 所有可调参数集中管理
 * 敏感信息（如 API Key）请通过 .env 文件设置，切勿硬编码到此文件
 *
 * 使用方式：
 *   1. 复制项目根目录的 .env.example 为 .env
 *   2. 修改 .env 中的值
 *   3. 重启 server.js 即可生效
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// 从项目根目录加载 .env（dotenv 默认从 CWD 查找，这里显式指定）
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// 优先读取环境变量，否则使用默认值
export const PORT = process.env.PORT || 3001;

export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

// API Key 强制从环境变量读取，无默认值（避免泄漏）
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || null;

// 对话历史最大保留轮数
export const MAX_HISTORY_ROUNDS = 40;

// Agent 单次回复最大 token 数
export const MAX_TOKENS = 8192;
