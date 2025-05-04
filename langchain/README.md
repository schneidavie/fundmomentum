# 🧠 Fund Momentum – LangChain-Ready Dataset

This directory contains a LangChain-compatible JSONL file of fresh VC & PE funds from September 2024 to April 2025.

## 📦 What's Inside

- `fund_momentum_langchain_ready.jsonl` – structured fund dataset with text + metadata
- `ingest.py` – loads and embeds the JSONL into a FAISS vector store
- `query.py` – sample query interface for semantic fund discovery
- `requirements.txt` – dependencies (LangChain + OpenAI)

## 🔧 Setup

```bash
pip install -r requirements.txt
python ingest.py
python query.py
```

## 🧠 Example Query

```python
query = "Climate-focused funds in Germany raising now"
```

This will return the top-matching funds semantically.

## 🧬 Use With

- LangChain (FAISS / Chroma)
- LlamaIndex
- GPT Agents (LangGraph, CrewAI, etc.)
