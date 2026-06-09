# Deep Learning

Neural networks with many layers — the architecture family behind modern AI. Deep learning learns hierarchical representations directly from raw data, replacing hand-engineered features with learned ones. It has become the dominant approach for computer vision, natural language processing, speech recognition, and generative modeling.

## Core Idea

Shallow networks can only learn simple decision boundaries. Stacking many layers lets deep networks learn increasingly abstract feature hierarchies — edges and textures in early layers, object parts in middle layers, and full concepts in deep layers. This representation learning is what makes deep networks so general: the same architectural ideas apply across modalities.

## Sub-areas

- [[Deep Learning/Neural Networks/Neural Networks|Neural Networks]] — MLPs, backprop, activations
- [[Deep Learning/CNN/CNN|CNN]] — convolutional networks for spatial data
- [[Deep Learning/Transformers/Transformers|Transformers]] — attention-based architectures for sequences and beyond

## Key Themes

**Representation learning** — features are learned, not hand-crafted. A CNN trained on enough images discovers edge detectors, texture filters, and object shapes without being told what to look for.

**Scalability** — deeper networks and larger datasets consistently improve performance. This empirical observation (神经网络的缩放定律, scaling laws) drove the race to larger models and is why modern foundation models are so capable.

**End-to-end training** — rather than pipelines of separate stages, deep learning optimizes a single differentiable objective from raw input to final output.

**Transfer learning** — a model pretrained on large data can be fine-tuned on a smaller labeled dataset for a new task. This reduces data requirements dramatically and is the standard workflow in both vision and NLP.

## Relationship to Other Areas

Deep learning is the engine of modern machine learning. It subsumed most of what traditional computer vision and speech recognition did, and it redefined NLP after the [[Deep Learning/Transformers/Transformers|Transformer]] paper. [[Reinforcement Learning/Reinforcement Learning|Reinforcement learning]] uses deep networks as function approximators (deep RL). [[Generative AI/Generative AI|Generative AI]] builds on deep learning backbones for diffusion models and large language models.

## History

- 2012: AlexNet showed that GPU-trained CNNs dramatically outperformed competing approaches on ImageNet.
- 2014: [[Deep Learning/Transformers/Attention|Attention]] mechanisms and [[Deep Learning/Neural Networks/Neural Networks|Neural Networks|LSTMs]] improved sequence modeling.
- 2015-2016: [[Deep Learning/CNN/ResNet|ResNet]] enabled training of very deep networks through residual connections.
- 2017: The Transformer architecture (attention is all you need) became the foundation for modern NLP.
- 2018: BERT and GPT showed the power of large-scale pretraining.
- 2020-present: Scale — GPT-3, PaLM, GPT-4, and multimodal models like GPT-4V and Gemini demonstrated emergent capabilities at unprecedented scale.

## Practical Notes

- [[Deep Learning/Neural Networks/Neural Networks|MLPs]] are the building block; every architecture ultimately stacks variants of them.
- Backpropagation via gradient descent is the training algorithm, with SGD, Adam, and AdamW as common optimizers.
- Regularization matters enormously: dropout, weight decay, data augmentation, and early stopping.
- [[Deep Learning/CNN/CNN|CNNs]] exploit spatial structure; [[Deep Learning/Transformers/Transformers|Transformers]] exploit global context via attention.
