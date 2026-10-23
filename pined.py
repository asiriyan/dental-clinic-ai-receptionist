"""
Upload a .txt file into a Pinecone index (chunk -> embed -> upsert), and test with a query.

Install:
    pip install pinecone openai google-genai python-dotenv

.env file (same folder):
    PINECONE_API_KEY=your_key
    PINECONE_INDEX=dental-clinic
    EMBED_PROVIDER=openai          # or: google
    OPENAI_API_KEY=your_key        # needed if EMBED_PROVIDER=openai
    GOOGLE_API_KEY=your_key        # needed if EMBED_PROVIDER=google

Usage:
    python upload_txt_to_pinecone.py clinic_info.txt
    python upload_txt_to_pinecone.py clinic_info.txt --namespace dental
    python upload_txt_to_pinecone.py --query "What are your opening hours?"

IMPORTANT: use the SAME embedding provider/model for uploading and for searching
(for example in your n8n workflow). Mixing models gives bad or failed results.
"""

import argparse
import math
import os
import re
import sys
import time

from dotenv import load_dotenv
from pinecone import Pinecone, ServerlessSpec
load_dotenv()

# ---------- Config ----------
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
INDEX_NAME = os.getenv("PINECONE_INDEX", "dad")
PROVIDER = os.getenv("EMBED_PROVIDER", "openai").lower()

DIMENSION = 3072  # index dimension; both providers below are set to output this size
OPENAI_MODEL = "text-embedding-3-small"  # 1536 dims
GOOGLE_MODEL = "gemini-embedding-001"    # we request 1536 dims

CHUNK_SIZE = 1000      # characters per chunk
CHUNK_OVERLAP = 150    # characters shared between neighbouring chunks
EMBED_BATCH = 50
UPSERT_BATCH = 100


# ---------- Chunking ----------
def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping chunks, preferring paragraph/sentence boundaries."""
    text = re.sub(r"\r\n?", "\n", text).strip()
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        if end < len(text):
            window = text[start:end]
            # try to cut at paragraph, then sentence, then space
            cut = max(window.rfind("\n\n"), window.rfind(". "), window.rfind("\n"))
            if cut < size * 0.5:
                cut = window.rfind(" ")
            if cut > size * 0.5:
                end = start + cut + 1
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)
    return chunks


# ---------- Embeddings ----------
def _normalize(vec: list[float]) -> list[float]:
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def embed_texts(texts: list[str], is_query: bool = False) -> list[list[float]]:
    if PROVIDER == "openai":
        from openai import OpenAI

        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        res = client.embeddings.create(model=OPENAI_MODEL, input=texts)
        return [d.embedding for d in res.data]

    if PROVIDER == "google":
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
        res = client.models.embed_content(
            model=GOOGLE_MODEL,
            contents=texts,
            config=types.EmbedContentConfig(
                task_type="RETRIEVAL_QUERY" if is_query else "RETRIEVAL_DOCUMENT",
                output_dimensionality=DIMENSION,
            ),
        )
        # truncated Gemini embeddings should be normalized
        return [_normalize(e.values) for e in res.embeddings]

    raise ValueError("EMBED_PROVIDER must be 'openai' or 'google'")


# ---------- Pinecone ----------
def get_index(pc: Pinecone):
    existing = [i["name"] for i in pc.list_indexes()]
    if INDEX_NAME not in existing:
        print(f"Creating index '{INDEX_NAME}' ({DIMENSION} dims)...")
        pc.create_index(
            name=INDEX_NAME,
            dimension=DIMENSION,
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region="us-east-1"),
        )
        while not pc.describe_index(INDEX_NAME).status["ready"]:
            time.sleep(1)
    return pc.Index(INDEX_NAME)


def upload_file(path: str, namespace: str) -> None:
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()

    chunks = chunk_text(text)
    if not chunks:
        sys.exit("The file is empty.")
    print(f"Split into {len(chunks)} chunks.")

    pc = Pinecone(api_key=PINECONE_API_KEY)
    index = get_index(pc)

    source = os.path.basename(path)
    vectors = []

    for i in range(0, len(chunks), EMBED_BATCH):
        batch = chunks[i : i + EMBED_BATCH]
        embeddings = embed_texts(batch)
        for j, (chunk, emb) in enumerate(zip(batch, embeddings)):
            n = i + j
            vectors.append(
                {
                    "id": f"{source}-{n}",  # re-uploading the same file overwrites its chunks
                    "values": emb,
                    "metadata": {"text": chunk, "source": source, "chunk": n},
                }
            )
        print(f"Embedded {min(i + EMBED_BATCH, len(chunks))}/{len(chunks)}")

    for i in range(0, len(vectors), UPSERT_BATCH):
        index.upsert(vectors=vectors[i : i + UPSERT_BATCH], namespace=namespace)
    print(f"Done. Uploaded {len(vectors)} vectors to '{INDEX_NAME}' (namespace: '{namespace or 'default'}').")


def query(question: str, namespace: str, top_k: int = 3) -> None:
    pc = Pinecone(api_key=PINECONE_API_KEY)
    index = pc.Index(INDEX_NAME)
    emb = embed_texts([question], is_query=True)[0]
    res = index.query(vector=emb, top_k=top_k, include_metadata=True, namespace=namespace)
    for m in res["matches"]:
        print(f"\nscore={m['score']:.3f}  source={m['metadata'].get('source')}  chunk={m['metadata'].get('chunk')}")
        print(m["metadata"].get("text"))


# ---------- CLI ----------
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Upload a .txt file to Pinecone")
    parser.add_argument("file", nargs="?", help="path to the .txt file")
    parser.add_argument("--namespace", default="", help="Pinecone namespace (optional)")
    parser.add_argument("--query", help="test search instead of uploading")
    args = parser.parse_args()

    if not PINECONE_API_KEY:
        sys.exit("Missing PINECONE_API_KEY in .env")

    if args.query:
        query(args.query, args.namespace)
    elif args.file:
        upload_file(args.file, args.namespace)
    else:
        parser.print_help()