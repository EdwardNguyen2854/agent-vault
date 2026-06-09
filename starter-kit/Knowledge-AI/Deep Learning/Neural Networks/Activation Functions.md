# Activation Functions

Nonlinear functions applied element-wise after each linear transformation. Without nonlinear activations, stacked linear layers collapse into a single linear operation regardless of depth. Each activation shapes gradient flow, expressivity, and training stability differently.

## Common Activations

**ReLU** — `f(x) = max(0, x)`

- Simple and efficient: zeroing negative values is computationally cheap
- Sparse activation (some neurons output zero)
- Suffering from dying ReLU problem: neurons that output zero for all inputs stop learning
- Most common default choice for hidden layers

**Leaky ReLU** — `f(x) = x if x > 0 else αx` (typically α = 0.01)

- Fixes dying ReLU by allowing small negative gradients
- Still simple and efficient

**GELU** (Gaussian Error Linear Unit) — `f(x) = x · Φ(x)` where Φ is the standard Gaussian CDF

- Used in BERT, GPT, and most modern Transformers
- Approximates a probabilistic switch: information is gated by a learned probability
- Computationally more expensive than ReLU but standard in attention-based models

**SwiGLU** — `f(x) = Swish(x) · GELU(x) = (x · σ(x)) · GELU(x)`

- Used in LLaMA and PaLM architectures
- Combines the gating properties of Swish with GELU's smooth behavior
- More parameters (two weight matrices) per MLP layer

**Sigmoid** — `f(x) = 1 / (1 + e^{-x})`

- Outputs in (0, 1), useful for binary probabilities
- Saturated gradients (close to 0 for very negative or very positive inputs) cause vanishing gradients
- Rarely used in hidden layers; still used for output heads in binary classification

**Tanh** — `f(x) = (e^x - e^{-x}) / (e^x + e^{-x})`

- Outputs in (-1, 1), zero-centered
- Still saturates, but zero-centered property helps vs sigmoid
- Historically common in LSTMs and RNNs; largely replaced by ReLU/GELU in feed-forward networks

## Choosing an Activation

- **Hidden layers in MLPs/CNNs**: ReLU is the safe default; GELU for Transformers
- **Output layer**: sigmoid for binary classification, softmax for multi-class, linear for regression
- **LSTM/GRU gates**: typically tanh for cell state, sigmoid for gates (this is architectural, not a choice)

## Gradient Flow

The derivative of the activation affects how gradients propagate during backpropagation:

- Sigmoid and tanh saturate, producing small gradients for large inputs — causes vanishing
- ReLU has gradient 1 for positive inputs, 0 for negative — can cause dying neurons
- GELU is smooth everywhere with moderate gradients — good for training stability
