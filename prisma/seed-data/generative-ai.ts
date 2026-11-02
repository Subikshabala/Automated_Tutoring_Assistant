import type { SeedCourse } from './types'

export const generativeAi: SeedCourse = {
  slug: 'generative-ai',
  title: 'Generative AI Foundations',
  description:
    'Understand how modern language models represent text, generate it, and how to steer them reliably.',
  category: 'Artificial Intelligence',
  difficulty: 'BEGINNER',
  estimatedHours: 8,
  modules: [
    {
      title: 'How Language Models Work',
      description:
        'The mechanics underneath a chat response: tokens, embeddings, attention and sampling.',
      topics: [
        {
          title: 'Text Representation',
          description: 'How raw text becomes numbers a model can compute over.',
          concepts: [
            {
              name: 'Tokenization',
              definition:
                'The process of splitting raw text into tokens — subword units from a fixed vocabulary — so a model can map each piece to an integer id.',
              difficulty: 'BEGINNER',
              objectives: [
                'Explain why models operate on subwords rather than characters or whole words',
                'Predict roughly how many tokens a given English sentence produces',
                'Describe why token count, not word count, drives cost and context limits',
              ],
            },
            {
              name: 'Embeddings',
              definition:
                'Dense vector representations of tokens where geometric closeness encodes semantic similarity, learned during training.',
              difficulty: 'BEGINNER',
              objectives: [
                'Explain what it means for two embeddings to be close',
                'Distinguish a token embedding from a sentence embedding',
                'Describe why embeddings enable semantic search',
              ],
            },
            {
              name: 'Context Window',
              definition:
                'The maximum number of tokens a model can attend to in a single forward pass, covering both the prompt and the generated output.',
              difficulty: 'BEGINNER',
              objectives: [
                'Explain what happens when input exceeds the context window',
                'Describe why long conversations degrade without summarisation',
              ],
            },
          ],
        },
        {
          title: 'Generation Mechanics',
          description: 'How the next token is chosen, and how that choice is controlled.',
          concepts: [
            {
              name: 'Attention',
              definition:
                'A mechanism that lets each token weigh the relevance of every other token in the context when computing its own representation.',
              difficulty: 'INTERMEDIATE',
              objectives: [
                'Explain attention in terms of query, key and value',
                'Describe why attention cost grows quadratically with sequence length',
              ],
            },
            {
              name: 'Temperature and Sampling',
              definition:
                'Decoding parameters that reshape the next-token probability distribution, trading determinism against diversity.',
              difficulty: 'BEGINNER',
              objectives: [
                'Predict the effect of raising temperature from 0 to 1',
                'Choose a sampling setting appropriate to a given task',
                'Distinguish temperature from top-p',
              ],
            },
            {
              name: 'Hallucination',
              definition:
                'Fluent, confident model output that is not grounded in training data or provided context — a consequence of next-token prediction, not a bug.',
              difficulty: 'INTERMEDIATE',
              objectives: [
                'Explain why hallucination is structural rather than accidental',
                'Name two mitigation strategies and their limits',
              ],
            },
          ],
        },
      ],
    },
    {
      title: 'Working With Models',
      description: 'Practical control: prompting, structured output, and grounding.',
      topics: [
        {
          title: 'Prompt Engineering',
          description: 'Shaping inputs so outputs are reliable rather than lucky.',
          concepts: [
            {
              name: 'Zero-Shot and Few-Shot Prompting',
              definition:
                'Instructing a model with no worked examples (zero-shot) or with a handful of input-output demonstrations in the prompt (few-shot).',
              difficulty: 'BEGINNER',
              objectives: [
                'Decide when examples are worth their token cost',
                'Write a few-shot prompt with consistent formatting',
              ],
            },
            {
              name: 'Chain-of-Thought Prompting',
              definition:
                'Prompting a model to produce intermediate reasoning steps before its final answer, improving accuracy on multi-step problems.',
              difficulty: 'INTERMEDIATE',
              objectives: [
                'Identify task types where chain-of-thought helps',
                'Explain the latency and cost tradeoff',
              ],
            },
            {
              name: 'Structured Output',
              definition:
                'Constraining a model to emit a specific schema — typically JSON — so its response can be parsed and validated programmatically.',
              difficulty: 'INTERMEDIATE',
              objectives: [
                'Describe why free text is unsafe as an API boundary',
                'Explain why schema validation is still required after constrained decoding',
              ],
            },
          ],
        },
        {
          title: 'Grounding',
          description: 'Connecting a model to facts it was never trained on.',
          concepts: [
            {
              name: 'Retrieval-Augmented Generation',
              definition:
                'Retrieving relevant source passages at query time and placing them in the prompt so the model answers from provided evidence rather than memory.',
              difficulty: 'INTERMEDIATE',
              objectives: [
                'Describe the retrieve-then-generate pipeline',
                'Explain why RAG reduces but does not eliminate hallucination',
                'Identify when fine-tuning is the better tool',
              ],
            },
            {
              name: 'Semantic Search',
              definition:
                'Finding passages by embedding similarity rather than keyword overlap, so conceptually related text matches even without shared words.',
              difficulty: 'INTERMEDIATE',
              objectives: [
                'Contrast semantic search with keyword search',
                'Explain why chunk size affects retrieval quality',
              ],
            },
          ],
        },
      ],
    },
  ],
  relationships: [
    { from: 'Tokenization', to: 'Embeddings', type: 'PREREQUISITE_OF' },
    { from: 'Embeddings', to: 'Attention', type: 'PREREQUISITE_OF' },
    { from: 'Tokenization', to: 'Context Window', type: 'PREREQUISITE_OF' },
    { from: 'Attention', to: 'Temperature and Sampling', type: 'LEADS_TO' },
    { from: 'Temperature and Sampling', to: 'Hallucination', type: 'LEADS_TO' },
    { from: 'Zero-Shot and Few-Shot Prompting', to: 'Chain-of-Thought Prompting', type: 'PREREQUISITE_OF' },
    { from: 'Chain-of-Thought Prompting', to: 'Structured Output', type: 'RELATED_TO' },
    { from: 'Embeddings', to: 'Semantic Search', type: 'PREREQUISITE_OF' },
    { from: 'Semantic Search', to: 'Retrieval-Augmented Generation', type: 'PREREQUISITE_OF' },
    { from: 'Hallucination', to: 'Retrieval-Augmented Generation', type: 'LEADS_TO' },
    { from: 'Context Window', to: 'Retrieval-Augmented Generation', type: 'RELATED_TO' },
  ],
}
