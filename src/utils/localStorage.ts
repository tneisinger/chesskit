import { Mode } from '@/types/lesson';

function getOpeningModeStorageKey(lessonTitle: string): string {
  return `opening-${lessonTitle}-mode`;
}

export function saveOpeningModeToLocalStorage(lessonTitle: string, mode: Mode): void {
  // Only save Practice and Learn modes
  if (mode !== Mode.Practice && mode !== Mode.Learn) return;

  try {
    const key = getOpeningModeStorageKey(lessonTitle);
    localStorage.setItem(key, mode);
  } catch (error) {
    console.error('Failed to save mode to localStorage:', error);
  }
}

export function loadOpeningModeFromLocalStorage(lessonTitle: string): Mode | null {
  try {
    const key = getOpeningModeStorageKey(lessonTitle);
    const savedMode = localStorage.getItem(key);

    // Validate that the saved mode is either Practice or Learn
    if (savedMode === Mode.Practice || savedMode === Mode.Learn) {
      return savedMode;
    }
    return null;
  } catch (error) {
    console.error('Failed to load mode from localStorage:', error);
    return null;
  }
}

