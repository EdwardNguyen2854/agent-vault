# Neural Networks

The foundational architecture of deep learning: layers of weighted sums interleaved with nonlinear activation functions, trained by gradient descent via backpropagation. Every advanced architecture — CNNs, Transformers, LSTMs — is built from this same pattern.

## The Core Pattern

A neural network is a differentiable function composed of layers. Each layer applies a linear transformation (weight matrix multiply + bias) followed by a nonlinear activation function:

```
h_{l+1} = f(W_l · h_l + b_l)
```

Where `h_l` is the input vector (or matrix for a batch), `W_l` is the weight matrix, `b_l` is the bias, and `f` is the activation function. Stacking L such layers produces a deeply nested function that can represent extremely complex input-output mappings.

## Topics

- [[Deep Learning/Neural Networks/MLP|MLP]] — stacks of fully connected layers, the basic building block
- [[Deep Learning/Neural Networks/Backpropagation|Backpropagation]] — chain-rule gradient computation that makes learning possible
- [[Deep Learning/Neural Networks/Activation Functions|Activation Functions]] — nonlinearities that give networks expressive power

## Why Nonlinearity Matters

Without nonlinear activations, stacked linear layers collapse into a single linear transformation — no matter how deep. The nonlinearity is what lets networks approximate arbitrary functions. Common nonlinearities include ReLU, GELU, sigmoid, and tanh.

## Key Concepts

**Weights and biases** — the learnable parameters. In an MLP, each connection between input and output has a weight; each output has a bias term.

**Forward pass** — computing the output from a given input by propagating through all layers.

**Loss function** — a scalar measure of how wrong the network's predictions are. Cross-entropy for classification, MSE for regression.

**Gradient descent** — updating weights in the direction that reduces loss. The update rule: `W := W - lr * ∂L/∂W`.

**Backpropagation** — efficiently computing the gradient of the loss with respect to every weight using the chain rule.

## Training Loop

1. Forward pass: compute predictions
2. Compute loss against ground truth
3. Backward pass: compute gradients via backpropagation
4. Update weights with optimizer (SGD, Adam, AdamW)

## Regularization

Deep networks are prone to overfitting. Common techniques:

- **Dropout** — randomly zeroing activations during training
- **Weight decay (L2 regularization)** — penalizing large weights
- **Data augmentation** — expanding training diversity
- **Batch normalization** — stabilizing training by normalizing layer inputs
- **Early stopping** — halting before overfitting to training data
