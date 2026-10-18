export const GRADES = Array.from({ length: 12 }, (_, i) => i + 1)

export function gradeFromName(name: string): number | null {
  const prefix = /^\d+/.exec(name.trim())?.[0]
  const grade = prefix ? Number(prefix) : null
  return grade !== null && GRADES.includes(grade) ? grade : null
}

export function withGrade(name: string, grade: string): string {
  return `${grade}${name.trim().replace(/^\d+/, '')}`
}
