const __DEV__ = true;

export default function warnOnlyOnce(message: string): () => void {
  if (__DEV__) {
    let run = false;
    return () => {
      if (!run) {
        console.warn(message);
      }
      run = true;
    };
  } else {
    return () => {};
  }
}
