# Attention

A general mechanism for dynamically weighting the importance of different parts of the input when computing an output. The query attends to key-value pairs with learned, content-dependent weights. The core operation underlying Transformers and most modern sequence models.

## Attention Function

Given queries Q, keys K, and values V, the attention output is a weighted sum of values:

```
Attention(Q, K, V) = softmax(QK^T / √d_k) V
```

The softmax produces a probability distribution over key-value pairs for each query. The scaling by √d_k (sqrt of key dimension) prevents softmax saturation in high dimensions.

## Query, Key, Value

- **Query** — what am I looking for? The representation of the current token seeking information.
- **Key** — what do I contain? Used to compute similarity with queries.
- **Value** — what information do I have? Used to construct the output when attended to.

The dot product `QK^T` measures compatibility: high dot product means the query finds that key relevant.

## Multi-Head Attention

Rather than computing a single attention function, multi-head attention runs several attention operations in parallel with learned linear projections:

```
MultiHead(Q, K, V) = Concat(head_1, ..., head_h) W^O
where head_i = Attention(QW_i^Q, KW_i^K, VW_i^V)
```

Each head can learn different relational patterns. For example, one head might attend to syntactic dependencies, another to semantic similarity. The outputs are concatenated and projected.

Typical configuration: `h = 8` heads, `d_model = 512`, so each head operates on `d_k = d_v = 64` dimensions.

## Variants

**Scaled dot-product attention** — the standard, as described above.

**Cross-attention** — queries come from one sequence, keys/values from another. Used in encoder-decoder Transformers (decoder attends to encoder output) and in multimodal models (e.g., vision encoder attends to language queries).

**Flash Attention** — a memory-efficient implementation that avoids materializing the full N×N attention matrix, enabling training on very long sequences.
