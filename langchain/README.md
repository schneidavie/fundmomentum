# 🧠 Fund Momentum – LangChain AI Access

This directory provides LangChain-compatible tooling to search 140+ fresh VC & PE funds (2024–2025) via semantic queries.

## ✅ What's inside

- `fund_momentum_langchain_ready.jsonl` – JSONL with fund metadata and AI-formatted text
- `ingest.py` – Converts JSONL to FAISS vector index
- `query.py` – CLI to semantically search the fund list
- `requirements.txt` – LangChain + FAISS + OpenAI dependencies

## 🚀 How to Use

```bash
pip install -r requirements.txt
python ingest.py
python query.py
