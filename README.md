好的，我已根据你提供的 `query_api.py` 和 `query_test.py` 的实际功能和定位，全面更新了 README.md。以下是完善后的版本。

```markdown
# Local RAG Agent Tutorial

从零搭建完全本地运行的检索增强生成（RAG）智能体 —— 涵盖核心概念、文档向量化、检索服务、工作流集成与 Agent 进阶。所有处理均在本地完成，数据不出域，无需云端 API。

---

## 目录结构

```
local-rag-agent-tutorial/
├── README.md                          # 本文件
│
├── docs/                              # 教学文档
│   ├── md/                            # Markdown 源文件
│   │   ├── 01-concepts.md             # 第1章：核心概念解析
│   │   ├── 02-local-rag-core.md       # 第2章：本地 RAG 核心搭建
│   │   └── 03-workflow-and-agent.md   # 第3章：工作流集成与 Agent 进阶
│   ├── html/                          # 渲染后的 HTML（含样式）
│   │   ├── 01-concepts.html
│   │   ├── 02-local-rag-core.html
│   │   └── 03-workflow-and-agent.html
│   ├── css/                           # 教程 HTML 使用的样式表
│   ├── ttf/                           # 教程 HTML 使用的字体文件
│   └── images/                        # 教程配图（截图、架构图等）
│
├── src/                               # 核心脚本
│   ├── build_index.py                 # 文档向量化：读取 Markdown → 切分 → 嵌入 → 存入 Chroma
│   ├── query_test.py                  # 调试用检索工具：交互式，输出详细元数据、章节路径、相关度分数
│   └── query_api.py                   # RAG 集成接口：命令行批处理 / 被 Python 模块调用，输出简洁上下文
│
├── frontend/                          # 对话前端界面（可选）
│   ├── package.json                   # Node.js 项目配置，定义依赖
│   ├── node_modules/                  # 本地依赖目录（npm install 后生成，不提交）
│   ├── templates/                     # HTML 模板
│   │   └── index.html                 # 主页面
│   ├── css/                           # 前端样式
│   │   └── styles.css
│   ├── app.js                         # 前端交互逻辑
│   └── server.js                      # Node.js 后端，集成 Claude Agent SDK
│
├── raw-docs/                          # 示例文档（原始知识库） 存放待向量化的 Markdown 文件
│   └── input/                         
│       ├── power-device.md            # 功率器件
│       ├── dc-dc-converter.md         # DC-DC 变换器
│       ├── ac-dc-rectifier.md         # AC-DC 整流器
│       ├── dc-ac-inverter.md          # DC-AC 逆变器
│       ├── ac-ac-converter.md         # AC-AC 变换器
│       └── soft-switching.md          # 软开关技术
│
├── database/                          # 运行时数据（向量库，建议 .gitignore）
│   └── vector/                        # Chroma 持久化目录（运行 build_index.py 后生成）
│       └── chroma.sqlite3
├── node_modules/                      # nodejs依赖
└── requirements.txt                   # 本项目 Python 依赖清单（仅直接使用的包）
```

---

## 文件说明

### 教学文档 (`docs/`)

| 文件 | 描述 |
|------|------|
| `md/01-concepts.md` | 核心概念：Skill、RAG、LLM、Embedding、Agent、SDK、API 的定义与关系图 |
| `md/02-local-rag-core.md` | 环境搭建、文档预处理、向量库构建 (`build_index.py` 全流程)、纯检索实现 |
| `md/03-workflow-and-agent.md` | 封装 API、集成 n8n/脚本工作流、接入生成模型形成完整 RAG、Agent 工具调用进阶 |
| `html/*.html` | 对应 Markdown 的网页版，包含统一 CSS 样式和字体（`css/`、`ttf/`），便于离线阅读 |
| `css/` | 教程 HTML 使用的样式表 |
| `ttf/` | 教程 HTML 使用的字体文件（如 `SanJiLuRongTi-2.ttf`） |
| `images/` | 教程中的架构图、截图、流程图等 |

### 核心代码 (`src/`)

- **`build_index.py`**  
  离线执行一次，将 `raw-docs/input/` 下所有 `.md` 文件按 Markdown 标题层级切分，调用本地 Ollama 嵌入模型 (`qwen3-embedding:8b`) 生成向量，存入 Chroma 向量库。  
  内置预处理（移除 `&emsp;&emsp;` 缩进避免切分异常）、逐批写入、进度显示与最终条目校验。

- **`query_test.py`**  
  **调试与交互式检索工具。** 加载向量库后进入命令行交互循环，每输入一个问题，输出最相关片段的完整元数据：文件名、章节路径、相关度分数、完整文本内容。适合在开发阶段人工验证检索质量、评估切片与嵌入效果。  
  用法：`python query_test.py`，输入 `exit` 退出。

- **`query_api.py`**  
  **面向 RAG 集成的检索接口。** 设计目标是输出简洁、可机读的结果，方便直接喂给下游大模型。支持三种调用方式：
  - **命令行传参**：`python query_api.py "什么是软开关" --top_k 3`
  - **被其他 Python 模块调用**：`from query_api import retrieve, context_from_results`
  - **批量处理文件**：`python query_api.py --file questions.txt --top_k 5 --format json`
  
  默认输出为**拼接好的纯文本上下文**（`--format text`），所有片段用分隔线隔开，可直接作为 Prompt 的参考资料部分。也可通过 `--format json` 输出结构化结果供程序解析。

### 前端界面 (`frontend/`)

- `package.json`：定义 Node.js 项目及其依赖，主要包含 **Claude Agent SDK** 等库。
- `node_modules/`：`npm install` 后自动生成，存放所有本地依赖包。**该目录位于项目文件夹内，不会污染全局 Node 环境。**
- `templates/index.html`：用户提问的 Web 页面，调用后端 API 展示答案。
- `css/styles.css`：前端样式文件。
- `app.js`：前端逻辑（发送问题、接收流式/非流式回复、渲染结果）。
- `server.js`：简易 Node.js 后端，使用 **Claude Agent SDK** 处理复杂的多步 Agent 任务，并代理 API 请求或直接提供本地推理服务。

### 数据 (`raw-docs/`)

- `input/`：存放待处理的私有 Markdown 文档（如技术笔记、产品手册）。当前包含电源技术主题文档：`dc-dc-converter.md`、`dc-ac-inverter.md`、`ac-dc-rectifier.md`、`ac-ac-converter.md`、`soft-switching.md`、`power-device.md` 等。

### 向量库 (`database/vector/`)

运行 `build_index.py` 后自动生成，使用 **Chroma** 嵌入 SQLite 存储。可直接用 DataGrip 等工具打开 `chroma.sqlite3` 查看文本片段与元数据。

---

## 环境要求

- **操作系统**：Windows / Linux / macOS（本文以 Windows 为例）
- **Python**：3.10 或更高版本，建议使用虚拟环境管理依赖
- **Ollama**：已安装并拉取模型 `qwen3-embedding:8b`（检索用）；如需完整 RAG 问答还需生成模型（如 `qwen2:1.5b`）
- **Node.js**（可选，用于前端界面）：v16 或更高版本。所有 npm 包将安装到 `frontend/node_modules/`，完全隔离，不会影响系统中的其他项目。
- **包管理器**：pip（Python）、npm（Node.js 前端）

> 硬件建议：嵌入过程可使用 CPU 运行（8核，每节点约 5~8 秒）。若需流畅的生成体验，建议配备 6GB 以上显存的 NVIDIA GPU。

---

## 快速开始

### 1. 克隆项目并进入目录
```bash
git clone <your-repo-url>
cd local-rag-agent-tutorial
```

### 2. 创建并激活 Python 虚拟环境（推荐）
```bash
python -m venv venv

# Windows PowerShell 激活
.\venv\Scripts\Activate.ps1

# macOS / Linux 激活
source venv/bin/activate
```
> 若你已有现成的虚拟环境（如 `D:\PythonEnvironments\openai_env`），可直接激活它。以下步骤均假设虚拟环境已激活。

### 3. 安装 Python 依赖
```bash
pip install -r requirements.txt
```
`requirements.txt` 仅列出了本项目直接使用到的包，不包含环境中的其他无关库。

### 4. 准备知识库文档
将你的 Markdown 文档放入 `raw-docs/input/` 目录。  
可先使用提供的 7 个电源技术文档进行测试。

### 5. 构建向量库
```bash
python src/build_index.py
```
首次运行会根据文档数量耗时数分钟至一小时不等，请保持 Ollama 服务运行。  
成功后会输出 `✓ 所有节点写入成功！`，向量数据存储在 `database/vector/`。

### 6. 测试检索
```bash
python src/query_test.py
```
输入问题，例如“什么是软开关”，观察返回的详细片段信息（文件名、章节、相关度分数）。  
确认检索质量满意后，按 `exit` 退出。

### 7. （可选）启动完整 RAG 服务 + 前端
```bash
# 启动 Python 后端（检索 + 生成）
python src/query_api.py

# 另开终端，安装并启动 Node.js 前端（含 Agent 能力）
cd frontend
npm install                # 仅首次运行，所有依赖安装到当前目录下的 node_modules/
node server.js
```
浏览器访问 `http://localhost:3000`（或 server.js 配置的端口），即可在 Web 页面对话。  
`server.js` 集成了 **Claude Agent SDK**，可处理需要多步工具调用的复杂任务。

---

## 使用指南

### 仅搭建检索模块
若你只希望将检索作为工作流的一个环节，只需执行步骤 1-6。有两种方式获取检索结果：
- **调试查看**：运行 `python src/query_test.py`，交互式提问，查看详细的元数据与相关度分数。
- **程序调用**：在 Python 中 `from query_api import retrieve, context_from_results`，或命令行直接生成上下文文本。

### 在代码中集成检索
```python
from query_api import retrieve, context_from_results

# 获取结构化结果
results = retrieve("什么是磁通复位原则？", top_k=5)

# 获取拼接好的上下文，直接喂给大模型
context = context_from_results(results)
prompt = f"参考资料：\n{context}\n\n问题：什么是磁通复位原则？\n回答："
# 将 prompt 发送给 Ollama 或 OpenAI API...
```

### 命令行生成上下文
```bash
python src/query_api.py "什么是软开关" --top_k 3 > context.txt
```
生成的 `context.txt` 可直接粘贴到任何大模型对话中作为背景资料。

### 批量处理问题
```bash
python src/query_api.py --file questions.txt --top_k 5 --format json > results.json
```
`questions.txt` 每行一个问题，输出为 JSON 格式便于程序解析。

### 完整本地问答
执行步骤 7，启动 `query_api.py` 后，服务会接收问题 → 检索向量库 → 将片段填入 Prompt → 调用本地生成模型 → 返回最终答案。  
你可以在 `query_api.py` 中修改 `GENERATE_MODEL` 切换生成模型，或改为调用 OpenAI 兼容 API。

### 自定义文档类型
默认使用 `MarkdownNodeParser` 按标题切分，如果你的文档结构不同，可在 `build_index.py` 中替换为 `SentenceSplitter`（固定长度切分）或自定义解析器。

### Claude Agent 的高级使用
`frontend/server.js` 演示了如何使用 Claude Agent SDK 构建智能体：它不仅能回答简单的 RAG 问题，还能根据用户意图自动调用检索工具、计算工具甚至外部 API。你可以参考该文件扩展你自己的 Agent 工具集。所有交互的密钥和配置应存放在 `.env` 文件中，确保不泄露。

---

## 依赖清单

### Python 包 (`requirements.txt`)
以下是本项目直接依赖的包及其用途，执行 `pip install -r requirements.txt` 即可安装：

```txt
llama-index-core                 # RAG 框架核心
llama-index-readers-file         # 文件读取（Markdown等）
llama-index-embeddings-ollama    # 对接 Ollama 嵌入模型
llama-index-vector-stores-chroma # 对接 Chroma 向量库
chromadb                         # 本地向量数据库
Flask                            # Web API 服务（用于 query_api.py）
requests                         # HTTP 请求（如需调用远端模型）
sentence-transformers            # 可选备用嵌入模型
```

### Node.js 前端依赖 (`frontend/package.json`)

**所有 npm 包将安装到 `frontend/node_modules/` 目录，完全本地化，无需加 `-g`。**  
主要依赖：

- **`@anthropic-ai/claude-agent-sdk`** – Claude 官方 Agent SDK，用于构建多步推理、工具调用的智能体
- `express` – 轻量 Web 服务器框架（如果 server.js 使用了它）
- 其他可能的前端交互库（如 `marked`、`highlight.js` 等，具体见 `package.json`）

> 安装命令：`cd frontend && npm install`  
> 该命令会根据 `package.json` 和 `package-lock.json` 将所有依赖下载到本地 `node_modules/`，不会影响系统全局。

### 模型（通过 Ollama 拉取）
- 嵌入模型：`qwen3-embedding:8b`（必需）
- 生成模型（可选，完整 RAG 用）：`qwen2:1.5b` 或 `qwen2:7b` 等

---

## 常见问题

**Q: 构建索引时显示“向量库实际条目数: 0”？**  
A: 确保在创建 Chroma collection 时设置了 `embedding_function=None`，防止 Chroma 自动调用默认嵌入模型干扰写入。

**Q: 检索结果只有标题没有正文？**  
A: 文档中的 `&emsp;&emsp;` 缩进可能导致标题与正文切分分离。`build_index.py` 已内置预处理自动移除这些缩进，若仍有问题请检查是否使用了最新版脚本。

**Q: Ollama 连接失败？**  
A: 确认 Ollama 服务已启动（Windows 系统托盘有羊驼图标），或终端执行 `ollama list` 测试连接。

**Q: 可以用其他嵌入模型吗？**  
A: 可以，修改 `build_index.py`、`query_test.py` 和 `query_api.py` 中的 `EMBED_MODEL` 变量为 Ollama 中已拉取的其他模型即可。

**Q: `query_api.py` 和 `query_test.py` 有什么区别？**  
A: `query_test.py` 是调试工具，交互式运行，输出包含文件名、章节路径、相关度分数等详细元数据，适合人工评估检索质量。`query_api.py` 是集成接口，支持命令行批处理和 Python 模块调用，默认输出简洁的拼接上下文，适合直接喂给大模型。

**Q: npm install 报错或安装缓慢？**  
A: 可尝试配置国内镜像源（如 `npm config set registry https://registry.npmmirror.com`），然后重新安装。所有包依然安装在本地 `node_modules/`。

---

## 许可证

本项目仅用于学习和研究目的。文档内容版权归原作者所有，代码部分使用 [MIT License](LICENSE)。

---

> **下一步：** 阅读 `docs/html/01-concepts.html` 开始概念学习，或直接运行 `src/build_index.py` 动手实践。祝你搭建愉快！
```