"""
项目共享配置文件 — 所有 Python 脚本的统一配置入口
"""
import os

# ======================== 路径配置 ========================
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOC_DIR = os.path.join(PROJECT_ROOT, "raw-docs", "input")
PERSIST_DIR = os.path.join(PROJECT_ROOT, "database", "vector")

# ======================== Chroma 向量库 ========================
COLLECTION_NAME = "smps_knowledge"

# ======================== Ollama 嵌入模型 ========================
EMBED_MODEL = "qwen3-embedding:8b"

# ======================== 检索默认参数 ========================
SIMILARITY_TOP_K = 5

# ======================== 文档切分配置 ========================
MAX_NODE_LENGTH = 1200
CHUNK_SIZE = 800
CHUNK_OVERLAP = 100

# ======================== 嵌入写入 ========================
BATCH_SIZE = 10
