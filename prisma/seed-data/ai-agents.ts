import type { SeedCourse } from './types'

export const aiAgents: SeedCourse = {
  slug: 'ai-agents',
  title: 'Building AI Agents',
  description:
    'Move from single prompts to systems that plan, call tools, remember, and recover from failure.',
  category: 'Artificial Intelligence',
  difficulty: 'INTERMEDIATE',
  estimatedHours: 12,
  modules: [
    {
      title: 'Agent Architecture',
      description: 'The loop, the tools, and the state that make an agent more than a prompt.',
      topics: [
        {
          title: 'The Agent Loop',
          description: 'Perceive, decide, act, observe — repeat until done.',
          concepts: [
            {
              name: 'ReAct Pattern',
              definition:
                'An agent loop that interleaves explicit reasoning traces with tool actions, feeding each observation back into the next reasoning step.',
              difficulty: 'INTERMEDIATE',
              objectives: [
                'Trace one full reason-act-observe cycle',
                'Explain why observations must re-enter the context',
              ],
            },
            {
              name: 'Tool Calling',
              definition:
                'Exposing typed functions to a model so it can request their execution with structured arguments, with results returned into the conversation.',
              difficulty: 'INTERMEDIATE',
              objectives: [
                'Write a tool schema a model can reliably target',
                'Explain why tool arguments must be validated before execution',
              ],
            },
            {
              name: 'Agent Memory',
              definition:
                'State an agent carries across steps or sessions — short-term scratchpad, long-term retrievable facts, or episodic interaction history.',
              difficulty: 'INTERMEDIATE',
              objectives: [
                'Distinguish short-term from long-term memory',
                'Explain why unbounded history breaks the context window',
              ],
            },
          ],
        },
        {
          title: 'Planning and Control',
          description: 'Decomposing goals and keeping the loop from running away.',
          concepts: [
            {
              name: 'Task Decomposition',
              definition:
                'Breaking a goal into ordered subtasks the agent can verify individually, rather than attempting the whole goal in one step.',
              difficulty: 'INTERMEDIATE',
              objectives: [
                'Decompose a vague goal into verifiable subtasks',
                'Explain why each subtask needs its own success check',
              ],
            },
            {
              name: 'Reflection',
              definition:
                'An agent evaluating its own output against the goal and revising before producing a final answer.',
              difficulty: 'ADVANCED',
              objectives: [
                'Describe a self-critique step',
                'Explain when reflection stops paying for itself',
              ],
            },
            {
              name: 'Guardrails',
              definition:
                'Hard constraints outside the model — step limits, cost caps, allowed-tool lists, output validators — that bound agent behaviour deterministically.',
              difficulty: 'INTERMEDIATE',
              objectives: [
                'Name three failure modes guardrails prevent',
                'Explain why prompt instructions are not guardrails',
              ],
            },
          ],
        },
      ],
    },
    {
      title: 'Multi-Agent Systems',
      description: 'When one agent is not the right shape for the problem.',
      topics: [
        {
          title: 'Coordination',
          description: 'Splitting work across specialised agents without chaos.',
          concepts: [
            {
              name: 'Orchestrator-Worker Pattern',
              definition:
                'A coordinating agent that decomposes a goal, dispatches subtasks to specialised worker agents, and reconciles their results.',
              difficulty: 'ADVANCED',
              objectives: [
                'Identify work that benefits from parallel workers',
                'Explain why workers need non-overlapping scope',
              ],
            },
            {
              name: 'Agent Handoff',
              definition:
                'Transferring control and the necessary context from one agent to another so the receiving agent can continue without the full history.',
              difficulty: 'ADVANCED',
              objectives: [
                'Decide what context must survive a handoff',
                'Explain the cost of over-transferring context',
              ],
            },
          ],
        },
      ],
    },
  ],
  relationships: [
    { from: 'ReAct Pattern', to: 'Tool Calling', type: 'PREREQUISITE_OF' },
    { from: 'Tool Calling', to: 'Agent Memory', type: 'RELATED_TO' },
    { from: 'ReAct Pattern', to: 'Task Decomposition', type: 'LEADS_TO' },
    { from: 'Task Decomposition', to: 'Reflection', type: 'LEADS_TO' },
    { from: 'Tool Calling', to: 'Guardrails', type: 'PREREQUISITE_OF' },
    { from: 'Agent Memory', to: 'Agent Handoff', type: 'PREREQUISITE_OF' },
    { from: 'Task Decomposition', to: 'Orchestrator-Worker Pattern', type: 'PREREQUISITE_OF' },
    { from: 'Orchestrator-Worker Pattern', to: 'Agent Handoff', type: 'LEADS_TO' },
    { from: 'Guardrails', to: 'Orchestrator-Worker Pattern', type: 'RELATED_TO' },
  ],
}
