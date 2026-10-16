/** Verplaatst één ding in een lijst naar een andere plek. */
export function moveInList<T>(list: T[], from: number, to: number): T[] {
  if (from === to) return list;
  if (from < 0 || to < 0 || from >= list.length || to >= list.length) return list;

  const copy = list.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}
