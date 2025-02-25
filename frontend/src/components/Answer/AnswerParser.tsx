import { cloneDeep } from 'lodash'

import { AskResponse, Citation } from '../../api'

export type ParsedAnswer = {
  citations: Citation[]
  markdownFormatText: string,
  generated_chart: string | null
} | null

export const enumerateCitations = (citations: Citation[]) => {
  const filepathMap = new Map()
  for (const citation of citations) {
    const { filepath } = citation
    let part_i = 1
    if (filepathMap.has(filepath)) {
      part_i = filepathMap.get(filepath) + 1
    }
    filepathMap.set(filepath, part_i)
    citation.part_index = part_i
  }
  return citations
}

function preprocessText(text: string): string {
  // Format headers
  text = text.replace(/^###\s+([^\n]+)/gm, '<h3>$1</h3>');
  text = text.replace(/^####\s+([^\n]+)/gm, '<h4>$1</h4>');

  // Format definition blocks
  text = text.replace(/\*\*([^*]+)\*\*:\s*([^\n]+)/g, 
    '<div class="definitionBlock"><strong>$1:</strong> $2</div>');

  // Format example blocks
  text = text.replace(/^Example\s*\d*:\s*([^\n]+)/gm,
    '<div class="exampleBlock">$1</div>');

  // Format key points
  text = text.replace(/^Key\s*Point:\s*([^\n]+)/gm,
    '<div class="keyPoint">$1</div>');

  // Format lists
  text = text.replace(/^-\s+([^\n]+)/gm, '<div class="listItem">• $1</div>');

  // Format math blocks
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, 
    '<div class="mathBlock">\\[$1\\]</div>');

  // Format inline math
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, 
    '<span class="inlineMath">\\($1\\)</span>');

  return text;
}

export function parseAnswer(answer: AskResponse): ParsedAnswer {
  if (typeof answer.answer !== "string") return null
  let answerText = answer.answer

  // Preprocess text for formatting
  answerText = preprocessText(answerText);

  const citationLinks = answerText.match(/\[(doc\d\d?\d?)]/g)

  const lengthDocN = '[doc'.length

  let filteredCitations = [] as Citation[]
  let citationReindex = 0
  citationLinks?.forEach(link => {
    // Replacing the links/citations with number
    const citationIndex = link.slice(lengthDocN, link.length - 1)
    const citation = cloneDeep(answer.citations[Number(citationIndex) - 1]) as Citation
    if (!filteredCitations.find(c => c.id === citationIndex) && citation) {
      answerText = answerText.replaceAll(link, ` ^${++citationReindex}^ `)
      citation.id = citationIndex // original doc index to de-dupe
      citation.reindex_id = citationReindex.toString() // reindex from 1 for display
      filteredCitations.push(citation)
    }
  })

  filteredCitations = enumerateCitations(filteredCitations)

  // Add paragraph tags to text blocks
  answerText = answerText.replace(/([^\n]+)\n\n/g, '<p>$1</p>\n\n');

  return {
    citations: filteredCitations,
    markdownFormatText: answerText,
    generated_chart: answer.generated_chart
  }
}
