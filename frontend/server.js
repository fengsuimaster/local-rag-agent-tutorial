import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';

import { PORT, ANTHROPIC_MODEL, MAX_HISTORY_ROUNDS, MAX_TOKENS, RAG_API_URL } from './config.js';
import { buildSystemPrompt } from './system-prompt.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = __dirname;

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// ─── Agent SDK（技能/工具/工作流全部自动处理） ───
let agentSdk = null;
async function getAgentSdk() {
  if (!agentSdk) {
    agentSdk = await import('@anthropic-ai/claude-agent-sdk');
  }
  return agentSdk;
}

// ─── 内存 Session 存储 ───
const sessions = new Map();

function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, []);
  }
  return sessions.get(sessionId);
}

// ─── RAG 检索 ───
async function fetchContext(question) {
  const target = `${RAG_API_URL}/retrieve`;
  try {
    const resp = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, top_k: 5 }),
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) {
      const text = await resp.text();
      console.warn(`[RAG] HTTP ${resp.status} from ${target}: ${text.slice(0,200)}`);
      return { context: null, results: [] };
    }
    const data = await resp.json();
    if (!data.context) {
      console.warn('[RAG] Empty context in response');
      return { context: null, results: [] };
    }
    return { context: data.context, results: data.results || [] };
  } catch (err) {
    console.warn(`[RAG] Cannot reach ${target}: ${err.message}`);
    return { context: null, results: [] };
  }
}

async function checkRagStatus() {
  try {
    const resp = await fetch(`${RAG_API_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!resp.ok) return 'unhealthy';
    const data = await resp.json();
    return data.status === 'ok' ? 'ok' : 'unhealthy';
  } catch {
    return 'unreachable';
  }
}

// ─── 路由 ───

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'templates', 'index.html'));
});

app.get('/api/health', async (req, res) => {
  const ragStatus = await checkRagStatus();
  res.json({ status: 'ok', projectRoot: PROJECT_ROOT, ragStatus });
});

app.post('/api/session', (req, res) => {
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  sessions.set(sessionId, []);
  res.json({ sessionId });
});

app.get('/api/session/:id', (req, res) => {
  const history = getSession(req.params.id);
  res.json({ sessionId: req.params.id, messages: history });
});

// ─── 主聊天端点 ───
app.post('/api/chat', async (req, res) => {
  const { message, sessionId, model } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({ error: '消息不能为空' });
  }

  let finalSessionId = sessionId;
  if (!finalSessionId || !sessions.has(finalSessionId)) {
    finalSessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    sessions.set(finalSessionId, []);
  }

  // SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // 将文本拆成小块输出，模拟流式打字机效果
  function streamText(text) {
    const CHUNK_SIZE = 5;
    for (let i = 0; i < text.length; i += CHUNK_SIZE) {
      send({ type: 'text', text: text.slice(i, i + CHUNK_SIZE) });
    }
  }

  const session = getSession(finalSessionId);
  let fullReply = '';

  try {
    const sdk = await getAgentSdk();

    // ── RAG 检索：从本地知识库获取上下文 ──
    send({ type: 'status', text: '检索知识库中...' });
    const { context, results } = await fetchContext(message);
    // RAG 上下文注入 system prompt，用户消息保持原样
    const userMessage = message;
    if (!context) {
      console.warn('[RAG] 未获取到上下文，使用无检索模式');
    } else {
      console.log(`[RAG] 上下文已注入 (${context.length} chars, ${results.length} 条结果)`);
      // ★ 将检索结果发送给前端展示
      send({ type: 'rag_results', results });
    }

    // 构建对话历史（原始消息入历史，检索上下文不入）
    const recentMessages = session.slice(-MAX_HISTORY_ROUNDS);
    let prompt = '';
    for (const msg of recentMessages) {
      if (msg.role === 'user') prompt += `用户: ${msg.content}\n`;
      else if (msg.role === 'assistant') prompt += `助手: ${msg.content}\n`;
    }
    prompt += `用户: ${userMessage}`;

    send({ type: 'status', text: '思考中...' });


	    const stream = sdk.query({
      prompt,
      options: {
        cwd: PROJECT_ROOT,
        systemPrompt: buildSystemPrompt(context),
        permissionMode: 'auto',
        maxTokens: MAX_TOKENS,
        model: model || ANTHROPIC_MODEL,
        // Skill 自动从 .claude/skills/ 加载
        // Workflow 自动从 .claude/workflows/ 加载
      },
    });

    for await (const msg of stream) {
      if (msg.type === 'assistant') {
        const blocks = msg.message?.content || [];
        for (const block of blocks) {
          if (block.type === 'text') {
            fullReply += block.text;
            streamText(block.text);
          } else if (block.type === 'tool_use') {
            send({
              type: 'tool_start',
              toolId: block.id,
              name: block.name,
              input: block.input,
            });
          }
        }
      } else if (msg.type === 'user') {
        const blocks = msg.message?.content || [];
        for (const block of blocks) {
          if (block.type === 'tool_result') {
            send({ type: 'tool_end', toolUseId: block.tool_use_id });
          }
        }
      } else if (msg.type === 'result') {
        if (msg.is_error) {
          send({ type: 'error', message: msg.result || '对话请求失败' });
        }
      }
    }

    session.push({ role: 'user', content: message });
    session.push({ role: 'assistant', content: fullReply });

    send({ type: 'done', sessionId: finalSessionId });
  } catch (err) {
    console.error('Chat error:', err);
    send({ type: 'error', message: err.message || '对话请求失败' });
  }

  res.end();
});

// ─── 启动 ───
function startServer(retries = 5) {
  const server = createServer(app);

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && retries > 0) {
      console.log(`   端口 ${PORT} 被占用，${retries} 秒后重试...`);
      setTimeout(() => startServer(retries - 1), 1000);
    } else {
      console.error('启动失败:', err.message);
      process.exit(1);
    }
  });

  server.listen(PORT, () => {
    console.log('');
    console.log('⚡ 电能变换与控制智能体');
    console.log(`   前端: http://localhost:${PORT}`);
    console.log(`   工作目录: ${PROJECT_ROOT}`);
    console.log('');
  });
}

startServer();
