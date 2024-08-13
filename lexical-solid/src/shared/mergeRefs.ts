export function mergeRefs<T>(
  ...refs: Array<(arg: T) => void | undefined | null>
): (arg: T) => void {
  return (value) => {
    refs.forEach((ref) => ref(value));
  };
}
