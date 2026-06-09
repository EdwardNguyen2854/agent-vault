# Self-Attention

Attention where the queries, keys, and values all derive from the same sequence. Every token in the sequence attends to every other token — including those before and after it (in encoder self-attention). This lets each position aggregate information from the entire context.

## How It Works

```
Self-Attention(X) = Attention(XW^Q, XW^K, XW^V)
```

The same input sequence X is projected into Q, K, V spaces. Each position's query attends to all positions' keys, producing a weighted sum of all positions' values at each position.

## Relationship to Attention

Self-attention is a specific case of the general [[Deep Learning/Transformers/Attention|Attention]] mechanism where the source and target sequences are identical. The "vanilla" attention paper distinguished self-attention from cross-attention (attending to a different sequence), but both are instances of the same formula.

## Why Self-Attention

Compared to recurrence (RNNs, LSTMs):

- **Parallelizable** — all positions attend to all others in a single operation; no sequential dependency through time
- **Constant path length** — every position can directly attend to every other position in one step; RNNs have O(n) path length for long-range dependencies
- **Explicit weighted sums** — the attention weights are interpretable; RNN hidden states are opaque

The computational cost is O(n² · d) — quadratic in sequence length. This is the primary limitation for very long contexts.

## Masked Self-Attention

In decoder-only models, the output is generated autoregressively — token N cannot see tokens N+1 and beyond. Masked (causal) self-attention zeros out attention from future positions before the softmax:

```
Attention(Q, K, V) = softmax(M ∘ QK^T / √d_k) V
```

Where M is a lower-triangular mask (1 for allowed, -∞ for disallowed positions). This preserves the autoregressive property needed for next-token prediction.

## Role in Transformers

Every layer in a Transformer stack applies self-attention (multi-head). In encoder-only models (BERT), all layers are bidirectional self-attention. In decoder-only models (GPT), all layers are causal (masked) self-attention. In encoder-decoder models (T5), the encoder uses bidirectional attention and the decoder uses masked cross-attention to the encoder.
