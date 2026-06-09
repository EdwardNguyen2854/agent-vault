# GPT

Generative Pre-Trained Transformer: a stack of Transformer decoder layers trained with next-token prediction (causal language modeling). The architecture behind modern large language models, evolving from GPT-1 (2018) through GPT-4.

## From GPT-1 to GPT-4

**GPT-1** (2018) — showed that pretraining a Transformer decoder on diverse text and finetuning on specific tasks could achieve strong results with minimal architecture changes.

**GPT-2** (2019) — scaled to 1.5B parameters, demonstrating that language models trained on large web data could perform many tasks without explicit supervision (zero-shot). Its size and capability were controversial enough that OpenAI initially declined to release the full model.

**GPT-3** (2020) — scaled to 175B parameters, showing that few-shot and zero-shot capabilities emerged at scale. GPT-3 could solve new tasks from natural language instructions and examples without any gradient updates.

**GPT-4** (2023) — multimodal (vision + language), improved reasoning, safety RLHF training. Architecture details not released.

**GPT-4o / o1 / o3** — rapid iteration: GPT-4o for real-time voice, o1 for reasoning, o3 for advanced reasoning.

## Architecture

GPT uses a decoder-only Transformer:

- Causal (masked) self-attention — each token attends only to previous tokens
- Layer norm and residual connections around each sublayer
- Learned positional encodings (GPT-2 onward; GPT-1 used learned, GPT-3+ use sparse/rotary)
- Large vocabularies (50K-100K tokens) with Byte Pair Encoding tokenization

## Pretraining Objective

Next-token prediction: given a sequence of tokens `t_1, t_2, ..., t_n`, predict `t_{n+1}` from `t_1...t_n`. The model is trained to maximize the log probability of the correct next token at each position.

This simple objective, applied at massive scale to diverse text, produces a model that implicitly learns to reason, translate, summarize, and code — skills that emerge from the training data without explicit supervision.

## Key Techniques

**Instruction finetuning** — finetuning on curated (instruction, response) pairs to improve zero-shot generalization (LLM benchmark performance).

**RLHF** (Reinforcement Learning from Human Feedback) — training a reward model from human preferences, then fine-tuning the language model to maximize that reward. Used in GPT-3.5+, GPT-4, and most modern chat models.

**Constitutional AI / AI safety** — techniques for aligning model behavior with human values through rule-based reward signals and red-teaming.
