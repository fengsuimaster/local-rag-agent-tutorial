# 毕业论文插图

> 所有图片按论文中的图号排列。代码块使用 mermaid 语法，可在支持 mermaid 的编辑器或导出工具中直接渲染为矢量图。

---

## 图1-1  RAG 技术原理示意图

```mermaid
graph LR
    Q[用户提问] --> E[嵌入模型<br/>文本向量化]
    E --> S[向量相似度搜索]
    
    subgraph KB[外部知识库]
        D1[文档1<br/>功率器件]
        D2[文档2<br/>DC-DC变换]
        D3[文档3<br/>AC-DC整流]
    end
    
    S --> KB
    KB --> R[检索结果<br/>top-K 相关片段]
    R --> C[上下文拼接]
    Q --> C
    C --> M[大语言模型<br/>阅读参考资料后生成回答]
    M --> A[基于权威来源的回答]
    
    style KB fill:#f0fdf4,stroke:#86efac
    style M fill:#eff6ff,stroke:#93c5fd
    style A fill:#fef3c7,stroke:#fcd34d
```

---

## 图2-1  RAG 工作流程图：用户提问 → 知识库检索 → 上下文注入 → 模型生成回答

```mermaid
graph LR
    A[用户提问<br/>什么是功率器件？] --> B[嵌入模型<br/>将问题向量化<br/>4096维]
    B --> C[向量数据库<br/>ChromaDB<br/>余弦相似度搜索]
    
    subgraph Docs[知识库文档]
        D1[power-device.md]
        D2[dc-dc-converter.md]
        D3[ac-dc-rectifier.md]
    end
    
    C --> Docs
    Docs --> E[检索结果<br/>top-5 最相关片段<br/>含文件来源+相关度]
    E --> F[上下文拼接<br/>参考资料 1 文件: xxx<br/>参考资料 2 文件: xxx]
    A --> F
    F --> G[注入大模型<br/>系统提示词 + 用户消息<br/>+ RAG上下文]
    G --> H[生成回答<br/>基于权威来源<br/>可追溯 可核查]
    
    style Docs fill:#fef3c7,stroke:#fcd34d
    style G fill:#eff6ff,stroke:#93c5fd
    style H fill:#f0fdf4,stroke:#86efac
```

---

## 图3-1  系统总体架构图（四节点五层架构）

```mermaid
graph TB
    subgraph Layer5[展示层 - 浏览器]
        A[前端聊天界面<br/>HTML + CSS + Vanilla JS<br/>消息渲染 · SSE消费 · localStorage]
    end
    
    subgraph Layer4[业务层 - Node.js :3001]
        B[Express 服务端<br/>路由 · 会话管理 · SSE推送]
        C[Claude Agent SDK<br/>sdk.query · 流式响应 · 工具调用]
    end
    
    subgraph Layer3[服务层 - Flask :5050]
        D[RAG 检索 API<br/>GET /health · POST /retrieve<br/>上下文拼接]
    end
    
    subgraph Layer2[索引层 - Python 脚本]
        E[build_index.py<br/>文档加载 → 切分 → 嵌入 → 入库<br/>5阶段流水线]
    end
    
    subgraph Layer1[数据层 - 本地磁盘]
        F[raw-docs/input/<br/>6份 Markdown 课件]
        G[database/vector/<br/>ChromaDB 持久化]
    end
    
    H[Claude API<br/>Anthropic 云端]
    
    A -->|POST /api/chat| B
    B -->|POST /retrieve| D
    D --> G
    E --> G
    F --> E
    B -->|sdk.query<br/>systemPrompt + context| H
    H -.->|AsyncIterable 流式响应| B
    B -.->|SSE 事件推送| A
    
    style A fill:#dbeafe,stroke:#93c5fd
    style B fill:#fef3c7,stroke:#fcd34d
    style C fill:#fef3c7,stroke:#fcd34d
    style D fill:#f0fdf4,stroke:#86efac
    style E fill:#fce7f3,stroke:#f9a8d4
    style H fill:#e0e7ff,stroke:#a5b4fc
```

---

## 图3-2  知识库六份文档的文件组织与内容覆盖示意图

