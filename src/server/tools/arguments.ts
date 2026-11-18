/** The value following a named CLI option; absent options have no value. */
export function argumentValue(name: string, flags = process.argv.slice(2)): string | undefined {
  const index = flags.indexOf(name);
  return index >= 0 ? flags[index + 1] : undefined;
}
