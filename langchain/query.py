from langchain.embeddings import OpenAIEmbeddings
from langchain.vectorstores import FAISS

db = FAISS.load_local("faiss_index", OpenAIEmbeddings())

query = input("🔎 What kind of fund are you looking for?\n> ")
results = db.similarity_search(query, k=5)

for r in results:
    print("🧠", r.metadata["id"])
    print(r.page_content)
    print("---")
