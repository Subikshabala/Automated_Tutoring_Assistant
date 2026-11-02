import type { SeedCourse } from './types'

export const cybersecurity: SeedCourse = {
  slug: 'cybersecurity-essentials',
  title: 'Cybersecurity Essentials',
  description:
    'The threat models, controls and reasoning patterns behind defending real systems.',
  category: 'Security',
  difficulty: 'BEGINNER',
  estimatedHours: 10,
  modules: [
    {
      title: 'Security Foundations',
      description: 'The vocabulary and mental models every other topic builds on.',
      topics: [
        {
          title: 'Core Principles',
          description: 'What security is actually trying to preserve.',
          concepts: [
            {
              name: 'CIA Triad',
              definition:
                'Confidentiality, Integrity and Availability — the three properties security controls exist to preserve, often in tension with one another.',
              difficulty: 'BEGINNER',
              objectives: [
                'Classify a given incident by which property it violated',
                'Give an example where protecting one property degrades another',
              ],
            },
            {
              name: 'Threat Modeling',
              definition:
                'Systematically enumerating what can go wrong in a system by asking who the attacker is, what they want, and where the trust boundaries are.',
              difficulty: 'INTERMEDIATE',
              objectives: [
                'Identify trust boundaries in a simple web architecture',
                'Apply STRIDE to one component',
              ],
            },
            {
              name: 'Defense in Depth',
              definition:
                'Layering independent controls so that the failure of any single control does not result in compromise.',
              difficulty: 'BEGINNER',
              objectives: [
                'Explain why a single strong control is riskier than several weaker layers',
                'Identify the layers protecting a typical login flow',
              ],
            },
          ],
        },
        {
          title: 'Identity and Access',
          description: 'Proving who someone is, and bounding what they may do.',
          concepts: [
            {
              name: 'Authentication vs Authorization',
              definition:
                'Authentication establishes identity; authorization determines what that identity is permitted to do. They are separate decisions made at separate times.',
              difficulty: 'BEGINNER',
              objectives: [
                'Classify a given check as authn or authz',
                'Explain why authorization must be re-checked on every request',
              ],
            },
            {
              name: 'Principle of Least Privilege',
              definition:
                'Granting each identity the minimum permissions required for its function, for the minimum time necessary.',
              difficulty: 'BEGINNER',
              objectives: [
                'Spot an over-privileged service account',
                'Explain how least privilege limits blast radius',
              ],
            },
            {
              name: 'Zero Trust',
              definition:
                'An architecture that treats network location as conveying no trust, requiring explicit verification of every request regardless of origin.',
              difficulty: 'INTERMEDIATE',
              objectives: [
                'Contrast zero trust with perimeter security',
                'Describe what must be verified on an internal service call',
              ],
            },
          ],
        },
      ],
    },
    {
      title: 'Attacks and Defenses',
      description: 'How real systems get broken, and what actually stops it.',
      topics: [
        {
          title: 'Application Attacks',
          description: 'The injection and trust failures that dominate real breaches.',
          concepts: [
            {
              name: 'SQL Injection',
              definition:
                'An attack where untrusted input is concatenated into a SQL statement, allowing the attacker to alter the query structure the database executes.',
              difficulty: 'BEGINNER',
              objectives: [
                'Identify vulnerable string concatenation in query code',
                'Explain why parameterised queries fix it and escaping does not',
              ],
            },
            {
              name: 'Cross-Site Scripting',
              definition:
                'Injection of attacker-controlled script into a page, executing in a victim browser with that origin\u2019s privileges.',
              difficulty: 'INTERMEDIATE',
              objectives: [
                'Distinguish stored, reflected and DOM-based XSS',
                'Explain why output encoding must be context-aware',
              ],
            },
            {
              name: 'Cryptographic Hashing',
              definition:
                'A one-way function mapping arbitrary input to a fixed-size digest; password storage additionally requires a slow, salted function such as bcrypt or Argon2.',
              difficulty: 'INTERMEDIATE',
              objectives: [
                'Explain why fast hashes are wrong for passwords',
                'Describe what a salt prevents',
              ],
            },
          ],
        },
      ],
    },
  ],
  relationships: [
    { from: 'CIA Triad', to: 'Threat Modeling', type: 'PREREQUISITE_OF' },
    { from: 'CIA Triad', to: 'Defense in Depth', type: 'PREREQUISITE_OF' },
    { from: 'Threat Modeling', to: 'Zero Trust', type: 'LEADS_TO' },
    { from: 'Authentication vs Authorization', to: 'Principle of Least Privilege', type: 'PREREQUISITE_OF' },
    { from: 'Principle of Least Privilege', to: 'Zero Trust', type: 'PREREQUISITE_OF' },
    { from: 'Defense in Depth', to: 'Zero Trust', type: 'RELATED_TO' },
    { from: 'Threat Modeling', to: 'SQL Injection', type: 'LEADS_TO' },
    { from: 'SQL Injection', to: 'Cross-Site Scripting', type: 'RELATED_TO' },
    { from: 'Authentication vs Authorization', to: 'Cryptographic Hashing', type: 'RELATED_TO' },
  ],
}
