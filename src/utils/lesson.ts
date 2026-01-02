import type { Lesson } from "@/types/lesson";

export function sortLessonsByTitle(lessons: Lesson[]): void {
  lessons.sort((a, b) => {
    const stripArticles = (str: string) => {
      return str.replace(/^(the|a|an)\s+/i, '').trim();
    };
    const strippedA = stripArticles(a.title);
    const strippedB = stripArticles(b.title);
    return strippedA.localeCompare(strippedB);
  })
}
