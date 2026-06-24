"""
build_index.py（最终整合版）
整合：路径前缀注入 + 增强噪声过滤 + 超长节点二次切分
"""
import os
import time
import re
from llama_index.core import SimpleDirectoryReader, Document
from llama_index.core.node_parser import MarkdownNodeParser, SentenceSplitter
from llama_index.embeddings.ollama import OllamaEmbedding
import chromadb

from config import (
    DOC_DIR, PERSIST_DIR, COLLECTION_NAME, EMBED_MODEL,
    MAX_NODE_LENGTH, CHUNK_SIZE, CHUNK_OVERLAP, BATCH_SIZE,
)

# ======================== 构建专属配置 ========================
# 如需覆盖共享配置中的值，在此处赋值即可

def print_node_stats(nodes, title="节点统计"):
    lengths = [len(n.text) for n in nodes]
    if not lengths:
        return
    print(f"\n--- {title} ---")
    print(f"总节点数: {len(nodes)}")
    print(f"文本长度: 最小 {min(lengths)} 字符, 最大 {max(lengths)} 字符, 平均 {sum(lengths)/len(lengths):.1f} 字符")
    bins = [0, 200, 500, 1000, 2000, 5000, 100000]
    for i in range(len(bins)-1):
        count = sum(1 for l in lengths if bins[i] <= l < bins[i+1])
        if count > 0:
            print(f"  [{bins[i]}, {bins[i+1]}): {count} 个节点")

def remove_noise_nodes(nodes):
    """
    删除无实质信息的节点：
    - 纯标题节点（只有标题，无正文）
    - 目录节点（正文仅为 [TOC] 或 [toc]）
    - YAML front matter 节点（或 YAML + 目录的组合）
    """
    filtered = []
    for node in nodes:
        body = re.sub(r'^#{1,6}\s+.*(?:\n|$)', '', node.text, flags=re.MULTILINE).strip()
        if not body:
            continue
        # 纯目录
        if re.fullmatch(r'\[toc\]', body, re.IGNORECASE):
            continue
        # YAML front matter（可能还跟着 [TOC] 等）
        if body.startswith('---'):
            rest = re.sub(r'^---.*?---', '', body, flags=re.DOTALL).strip()
            rest = re.sub(r'\[toc\]', '', rest, flags=re.IGNORECASE).strip()
            if not rest:
                continue
        filtered.append(node)
    return filtered

def inject_header_path(nodes):
    """在每个节点文本前注入层级路径，增强语义关联"""
    for node in nodes:
        path = node.metadata.get('header_path', '')
        if path:
            parts = [p.strip() for p in path.split('/') if p.strip()]
            breadcrumb = ' > '.join(parts)
            node.text = f"[{breadcrumb}]\n{node.text}"
    return nodes

def main():
    start_time = time.time()

    # 1. 加载文档
    print(f"[1/5] 正在从 {DOC_DIR} 加载文档...")
    raw_documents = SimpleDirectoryReader(DOC_DIR, recursive=True).load_data()
    print(f"     加载完成，共 {len(raw_documents)} 个文档。")
    documents = []
    for doc in raw_documents:
        new_text = doc.text.replace('&emsp;&emsp;', '')
        documents.append(Document(text=new_text, metadata=doc.metadata))
    print("     已移除 &emsp;&emsp; 缩进。")

    # 2. 切分
    print(f"\n[2/5] 使用 Markdown 标题层级切分...")
    parser = MarkdownNodeParser()
    nodes = parser.get_nodes_from_documents(documents)
    print(f"     初始切分得到 {len(nodes)} 个节点。")
    print_node_stats(nodes, "初始节点统计")

    # 噪声过滤
    nodes = remove_noise_nodes(nodes)
    print(f"     过滤噪声后剩余 {len(nodes)} 个节点。")

    # ★ 路径前缀注入
    nodes = inject_header_path(nodes)
    print(f"     已为每个节点注入层级路径。")

    print_node_stats(nodes, "过滤并注入后节点统计")

    # 超长二次切分
    if MAX_NODE_LENGTH is not None:
        print(f"\n[2.5/5] 超长节点二次切分...")
        splitter = SentenceSplitter(chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP)
        final_nodes = []
        for node in nodes:
            if len(node.text) > MAX_NODE_LENGTH:
                subs = splitter.get_nodes_from_documents([node])
                for sub in subs:
                    sub.metadata.update(node.metadata)
                final_nodes.extend(subs)
            else:
                final_nodes.append(node)
        nodes = final_nodes
        print_node_stats(nodes, "二次切分后")

    # 3. 嵌入模型
    print(f"\n[3/5] 初始化嵌入模型: {EMBED_MODEL}")
    embed_model = OllamaEmbedding(model_name=EMBED_MODEL, request_timeout=120.0)
    try:
        test_embed = embed_model.get_text_embedding("测试")
        print(f"     连接成功，嵌入维度: {len(test_embed)}")
    except Exception as e:
        print(f"     连接失败: {e}")
        return

    # 4. 准备 Chroma
    print(f"\n[4/5] 准备向量库: {PERSIST_DIR}")
    db = chromadb.PersistentClient(path=PERSIST_DIR)
    try:
        db.delete_collection(COLLECTION_NAME)
    except Exception:
        pass
    collection = db.create_collection(
        name=COLLECTION_NAME,
        embedding_function=None,
        metadata={"hnsw:space": "cosine"}
    )

    # 5. 逐批嵌入写入
    print(f"\n[5/5] 开始逐批嵌入写入...")
    total_nodes = len(nodes)
    embed_start = time.time()

    for batch_start in range(0, total_nodes, BATCH_SIZE):
        batch_end = min(batch_start + BATCH_SIZE, total_nodes)
        batch_nodes = nodes[batch_start:batch_end]
        batch_texts = [n.text for n in batch_nodes]

        try:
            batch_embeddings = embed_model.get_text_embedding_batch(batch_texts)
        except:
            batch_embeddings = [embed_model.get_text_embedding(t) for t in batch_texts]

        ids = [f"node_{i}" for i in range(batch_start, batch_end)]
        metadatas = [{"file_name": n.metadata.get("file_name", ""), "section": n.metadata.get("header_path", "")} for n in batch_nodes]
        collection.add(ids=ids, embeddings=batch_embeddings, documents=batch_texts, metadatas=metadatas)

        progress = min(100, int((batch_end / total_nodes) * 100))
        elapsed = time.time() - embed_start
        eta = (elapsed / batch_end) * (total_nodes - batch_end) if batch_end > 0 else 0
        print(f"     进度: {batch_end}/{total_nodes} ({progress}%) | 耗时: {elapsed:.0f}s | 剩余: {eta:.0f}s")

    print(f"     嵌入写入完成，总耗时 {time.time() - embed_start:.1f}s")
    count = collection.count()
    print(f"     向量库实际条目数: {count} {'✓' if count == total_nodes else '⚠️ 不符'}")
    print(f"\n索引构建成功！总耗时: {time.time() - start_time:.1f}s")

if __name__ == "__main__":
    main()