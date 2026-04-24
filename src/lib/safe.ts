export async function safe<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try {
    return [null, await p];
  } catch (e) {
    return [e instanceof Error ? e : new Error(String(e)), null];
  }
}
