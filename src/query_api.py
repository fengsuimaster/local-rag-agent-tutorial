"""
query_api.py —— RAG 检索服务（Flask）
用法：
    python src/query_api.py              # 默认 5050 端口
    RAG_PORT=5055 python src/query_api.py  # 指定端口

端点：
    GET  /          — 服务说明
    GET  /health    — 健康检查
    POST /retrieve  — 检索，body: {"question":"...","top_k":5}
"""
import os
import sys
import socket
from flask import Flask, request, jsonify

from llama_index.core import VectorStoreIndex, Settings
from llama_index.embeddings.ollama import OllamaEmbedding
from llama_index.vector_stores.chroma import ChromaVectorStore
import chromadb

from config import PERSIST_DIR, COLLECTION_NAME, EMBED_MODEL, SIMILARITY_TOP_K

# ======================== Flask 应用 ========================
app = Flask(__name__)

# 全局持有索引对象，启动时加载一次
index = None
collection_count = 0


# ======================== 索引加载 ========================
def load_index():
    """加载 Chroma 向量库索引，返回 VectorStoreIndex 对象"""
    if not os.path.exists(PERSIST_DIR):
        raise FileNotFoundError(f"向量库目录不存在：{PERSIST_DIR}")

    Settings.embed_model = OllamaEmbedding(
        model_name=EMBED_MODEL,
        request_timeout=120
    )

    db = chromadb.PersistentClient(path=PERSIST_DIR)
    chroma_collection = db.get_collection(
        name=COLLECTION_NAME,
        embedding_function=None
    )
    vector_store = ChromaVectorStore(chroma_collection=chroma_collection)
    return VectorStoreIndex.from_vector_store(vector_store), chroma_collection.count()


# ======================== 上下文拼接 ========================
def context_from_results(results):
    """将检索结果拼接为 prompt 就绪的纯文本上下文"""
    lines = []
    for i, node in enumerate(results, 1):
        meta = node.metadata
        fname = meta.get("file_name", "未知")
        section = meta.get("section", "未知")
        lines.append(f"[参考资料 {i}] 文件: {fname}  |  章节: {section}")
        lines.append(node.text.strip())
        lines.append("")
    return "\n".join(lines).strip()


# ======================== 路由 ========================
@app.route("/")
def home():
    return f"""
    <h2>RAG 检索服务</h2>
    <p>向量库: {COLLECTION_NAME}（{collection_count} 条）</p>
    <ul>
      <li><code>GET /health</code> — 健康检查</li>
      <li><code>POST /retrieve</code> — 检索<br>
          body: <code>{{"question":"...", "top_k":5}}</code></li>
    </ul>
    """


@app.route("/health")
def health():
    return jsonify({
        "status": "ok",
        "collection": COLLECTION_NAME,
        "count": collection_count,
    })


@app.route("/retrieve", methods=["POST"])
def retrieve():
    data = request.get_json(silent=True) or {}
    question = (data.get("question") or "").strip()
    if not question:
        return jsonify({"error": "question 不能为空"}), 400

    top_k = data.get("top_k", SIMILARITY_TOP_K)
    try:
        top_k = int(top_k)
    except (TypeError, ValueError):
        top_k = SIMILARITY_TOP_K

    try:
        retriever = index.as_retriever(similarity_top_k=top_k)
        nodes = retriever.retrieve(question)
    except Exception as e:
        return jsonify({"error": f"检索失败: {e}"}), 500

    results = []
    for node in nodes:
        meta = node.metadata
        results.append({
            "file_name": meta.get("file_name", ""),
            "section": meta.get("section", ""),
            "score": round(node.score, 4),
            "text": node.text,
        })

    context = context_from_results(nodes)

    return jsonify({
        "results": results,
        "context": context,
    })


# ======================== 端口探测 ========================
def find_available_port(start_port):
    """从 start_port 开始依次尝试，返回第一个可用的端口"""
    for port in range(start_port, start_port + 10):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise RuntimeError(f"无可用端口 (从 {start_port} 起)")


# ======================== 入口 ========================
if __name__ == "__main__":
    print("=" * 50)
    print("RAG Retrieval Service — starting...")

    # 加载索引
    try:
        index, collection_count = load_index()
        print(f"[OK] Vector store loaded: {COLLECTION_NAME} ({collection_count} nodes)")
    except Exception as e:
        print(f"[FAIL] Vector store load failed: {e}")
        sys.exit(1)

    # 确定端口
    default_port = int(os.environ.get("RAG_PORT", 5050))
    port = find_available_port(default_port)
    if port != default_port:
        print(f"[WARN] Port {default_port} in use, switched to {port}")

    print(f"[OK] Listening at http://127.0.0.1:{port}")
    print("=" * 50)

    app.run(host="127.0.0.1", port=port, debug=False)
