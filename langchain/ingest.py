from langchain.schema import Document
from langchain.embeddings import OpenAIEmbeddings
from langchain.vectorstores import FAISS
import json

with open("fund_momentum_langchain_ready.jsonl") as f:
    data = [json.loads(line) for line in f]

docs = [
    Document(
        page_content=entry["text"],
        metadata={"id": entry["id"], **entry["metadata"]}
    )
    for entry in data
]

db = FAISS.from_documents(docs, OpenAIEmbeddings())
db.save_local("faiss_index")
print("✅ FAISS index created and saved.")
