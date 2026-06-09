# BERT

Bidirectional Encoder Representations from Transformers: a Transformer encoder pretrained with masked language modeling and next sentence prediction. Introduced by Google in 2018, BERT set new state-of-the-art on a wide range of NLP benchmarks and popularized the pretrain-finetune paradigm.

## Pretraining

BERT is trained on a large corpus with two objectives:

**Masked Language Modeling (MLM)** — randomly mask ~15% of input tokens and train the model to predict the original tokens. Unlike autoregressive models, BERT sees context on both sides of each mask, enabling true bidirectionality.

**Next Sentence Prediction (NSP)** — given two sentences A and B, predict whether B follows A in the original document. This helps with downstream tasks that require sentence-level reasoning (e.g., natural language inference, question answering).

## Architecture

BERT-Base: 12 layers ( Transformer encoders), 768 hidden dimensions, 12 attention heads, 110M parameters.

BERT-Large: 24 layers, 1024 hidden, 16 heads, 340M parameters.

Both use WordPiece tokenization with a 30,000 token vocabulary and learned positional encodings.

## Fine-tuning

Rather than training from scratch, BERT is pretrained on large unlabeled text, then finetuned with a small labeled dataset for the target task. The same model architecture is used for all tasks; only the output layer changes:

- **Classification** — add a classification head on the [CLS] token representation
- **NER** — add a token-level classifier on each token representation
- **Question answering** — predict start and end span from token representations
- **Natural language inference** — sentence pair classification

## Impact

BERT demonstrated that bidirectional context matters enormously for understanding tasks, and that large-scale pretraining followed by task-specific fine-tuning was the right recipe for NLP. It was quickly followed by RoBERTa (optimized training), ALBERT (parameter efficiency), DistilBERT (distillation), and many domain-specific variants (BioBERT, SciBERT, etc.).
