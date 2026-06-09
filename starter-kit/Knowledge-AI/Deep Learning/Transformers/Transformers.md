# Transformers

Attention-based architectures that have become the dominant model family across modalities. Introduced in "Attention Is All You Need" (2017), Transformers replaced recurrence in sequence modeling with parallelizable self-attention, enabling efficient training on large-scale data.

## Core Architecture

A Transformer consists of an encoder-decoder structure, though many modern variants use only one side:

```
Input → [Positional Encoding] → Encoder Stack → Decoder Stack → Output
```

Each stack contains N identical layers. Each layer has:

- **Multi-head self-attention** — allowing every position to attend to every other position
- **Feed-forward MLP** — a pointwise nonlinearity applied after attention
- **Layer normalization** — stabilizing training
- **Residual connections** — enabling gradient flow through deep networks

## Positional Encoding

Since self-attention is permutation-invariant (it doesn't inherently respect token order), positional encodings inject sequence position information. Options include:

- **Sinusoidal** (original) — fixed sine/cosine waves at different frequencies
- **Learned** — a learned embedding added to each position
- **RoPE** (Rotary Position Embedding) — rotates query/key vectors by position-dependent angles; used in LLaMA, Mistral
- **ALiBi** — linearly biased attention scores based on distance; used in Bloom, MPT

## Encoder vs Decoder

**Encoder-only** (BERT) — bidirectional attention over the full input. Good for classification, extraction, embedding tasks. Cannot generate autoregressively.

**Decoder-only** (GPT) — causal (masked) attention preventing future token access. The standard for generation and instruction-following.

**Encoder-decoder** (original T5, BART) — encoder processes the input sequence bidirectionally; decoder attends to encoder output and generates autoregressively. Good for seq2seq tasks: translation, summarization, question answering.

## Scaling Laws

Transformers exhibit smooth power-law scaling: larger models with more parameters and training data consistently improve. This led to the foundation model paradigm — train once on large data, fine-tune for many tasks.

## Applications

- **Language**: GPT, BERT, T5, LLaMA, Claude, Gemini
- **Vision**: ViT (Vision Transformer), DINO, SAM
- **Multimodal**: CLIP, GPT-4V, Flamingo, Gemi
- **Audio**: Whisper, AudioLM, MusicLM
- **Video**: VideoTransformer, ActionTransformer
- **Code**: Codex, CodeLLaMA
