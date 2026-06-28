# Local RAG Agent Tutorial

从零搭建**完全本地运行**的检索增强生成（RAG）教学智能体。涵盖核心概念、文档向量化、检索服务、Agent 集成与前端聊天界面。全程数据不出域，无需云端 API。

---

## 项目概览

本项目以**电力电子技术课程**为应用场景，构建了一套完整的本地 RAG 教学智能体系统：

```
用户提问 → 本地向量库检索 → RAG 上下文注入系统提示词 → Claude Agent 生成教学回答 → 流式返回前端
```

| 核心指标 | 数值 |
|---------|------|
| 知识库规模 | 6 份 Markdown 课件，182 KB |
| 向量节点 | 437 条 |
| 嵌入维度 | 4096 维（qwen3-embedding:8b） |
| 检索延迟 | 1~3 秒 |
| 相关度评分 | 0.6 ~ 0.72 |

---

## 架构

```
┌─────────────────┐      HTTP/SSE       ┌──────────────────┐      HTTP       ┌────────────────┐
│  前端聊天界面     │ ←─────────────────→ │  Node.js 中间层    │ ←─────────────→ │  RAG 检索服务   │
│  浏览器          │   POST /api/chat    │  Express + SDK    │   /retrieve     │  Flask :5050    │
└─────────────────┘                     └────────┬─────────┘                 └────────────────┘
                                                  │ SDK
                                                  ▼
                                         ┌────────────────┐
                                         │   Claude API    │
                                         │   云端推理       │
                                         └────────────────┘
```

**四节点协同**：前端（展示层） → Node.js（业务层） → Flask（服务层） → Claude API（推理引擎）。底层为 Python 索引层和本地 ChromaDB 数据层。各层松耦合，独立可替换。

---

## 目录结构

```
local-rag-agent-tutorial/
├── src/                              # Python 核心脚本
│   ├── config.py                     #   统一配置（路径、模型、切分参数）
│   ├── build_index.py                #   索引构建流水线（5 阶段）
│   ├── query_api.py                  #   RAG 检索 API（Flask 服务）
│   └── query_test.py                 #   交互式检索调试工具
│
├── frontend/                         # Node.js 聊天前端
│   ├── server.js                     #   Express 服务端 + SDK 调用 + SSE
│   ├── config.js                     #   环境变量映射 + 默认值
│   ├── system-prompt.js              #   系统提示词（含 RAG 动态注入）
│   ├── app.js                        #   前端交互逻辑 + DOM 渲染
│   ├── css/styles.css                #   聊天界面样式
│   ├── templates/index.html          #   主页面
│   └── package.json
│
├── docs/                             # 教学文档 + HTML 版教程
│   ├── md/                           #   Markdown 源文件（3 章）
│   ├── html/                         #   渲染后的网页版
│   ├── css/                          #   主题驱动样式表
│   └── images/                       #   配图
│
├── raw-docs/input/                   # 知识库 Markdown 文档
│   ├── power-device.md               #   电力电子器件
│   ├── ac-dc-rectifier.md            #   AC-DC 变换电路
│   ├── dc-dc-converter.md            #   DC-DC 变换电路
│   ├── dc-ac-inverter.md             #   DC-AC 变换电路
│   ├── ac-ac-converter.md            #   AC-AC 变换电路
│   └── soft-switching.md             #   软开关技术
│
├── database/vector/                  # ChromaDB 持久化目录（运行时生成）
├── .claude/skills/                   # Claude Code Skills
├── slides.html                       # 项目汇报幻灯片
├── requirements.txt                  # Python 依赖
├── .env.example                      # 环境变量模板
└── README.md
```

---

## 快速开始

### 环境要求

| 组件 | 版本 |
|------|------|
| Python | 3.10+ |
| Node.js | v16+ |
| Ollama | 最新版 |

### 1. 克隆并进入目录

```bash
git clone <your-repo-url>
cd local-rag-agent-tutorial
```

### 2. 安装 Python 依赖

```bash
pip install -r requirements.txt
```

### 3. 安装并启动 Ollama + 拉取嵌入模型

```bash
# 从 https://ollama.com 下载安装 Ollama
# 拉取嵌入模型
ollama pull qwen3-embedding:8b
```

### 4. 准备知识库文档

将 Markdown 文档放入 `raw-docs/input/`（已提供 6 份电力电子课件）。

