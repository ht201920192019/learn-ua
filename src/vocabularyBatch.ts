import type { Category, Level, Word } from './types'

// Compact data rows keep the topic and level shared without repeating them on every card.
export type VocabularyRow = [
  id: string, uk: string, pronunciation: string, zh: string, part: string,
  example: string, translation: string, abbreviation?: string, note?: string,
]

export function vocabularyBatch(category: Category, level: Level, rows: VocabularyRow[]): Word[] {
  return rows.map(([id, uk, pronunciation, zh, part, example, translation, abbreviation, note]) => ({
    id, uk, pronunciation, zh, category, level, part, example, translation, abbreviation, note,
  }))
}
