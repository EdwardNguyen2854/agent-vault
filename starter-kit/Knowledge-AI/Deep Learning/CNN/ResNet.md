# ResNet

Residual Network: a convolutional architecture introduced by He et al. (2015) that enabled the successful training of very deep networks through identity skip connections. A landmark model for image recognition and the backbone for countless later vision systems.

## The Residual Connection

The key innovation is the skip (shortcut) connection that adds the input of a block directly to its output:

```
output = F(x) + x
```

Where `F(x)` is the learned residual mapping and `x` is the original input. This means the network only needs to learn the residual — the difference between the desired output and the input. If the identity mapping were optimal, the network could easily push the residual to zero.

## Why Skip Connections Matter

Very deep networks suffer from degradation: as depth increases, accuracy saturates and then degrades. This is not caused by overfitting (training error increases too), but by the difficulty of learning identity mappings through many nonlinear layers.

Skip connections let gradients flow directly backward through the network, mitigating vanishing gradients. They also create a computational "highway" that makes it easy for information to propagate through many layers.

## Architecture

ResNet consists of residual blocks stacked in groups (stages). Each stage doubles the channels while halving spatial dimensions. A typical ResNet-50 has 50 layers across 4 stages with 3, 4, 6, and 3 residual blocks respectively.

Residual blocks use bottleneck design: 1×1 convolutions reduce channels before the expensive 3×3 convolution, then 1×1 convolutions restore the channel count.

## Variants

- **ResNet-18, 34** — smaller variants for lower-compute settings
- **ResNet-50** — the standard variant, good balance of accuracy and cost
- **ResNet-101, 152** — deeper variants for maximum accuracy
- **ResNeXt** — adds grouped convolutions inside the residual block
- **Wide ResNet** — increases channel width rather than depth

## Legacy

ResNet's skip connection design became a universal pattern, adopted in:

- Transformers (layer norm + attention + residual)
- U-Net and most encoder-decoder architectures
- Diffusion models (U-Net with skip connections)
- Modern vision transformers still use residual-style connections
