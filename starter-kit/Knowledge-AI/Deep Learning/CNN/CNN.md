# CNN

Convolutional Neural Networks: specialized neural networks that exploit spatial structure in their inputs. Through weight sharing via learnable filters, CNNs efficiently process grid-like data such as images, video frames, and audio spectrograms.

## Core Concepts

**Convolutional layer** — applies a set of learnable filters (kernels) across the input. Each filter slides across the spatial dimensions, computing a weighted sum at each position. The output is a feature map that encodes where and how the filter's pattern appears.

**Filters** — small matrices (e.g., 3×3 or 5×5) with learnable weights. A filter might learn to detect edges, textures, or more abstract patterns depending on the layer depth.

**Stride** — the step size when sliding the filter. Stride 1 moves one pixel at a time; stride 2 downsamples by a factor of 2.

**Padding** — adding border pixels (typically zeros) around the input. Same-padding preserves spatial dimensions; valid-padding reduces them.

**Pooling** — spatial downsampling (max pooling or average pooling) that makes features spatially invariant and reduces computation.

**Channel** — each filter produces one output channel. Early layers have few channels; later layers have many (e.g., 256, 512).

## Why CNNs Work for Images

Images have strong spatial correlations: nearby pixels are related. A filter detecting a horizontal edge at one location can detect it anywhere — the same weights apply across the entire image. This weight sharing makes CNNs vastly more parameter-efficient than fully connected layers for spatial data.

Layer progression in a typical image CNN:

1. Early layers: edges, colors, textures
2. Middle layers: object parts (eyes, wheels, text)
3. Deep layers: full objects and scenes

## Architectures

- **LeNet** (1998) — early MNIST digit recognition
- **AlexNet** (2012) — GPU-trained, ReLU, dropout; showed deep CNNs could win ImageNet
- **VGG** (2014) — deep stacks of 3×3 convolutions; simple but memory-intensive
- **GoogLeNet** (2014) — inception modules with parallel multi-scale convolutions
- **[[Deep Learning/CNN/ResNet|ResNet]]** (2015) — residual connections enabled 100+ layer networks to train
- **EfficientNet** (2019) — compound scaling of depth, width, and resolution

## Modern Use

CNN architectures (especially ResNet and its variants) remain standard backbones for:

- Object detection (e.g., Faster R-CNN, YOLO use CNN backbones)
- Semantic segmentation (e.g., U-Net uses encoder-decoder CNN structure)
- Medical imaging, satellite imagery, and any structured grid data
