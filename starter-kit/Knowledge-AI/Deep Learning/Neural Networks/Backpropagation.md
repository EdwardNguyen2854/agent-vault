# Backpropagation

The chain-rule algorithm that computes gradients of a loss with respect to every weight in a neural network. Combined with gradient descent, backpropagation is the learning algorithm for all modern neural networks.

## The Chain Rule

For a composite function `L(w) = loss(output(x, w), y)` where `output` is the network, backpropagation applies the chain rule:

```
∂L/∂w = (∂L/∂output) · (∂output/∂w)
```

For a network with L layers, gradients flow backward from the loss through each layer in reverse order — hence "backward propagation."

## Forward vs Backward Pass

**Forward pass**: compute and store all intermediate activations `h_1, h_2, ..., h_L` for a given input. These are needed for the backward pass.

**Backward pass**: starting from the loss gradient at the output, compute `∂L/∂h_l` for each layer going backward. Using the chain rule and the stored activations, compute weight gradients `∂L/∂W_l`.

## Computational Efficiency

Naively computing gradients would be exponentially slow. Backpropagation achieves linear efficiency by reusing shared sub-expressions: each partial derivative is computed once and cached. This is what makes training deep networks feasible.

## Gradient Descent Update

Once gradients are computed, weights are updated:

```
W := W - lr * ∂L/∂W
```

The learning rate `lr` controls step size. In practice, optimizers like Adam and AdamW adapt per-parameter learning rates, but the gradient computation itself is unchanged.

## Practical Considerations

**Vanishing gradients** — in very deep networks, gradients can shrink exponentially as they propagate backward, making early layers train very slowly. This is why activation functions like ReLU and normalization techniques like batch normalization matter.

**Exploding gradients** — gradients can also grow exponentially, causing unstable training. Gradient clipping (capping maximum gradient norm) is the standard mitigation.

**Autograd** — modern frameworks (PyTorch, JAX) automatically compute backpropagation via computational graphs and operator overloading. Manually deriving gradients is almost never necessary.
