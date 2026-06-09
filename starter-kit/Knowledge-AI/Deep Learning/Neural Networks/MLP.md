# MLP

Multi-Layer Perceptron: stacks of fully connected (dense) layers with nonlinear activations. The simplest deep architecture and the fundamental building block for all other neural network types.

## Structure

Each layer in an MLP is fully connected: every input unit is connected to every output unit via a learnable weight. For a layer with `d_in` inputs and `d_out` outputs:

```
output = f(W · input + b)
```

Where `W` is a `(d_out, d_in)` weight matrix, `b` is a bias vector of length `d_out`, and `f` is a nonlinear activation function.

Stacking L layers: `h_0 = x`, `h_{l+1} = f_l(W_l · h_l + b_l)`, with the final layer producing the network output.

## Why MLPs Work

A single hidden layer with sufficiently many units can approximate any continuous function (universal approximation theorem). In practice, depth matters more than width: deep MLPs learn hierarchical representations that shallow ones cannot efficiently represent.

## Role in Deep Learning

MLPs appear everywhere as the final "head" of more specialized architectures:

- CNNs replace the early layers with convolutional layers, but often end with one or more MLP layers for classification
- Transformers use MLPs (the "feed-forward network" sub-layer) after each attention block
- Many modern architectures are described as "MLP-Mixer" variants that apply MLPs across spatial or channel dimensions

## Capacity and Parameters

For an MLP with layer sizes `[d_0, d_1, d_2, ..., d_L]`:

- Parameters in layer `l`: `d_l * d_{l-1}` weights + `d_l` biases = `d_l * (d_{l-1} + 1)`
- Total parameters grow quickly with width, which is why MLPs are sometimes replaced by more parameter-efficient alternatives in early layers

## Training

MLPs are trained with backpropagation and gradient descent. The same loss functions (cross-entropy, MSE) and optimizers (SGD, Adam, AdamW) used for other networks apply here. Dropout and weight decay are the standard regularization techniques.