```mermaid
graph TB
    subgraph Input[raw-docs/input/ 目录]
        direction LR
        F1[power-device.md<br/>41 KB<br/>功率器件<br/>二极管·SCR·MOSFET·IGBT]
        F2[ac-dc-rectifier.md<br/>45 KB<br/>AC-DC 变换<br/>单相/三相·全控/半控/PWM]
        F3[dc-dc-converter.md<br/>30 KB<br/>DC-DC 变换<br/>Buck·Boost·反激·正激]
        F4[dc-ac-inverter.md<br/>26 KB<br/>DC-AC 变换<br/>电压型/电流型·SPWM·UPS]
        F5[ac-ac-converter.md<br/>22 KB<br/>AC-AC 变换<br/>交流调压·交交变频]
        F6[soft-switching.md<br/>18 KB<br/>软开关技术<br/>ZVS·ZCS·准谐振·移相全桥]
    end
    
    subgraph Knowledge[知识覆盖矩阵]
        direction LR
        K1[电力电子器件]
        K2[AC-DC 变换]
        K3[DC-DC 变换]
        K4[DC-AC 变换]
        K5[AC-AC 变换]
        K6[软开关技术]
    end
    
    F1 --> K1
    F2 --> K2
    F3 --> K3
    F4 --> K4
    F5 --> K5
    F6 --> K6
    
    Input -->|总计 182 KB<br/>6个模块 全覆盖| Knowledge
    
    style Input fill:#f0fdf4,stroke:#86efac
    style Knowledge fill:#eff6ff,stroke:#93c5fd
```

---

## 图3-3  两级切分策略示意图：Markdown 层级切分 → 噪声过滤 → 路径注入 → 超长节点二次切分

```mermaid
graph TB
    A[原始 Markdown 文档] --> B[第一级切分<br/>MarkdownNodeParser<br/>按 # → ## → ### → #### 层级]
    B --> C[噪声过滤<br/>移除空标题节点<br/>移除 TOC 占位节点<br/>移除 YAML front matter]
    C --> D[路径前缀注入<br/>添加层级面包屑<br/>例：定义 > 功率器件概述 > 分类]
    D --> E{节点长度 > 1200 字符？}
    E -->|否| F[直接入库]
    E -->|是| G[第二级切分<br/>SentenceSplitter<br/>chunk=800 · overlap=100]
    G --> F
    
    style B fill:#dbeafe,stroke:#93c5fd
    style C fill:#fef3c7,stroke:#fcd34d
    style D fill:#f0fdf4,stroke:#86efac
    style G fill:#fce7f3,stroke:#f9a8d4
```

---

## 图3-4  索引构建的终端输出示例

```
==================================================
[1/5] 正在从 raw-docs/input 加载文档...
     加载完成，共 6 个文档。
     已移除 &emsp;&emsp; 缩进。

[2/5] 使用 Markdown 标题层级切分...
     初始切分得到 568 个节点。
--- 初始节点统计 ---
总节点数: 568
文本长度: 最小 15 字符, 最大 3850 字符, 平均 321.5 字符
  [0, 200): 312 个节点
  [200, 500): 180 个节点
  [500, 1000): 52 个节点
  [1000, 2000): 18 个节点
  [2000, 5000): 6 个节点
     过滤噪声后剩余 481 个节点。
     已为每个节点注入层级路径。

[2.5/5] 超长节点二次切分...
--- 二次切分后 ---
总节点数: 437

[3/5] 初始化嵌入模型: qwen3-embedding:8b
     连接成功，嵌入维度: 4096

[4/5] 准备向量库: database/vector
     集合名称: smps_knowledge
     相似度度量: cosine

[5/5] 开始逐批嵌入写入...
     进度:  50/437 ( 11%) | 耗时:  12s | 剩余: 92s
     进度: 200/437 ( 45%) | 耗时:  48s | 剩余: 57s
     进度: 350/437 ( 80%) | 耗时:  84s | 剩余: 21s
     进度: 437/437 (100%) | 耗时: 105s | 剩余:  0s
     嵌入写入完成，总耗时 105.0s
     向量库实际条目数: 437 ✓

索引构建成功！总耗时: 115.2s
==================================================
```

---

## 图3-5  RAG 检索 API 的请求与响应示例截图

```mermaid
sequenceDiagram
    participant C as 客户端<br/>curl / 前端
    participant S as Flask API<br/>127.0.0.1:5050
    participant E as Ollama<br/>嵌入模型
    participant V as ChromaDB<br/>向量库

    C->>S: POST /retrieve<br/>{"question":"什么是功率器件","top_k":3}
    S->>S: 解析请求参数
    S->>E: 将问题向量化
    E-->>S: 4096维向量
    S->>V: 余弦相似度搜索 top-3
    V-->>S: 3条最相关节点
    
    Note over S: 上下文拼接<br/>[参考资料N] 格式

    S-->>C: 200 OK<br/>{<br/>  "results": [<br/>    {<br/>      "file_name": "power-device.md",<br/>      "section": "/定义/功率器件概述/",<br/>      "score": 0.7162,<br/>      "text": "[定义 > 功率器件概述]\n### 功率器件的分类\n..."<br/>    },<br/>    ...<br/>  ],<br/>  "context": "[参考资料 1] 文件: power-device.md ..."<br/>}
```

