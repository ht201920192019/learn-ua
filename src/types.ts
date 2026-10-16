export type Category = 'greetings' | 'daily' | 'food' | 'travel' | 'nature' | 'numbers' | 'work' | 'society' | 'energy' | 'storage'
export type Level = 'A1' | 'A2' | 'B1' | '行业'
export type Word = {
  id: string
  uk: string
  pronunciation: string
  zh: string
  category: Category
  level: Level
  part: string
  example: string
  translation: string
  abbreviation?: string
  note?: string
}