### 5. 构建向量索引

```bash
python src/build_index.py
```

脚本按 5 阶段自动执行：加载文档 → 切分+预处理 → 嵌入连接 → 建库 → 逐批写入。完成后在 `database/vector/` 生成 437 条向量。

### 6. 测试检索

```bash
python src/query_test.py
```

输入问题查看检索结果（文件来源、章节路径、相关度分数、正文内容），输入 `exit` 退出。

### 7. 启动前端聊天界面

```bash
# 终端 1：启动 RAG 检索服务
python src/query_api.py

# 终端 2：安装前端依赖并启动
cd frontend
npm install
# 复制 .env.example 为 .env，填入 ANTHROPIC_API_KEY
node server.js
```

浏览器访问 `http://localhost:3001`，即可在 Web 页面进行 RAG 增强的智能对话。

---

## 核心文件说明

### Python 脚本 (`src/`)

| 文件 | 用途 | 运行方式 |
|------|------|---------|
| `config.py` | 统一配置中心：路径、模型名、切分参数、检索参数 | 被各脚本 `import` |
| `build_index.py` | 文档向量化流水线：加载→切分→嵌入→入库 | `python src/build_index.py` |
| `query_api.py` | Flask 检索 API：`/health`、`/retrieve` | `python src/query_api.py` |
| `query_test.py` | 命令行交互式检索调试工具 | `python src/query_test.py` |

### 前端 (`frontend/`)

| 文件 | 职责 |
|------|------|
| `server.js` | Express 服务端：路由、会话管理、RAG 编排、Agent SDK 调用、SSE 推送 |
| `config.js` | 读取 `.env` 并导出配置常量 |
| `system-prompt.js` | 动态生成系统提示词（接受 RAG 上下文参数） |
| `app.js` | 浏览器端逻辑：SSE 消费、Markdown 渲染、RAG 卡片、对话目录、localStorage |
| `templates/index.html` | 主页面布局 |

### 教学文档 (`docs/`)

| 章节 | 内容 |
|------|------|
| `01-concepts.md` | LLM、Agent、RAG、Embedding、提示词、Skill 等核心概念 |
| `02-local-rag-core.md` | 环境搭建、文档准备、Ollama、索引构建、检索服务 |
| `03-agent-integration.md` | 架构设计、配置管理、系统提示词、Agent SDK、SSE、前端界面 |

---

## 关键技术决策

| 决策 | 选择 | 原因 |
|------|------|------|
| 知识库格式 | Markdown | 层级标记天然支持语义切分，纯文本无编码开销 |
| 嵌入模型 | qwen3-embedding:8b（Ollama） | 8B 参数，中英双语，本地 CPU 推理 |
| 向量数据库 | ChromaDB | 轻量开源，本地持久化，HNSW 索引 |
| 切分策略 | Markdown 层级 + 超长二次切分 | 语义边界切分优于固定长度暴力截断 |
| RAG 上下文位置 | 系统提示词（非用户消息） | 最高优先级，Agent 严格遵循 |
| 通信协议 | SSE（非 WebSocket） | 单向流式推送，基于标准 HTTP，无需握手升级 |
| 前端方案 | Vanilla JS（零框架） | 交互模式固定，无需 React/Vue 的复杂度 |

---

## FAQ

**Q: Ollama 连接失败？**
确认 Ollama 已启动（`ollama list`），且已拉取 `qwen3-embedding:8b`。

**Q: 可以用其他嵌入模型吗？**
可以。修改 `src/config.py` 中 `EMBED_MODEL` 为 Ollama 中已拉取的其他模型，重新运行 `build_index.py` 重建索引。

**Q: `query_api.py` 和 `query_test.py` 有什么区别？**
`query_test.py` 是调试工具，输出详细元数据供人工评估。`query_api.py` 是 API 服务，输出拼接好的上下文文本供程序调用。

**Q: 前端端口被占用？**
修改 `.env` 中的 `PORT` 或 `RAG_PORT`，或让 `query_api.py` 自动探测可用端口。

---

## 许可证

本项目仅用于学习和研究目的。文档内容版权归原作者所有，代码部分使用 [MIT License](LICENSE)。

---

> 📖 从 `docs/html/01-concepts.html` 开始概念学习，或直接运行 `python src/build_index.py` 动手实践。