---

## 图3-6  系统提示词层级结构示意图（六层提示词 + RAG 动态注入）

```mermaid
graph TB
    subgraph SP[系统提示词体系 buildSystemPrompt context]
        direction TB
        L0[<b>第〇层</b>  RAG 知识检索规则<br/>以参考资料为准 · 不虚构]
        L1[<b>第一层</b>  知识覆盖范围<br/>6个模块 · 能力边界]
        L2[<b>第二层</b>  五项核心能力<br/>知识问答 · 计算指导 · 电路分析<br/>故障诊断 · 设计引导]
        L3[<b>第三层</b>  教学策略<br/>引导优先 · 分层讲解 · 知识关联<br/>检验理解 · 深度控制]
        L4[<b>第四层</b>  回复格式规范<br/>Markdown · LaTeX · 表格 · 代码块<br/>禁emoji · 禁ASCII电路图]
        L5[<b>第五层</b>  诚实与安全<br/>不确定不编造 · 高压安全警告]
        L6[<b>第六层</b>  技能调用指引<br/>问题领域 → 匹配课程内容]
    end
    
    RAG[RAG 动态注入层<br/>━━━━━━━━━━━━━━<br/>当前检索到的权威参考资料<br/>[参考资料 1] 文件: xxx 章节: xxx<br/>正文内容...<br/>━━━━━━━━━━━━━━<br/>以上参考资料为标准答案来源]
    
    SP --> RAG
    RAG --> Claude[发送至 Claude API]
    
    style L0 fill:#fee2e2,stroke:#fca5a5
    style RAG fill:#fef3c7,stroke:#fcd34d
    style Claude fill:#dbeafe,stroke:#93c5fd
```

---

## 图3-7  SSE 事件流时序图（从用户提问到完整回答的全链路事件序列）

```mermaid
sequenceDiagram
    participant U as 用户浏览器
    participant F as 前端 app.js
    participant S as 服务端 server.js
    participant R as RAG API
    participant C as Claude API

    U->>F: 输入问题按 Enter
    activate F
    F->>F: 创建用户气泡 + 空助手气泡
    F->>S: POST /api/chat
    
    activate S
    S-->>F: ▶ status: "检索知识库中..."
    S->>R: POST /retrieve
    activate R
    R->>R: 嵌入向量化 + Chroma 搜索
    R-->>S: {context, results}
    deactivate R
    
    S-->>F: ▶ rag_results: 5条参考资料
    S-->>F: ▶ status: "思考中..."
    S->>C: sdk.query(prompt, systemPrompt)
    activate C
    Note over C: 系统提示词含RAG上下文
    
    loop Agent 流式生成
        C-->>S: text chunk (5字符)
        S-->>F: ▶ text: "功率器"
        S-->>F: ▶ text: "件通常"
        F->>F: Markdown 实时渲染
    end
    
    opt Agent 调用工具
        C-->>S: tool_use
        S-->>F: ▶ tool_start: "读取文件"
        C-->>S: tool_result
        S-->>F: ▶ tool_end
    end
    
    C-->>S: result
    deactivate C
    
    S->>S: 存入会话历史
    S-->>F: ▶ done
    deactivate S
    
    F->>F: 保存 localStorage
    deactivate F
    
    Note over U: 显示完整回答<br/>参考资料卡片 + 富文本回复
```

---

## 图3-8  前端聊天界面截图（展示检索结果卡片、对话目录和流式回答）

> **说明：此图为浏览器截图，需实际运行系统后截取。** 画面应展示以下界面元素：

```
┌──────────────────────────────────────────────────────────────┐
│ ⚡ 电能变换与控制智能体                    🗑 清空  ⚙ 设置    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────┐                   │
│  │ 功率器件有哪些类型？                  │  用户消息（蓝色）   │
│  └──────────────────────────────────────┘                   │
│                                                              │
│  ┌ 🔍 检索到 5 条参考资料 点击展开 ▶ ──────────────────┐   │
│  │ ┌──────────────────────────────────────────────────┐│   │
│  │ │ ① power-device.md                       72%     ││   │
│  │ │   定义 › 功率器件概述 › 功率器件的分类          ││   │
│  │ │   功率器件通常工作于高电压、大电流条件下，      ││   │
│  │ │   按导通与关断的可控性可分为三类...             ││   │
│  │ └──────────────────────────────────────────────────┘│   │
│  │ ┌──────────────────────────────────────────────────┐│   │
│  │ │ ② power-device.md                       67%     ││   │
│  │ │   定义 › 功率器件概述 › 功率器件的分类          ││   │
│  │ │   全控型器件是指可以用控制信号控制其导通...     ││   │
│  │ └──────────────────────────────────────────────────┘│   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  根据课程资料，功率器件按导通与关断的可控性可分为三类：      │
│                                                              │
│  **1. 不控型器件**                                           │
│  功率二极管，其导通和关断完全取决于外部电路条件...           │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────┐ [→]            │
│ │ 输入你的问题...                           │               │
│ └──────────────────────────────────────────┘               │
└──────────────────────────────────────────────────────────────┘
```

