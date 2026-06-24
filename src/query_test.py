"""
query_test.py —— 调试与交互式检索
用法：
    python query_test.py
    然后输入问题，查看详细检索结果。输入 exit 退出。
"""
import os
from llama_index.core import VectorStoreIndex, Settings
from llama_index.embeddings.ollama import OllamaEmbedding
from llama_index.vector_stores.chroma import ChromaVectorStore
import chromadb

from config import PERSIST_DIR, COLLECTION_NAME, EMBED_MODEL, SIMILARITY_TOP_K

def load_index():
    if not os.path.exists(PERSIST_DIR):
        raise FileNotFoundError(f"向量库目录不存在：{PERSIST_DIR}")
    Settings.embed_model = OllamaEmbedding(model_name=EMBED_MODEL, request_timeout=120)
    db = chromadb.PersistentClient(path=PERSIST_DIR)
    chroma_collection = db.get_collection(
        name=COLLECTION_NAME,
        embedding_function=None
    )
    vector_store = ChromaVectorStore(chroma_collection=chroma_collection)
    index = VectorStoreIndex.from_vector_store(vector_store)
    return index

def main():
    print("正在加载向量库...")
    index = load_index()
    print(f"向量库加载成功（共 {index._vector_store._collection.count()} 条）。输入 'exit' 退出。\n")

    while True:
        try:
            question = input("请输入问题：").strip()
            if question.lower() in ("exit", "quit", "q"):
                break
            if not question:
                continue

            print("检索中...\n")
            retriever = index.as_retriever(similarity_top_k=SIMILARITY_TOP_K)
            nodes = retriever.retrieve(question)

            print(f"最相关的 {len(nodes)} 个片段：")
            for i, node in enumerate(nodes, 1):
                meta = node.metadata
                print(f"\n{'─'*50}")
                print(f"[{i}] 文件: {meta.get('file_name', '未知')}")
                print(f"    章节: {meta.get('section', '未知')}")
                print(f"    相关度: {node.score:.4f}")
                print(f"    内容:\n{node.text}")
            print(f"\n{'='*50}\n")

        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"出错: {e}")

if __name__ == "__main__":
    main()