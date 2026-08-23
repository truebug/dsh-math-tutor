// 沪教版 2~5 年级数学知识点映射（MVP 占位，完整对照表见 docs/curriculum/math.md）
export interface KnowledgePoint {
  id: string
  grade: 2 | 3 | 4 | 5
  semester: 1 | 2
  title: string
  generator: string
}

export const knowledgePoints: KnowledgePoint[] = [
  { id: 'math.g2.add-sub-100', grade: 2, semester: 1, title: '100以内加减法', generator: 'generate_arithmetic' },
  { id: 'math.g2.mul-div-table', grade: 2, semester: 2, title: '表内乘除法', generator: 'generate_arithmetic' },
  { id: 'math.g2.mul-table', grade: 2, semester: 2, title: '九九乘法表', generator: 'generate_arithmetic' },
  { id: 'math.g3.div-table', grade: 3, semester: 1, title: '表内除法', generator: 'generate_arithmetic' },
  { id: 'math.g3.add-sub-1000', grade: 3, semester: 1, title: '1000以内加减法（多位数）', generator: 'generate_arithmetic' },
  { id: 'math.g4.decimal-add-sub', grade: 4, semester: 1, title: '小数加减法', generator: 'generate_arithmetic' },
]