---

## 图3-9  完整请求生命周期流程图（五步链路）

```mermaid
graph TD
    S1[<b>① 用户输入</b><br/>浏览器中输入问题<br/>按 Enter 发送]
    S1 --> S2[<b>② 前端发起请求</b><br/>POST /api/chat<br/>fetch + ReadableStream<br/>接收 SSE 事件流]
    S2 --> S3[<b>③ 服务端处理</b>]
    
    subgraph Server[server.js 处理流程]
        direction TB
        A[设置 SSE 响应头<br/>Content-Type: text/event-stream]
        B[调用 fetchContext<br/>POST /retrieve → Flask API]
        C[问题向量化 → Chroma 搜索<br/>Ollama qwen3-embedding:8b]
        D[返回 context + results]
        E[推送 rag_results 到前端<br/>渲染参考资料卡片]
        F[构建动态系统提示词<br/>buildSystemPrompt context]
        G[拼接对话历史 + 当前提问<br/>prompt 变量]
        H[sdk.query prompt,<br/>systemPrompt, model]
        I[循环 AsyncIterable<br/>推送 text · tool_start · tool_end]
        J[存入会话历史<br/>推送 done 事件]
        
        A --> B --> C --> D --> E --> F --> G --> H --> I --> J
    end
    
    S3 --> Server
    
    Server --> S4[<b>④ 前端处理 SSE 事件</b><br/>rag_results → 参考资料卡片<br/>text → 逐块 Markdown 渲染<br/>tool_start/end → 工具指示条<br/>done → 保存 localStorage]
    
    S4 --> S5[<b>⑤ 用户看到完整回答</b><br/>参考资料卡片 折叠 + 展开<br/>助手回复 富文本渲染<br/>代码高亮 · 公式排版]
    
    style S1 fill:#dbeafe,stroke:#93c5fd
    style S2 fill:#dbeafe,stroke:#93c5fd
    style Server fill:#fef3c7,stroke:#fcd34d
    style S4 fill:#f0fdf4,stroke:#86efac
    style S5 fill:#fce7f3,stroke:#f9a8d4
```

---

## 图附-1  系统部署架构与各组件关系示意图

```mermaid
graph TB
    subgraph Local[本地环境]
        direction TB
        subgraph Browser[浏览器 localhost:3001]
            UI[前端界面<br/>index.html + app.js<br/>SSE消费 · localStorage]
        end
        
        subgraph Node[Node.js 进程 :3001]
            Express[Express Server<br/>路由 · 会话管理]
            SDK[Claude Agent SDK]
            SSE[SSE 推送引擎]
        end
        
        subgraph Python[Python 进程 :5050]
            Flask[Flask API<br/>query_api.py]
            LlamaIdx[LlamaIndex<br/>索引管理]
        end
        
        subgraph Storage[本地存储]
            Docs[raw-docs/input/<br/>6×Markdown 课件]
            Chroma[(ChromaDB<br/>database/vector/<br/>437条向量)]
        end
        
        subgraph OllamaSvc[Ollama 服务 :11434]
            Embed[qwen3-embedding:8b<br/>文本向量化 · 4096维]
        end
    end
    
    subgraph Cloud[云端]
        ClaudeAPI[Anthropic Claude API<br/>Claude Sonnet 4.6]
    end
    
    UI -->|HTTP POST| Express
    Express --> SDK
    Express --> Flask
    Flask --> LlamaIdx
    LlamaIdx --> Chroma
    LlamaIdx -->|嵌入请求| Embed
    Docs -->|build_index.py| Chroma
    SDK -->|HTTPS| ClaudeAPI
    ClaudeAPI -.->|流式响应| SDK
    Express --> SSE
    SSE -.->|EventStream| UI
    
    style Local fill:#f8fafc,stroke:#cbd5e1
    style Cloud fill:#e0e7ff,stroke:#a5b4fc
    style Chroma fill:#f0fdf4,stroke:#86efac
    style ClaudeAPI fill:#dbeafe,stroke:#93c5fd
```

---

> 共 10 幅插图（图1-1 至 图附-1），9 幅为 mermaid 矢量图，1 幅（图3-8）为浏览器截图需实际运行截取。
