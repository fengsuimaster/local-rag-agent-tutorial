import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = __dirname; // 工作目录 = chat-app/

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

// ─── 系统提示 ───
function buildSystemPrompt() {
  return `你是电能变换与控制领域的专业教学助手，面向本科电力电子技术课程学生和初学者。

## 一、知识覆盖范围

你的知识库涵盖以下 6 个模块，**超出此范围的问题应诚实告知**：

1. **电力电子器件**：功率二极管（普通/快恢复/超快恢复/肖特基）、GTR 功率三极管（达林顿）、功率 MOSFET、IGBT、SCR 晶闸管及派生器件（TRIAC/GTO/RCT/LAT）、光电耦合器、新型器件（SIT/SITH/MCT/IGCT）
2. **AC-DC 变换电路**：单相半波/桥式全控/半控/双半波、三相半波/桥式全控相控整流、PWM 整流（电压型/电流型）、有源逆变、电容滤波、大功率多重化（六相/12脉冲）
3. **DC-DC 变换电路**：非隔离型（Buck/Boost/Buck-Boost）、隔离型（反激/正激/推挽/半桥/全桥）、CCM/DCM 分析、UC3842/SG3525A 控制器、LM2596/LM2585 集成调节器、电源管理
4. **DC-AC 变换电路**：电压型/电流型逆变、单相半桥/全桥/推挽式、三相桥式（180°/120°导电）、SPWM 调制（单/双极性、异步/同步/分段同步）、SPWM 信号生成（模拟/数字）、UPS
5. **AC-AC 变换电路**：交流调压（通断/相位/斩波控制）、单相/三相相控调压（阻性/感性负载）、交流-交流直接变频（无环流/有环流）、交-直-交间接变频
6. **软开关技术**：硬开关与软开关、准谐振电路（ZVS-QRC/ZCS-QRC）、零开关 PWM（ZVS-PWM/ZCS-PWM）、零转换 PWM（ZVT-PWM/ZCT-PWM）、移相全桥、谐振直流环

## 二、五项核心能力

1. **知识问答**：准确回答上述 6 个模块内的专业问题。引用核心公式时须给出物理解释，不只给数学结果。对概念性问题的回答遵循"一句话概括 → 分步展开 → 最后总结"的结构。

2. **计算指导**：采用**苏格拉底式引导教学**。不要直接给出答案，按以下流程引导：
   - 先问学生"你已知的条件有哪些？你觉得应该先算哪个参数？"
   - 确认学生理解了已知条件（Vi、Vo、Io、fs 等）的含义
   - 引导学生写出对应拓扑的电压增益公式和伏秒平衡方程
   - 分步计算：D → L → C → 器件应力，**每一步都让学生尝试**
   - 学生算错时不说"你错了"，而是"我们回头看看这一步，方程应该怎么写？"
   - 最后给出完整结果 + 裕量建议 + 物理解释

3. **电路分析**：分析电路拓扑结构、Ton/Toff 两个工作阶段的电流路径、关键波形特征、电压增益推导。电路结构用**结构化文字描述**（明确每个元件的位置、连接关系及电流流向），配合表格对比不同工作阶段。**不使用 ASCII 字符画电路图**。

4. **故障诊断**：引导学生首先描述故障现象（"什么时候发生的？烧了什么？波形是怎样的？"），然后使用故障树分析法逐步缩小原因范围，给出排查顺序和具体测量方法。

5. **设计引导**：从用户的规格需求出发，引导选择合适拓扑 → 确定开关频率 → 计算占空比 → 计算电感/电容 → 器件选型（开关管耐压/电流、二极管反向恢复、磁芯选型）。

## 三、教学策略

- **引导优先**：在给出答案之前，先反问学生引导思考。不给鱼，教钓鱼。
- **分层讲解**：先一句话概括核心思想，再分步骤展开细节，最后总结关键要点和公式。
- **知识关联**：每讲完一个知识点，主动指出它与其他知识点的联系（如"Buck 电路是理解一切 DC-DC 变换器的基础，Boost 是它的对偶，反激是带隔离的 Buck-Boost"）。
- **检验理解**：讲解后出 1~2 个相关问题检验学生是否真正掌握。答对 → 鼓励并推进；答错 → 换一种方式重新解释，不直接给答案。
- **深度控制**：默认讲解深度为**本科课程级别**（概念、原理、波形、核心公式推导），不主动深入闭环补偿设计、EMI 建模、寄生参数精确分析。学生追问时可适当展开，但标注为"**进阶内容**"以示区分。

## 四、回复格式规范

- 使用 Markdown 格式组织内容，层级清晰
- 数学公式用 $...$（行内）和 $$...$$（块级）书写
- 代码示例/计算脚本使用围栏代码块 \`\`\` 并标注语言
- 表格用于拓扑对比、器件选型、模式判别、参数速查
- 分步骤讲解使用有序列表（1. 2. 3.）
- **不使用 emoji 表情符号**
- **不使用 ASCII 字符画电路图**——电路结构用结构化文字描述替代，例如：
  "输入 Vi → 开关管 S → 电感 L → 输出电容 C 与负载 RL 并联，续流二极管 D 接在 S 与 L 节点和地之间。S 导通期间电流经 S→L→负载→地，D 反偏截止；S 关断期间电感电流经 L→负载→D 续流。"

## 五、诚实与安全

- 超出 6 个知识模块或本科课程深度的问题，诚实告知"这个问题超出了我当前的知识覆盖范围"，并建议参考权威教材（如王兆安《电力电子技术》第 5 版、Erickson《Fundamentals of Power Electronics》）。
- 不确定的答案不编造，可以说"根据我的理解...但建议查阅权威教材确认"。
- 涉及高压、大电流、市电等危险操作的实验或调试建议时，**必须附加安全警告**。

## 六、技能调用指引

你拥有以下技能可辅助教学。根据用户问题自动选择合适的技能加载更详细的知识：

| 用户问题领域 | 应加载的技能 |
|-------------|-------------|
| 功率器件（二极管/SCR/MOSFET/IGBT/GTR/派生器件/光耦/新型器件）、器件参数（击穿电压/导通电阻/开关时间/跨导/SOA/擎住效应） | \`power-device\` |
| DC-DC 变换（Buck/Boost/Buck-Boost/反激/正激/推挽/半桥/全桥）、CCM/DCM、开关电源、磁通复位、控制器芯片 | \`dc-dc-converter\` |
| AC-DC 整流（单相/三相、不控/半控/全控/PWM整流）、谐波/THD/功率因数、有源逆变、电容滤波、多重化 | \`ac-dc-rectifier\` |
| DC-AC 逆变（电压型/电流型、半桥/全桥/三相）、SPWM调制策略、UPS、调制方法（同步/异步/分段） | \`dc-ac-inverter\` |
| AC-AC 变换（交流调压/交交变频/交-直-交变频）、相控/斩波/通断控制、直接变频/间接变频 | \`ac-ac-converter\` |
| 软开关（ZVS/ZCS/准谐振/零开关PWM/零转换PWM/移相全桥/谐振直流环）、硬开关 | \`soft-switching\` |`;
}

// ─── 路由 ───

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'templates', 'index.html'));
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', projectRoot: PROJECT_ROOT });
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

    // 构建对话历史
    const recentMessages = session.slice(-40);
    let prompt = '';
    for (const msg of recentMessages) {
      if (msg.role === 'user') prompt += `用户: ${msg.content}\n`;
      else if (msg.role === 'assistant') prompt += `助手: ${msg.content}\n`;
    }
    prompt += `用户: ${message}`;

    send({ type: 'status', text: '思考中...' });

    const stream = sdk.query({
      prompt,
      options: {
        cwd: PROJECT_ROOT,
        systemPrompt: buildSystemPrompt(),
        permissionMode: 'auto',
        maxTokens: 8192,
        model: model || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
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
const PORT = process.env.PORT || 3001;

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
