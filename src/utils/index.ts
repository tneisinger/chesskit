// Generate a short psuedo-random string of characters. Do not use this function for
// anything where strong randomness is important. Math.random() is not guaranteed to be
// truly random.
export function makeRandomString(): string {
  return Math.random().toString(36).slice(2);
}

// Do not use this function for anything where strong randomness is important.
// Math.random() is not guaranteed to be truly random.
export function getRandomInt(min: number, max: number): number {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getRandomIndex<T>(array: T[]): number | undefined {
  if (array.length < 1) return undefined;
  return getRandomInt(0, array.length - 1);
}

export function getRandom<T>(array: T[]): T | undefined {
  const i = getRandomIndex(array);
  if (i == undefined) return undefined;
  return array[i];
}

export function getKeyByValue<T>(obj: Record<string, T>, value: T): string | undefined {
  return Object.keys(obj).find((key) => obj[key] === value);
}

export function assertUnreachable(_x: never): never {
  throw new Error('The unreachable was reached');
}

export function capitalizeFirstLetter(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function average(array: number[]): number | undefined {
  if (array.length === 0) return undefined;
  return array.reduce((a, b) => a + b) / array.length;
}

export function partition<T>(
  array: T[],
  filter: (e: T, i?: number, a?: T[]) => boolean
): [T[], T[]] {
  const fails: T[] = [];
  const passes = array.filter((e, i, a) => {
    if (filter(e, i, a)) return true;
    fails.push(e);
  });

  return [passes, fails];
}

/**
 * Get the number of CPU cores on the client machine. If percentOfThreads given, return
 * the number of full threads that does not exceed the given percentage of threads
 * requested. Example if 4 threads available: getNumThreads(0.5) -> 2
 */
export function getNumThreads(percentOfThreads?: number): number {
  let numThreads = navigator.hardwareConcurrency;
  if (numThreads == undefined) numThreads = 1;
  if (numThreads === 1) return numThreads;
  if (percentOfThreads && percentOfThreads > 0 && percentOfThreads <= 1) {
    return Math.max(Math.floor(numThreads * percentOfThreads), 1);
  }
  return numThreads;
}

export function roundN(value: number, digits: number): number {
  const tenToN = 10 ** digits;
  return Math.round(value * tenToN) / tenToN;
}

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> =
  Pick<T, Exclude<keyof T, Keys>> & {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>
  }[Keys]

export type RequireOnlyOne<T, Keys extends keyof T = keyof T> =
  Pick<T, Exclude<keyof T, Keys>> & {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Record<Exclude<Keys, K>, undefined>>
  }[Keys]

export function pluralizeWord(num: number, singularWord: string, pluralWord?: string): string {
  if (num === 1) return singularWord;
  if (pluralWord != undefined) return pluralWord;
  return `${singularWord}s`;
}

export function hasDuplicates<T>(array: T[]): boolean {
  return (new Set(array)).size !== array.length;
}

export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() == today.getDate() &&
    date.getMonth() == today.getMonth() &&
    date.getFullYear() == today.getFullYear()
  );
}

export function daysBetween(d1: Date, d2: Date): number {
  const oneDayMs = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs((d1.getTime() - d2.getTime()) / oneDayMs));
}

export function hoursBetween(d1: Date, d2: Date): number {
  const oneHourMs = 60 * 60 * 1000;
  return Math.round(Math.abs((d1.getTime() - d2.getTime()) / oneHourMs));
}

export function deleteUndefinedPairs<T extends Record<string, any>>(t: T): undefined {
  (Object.keys(t) as (keyof T)[]).forEach((key) => {
    if (t[key] == undefined) delete t[key];
  })
  return;
}
