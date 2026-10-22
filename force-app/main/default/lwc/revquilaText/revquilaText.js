/**
 * A count with its noun: countOf(1, "invoice") is "1 invoice", countOf(3, "invoice") is "3 invoices".
 * Pass the plural when adding an "s" is not enough.
 */
export function countOf(count, noun, plural = `${noun}s`) {
  return `${count} ${count === 1 ? noun : plural}`;
}