export type SeedConcept = {
  name: string
  definition: string
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
  objectives: string[]
}

export type SeedTopic = {
  title: string
  description: string
  concepts: SeedConcept[]
}

export type SeedModule = {
  title: string
  description: string
  topics: SeedTopic[]
}

export type SeedRelationship = {
  from: string
  to: string
  type: 'PREREQUISITE_OF' | 'RELATED_TO' | 'PART_OF' | 'LEADS_TO'
}

export type SeedCourse = {
  slug: string
  title: string
  description: string
  category: string
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
  estimatedHours: number
  modules: SeedModule[]
  relationships: SeedRelationship[]
}
