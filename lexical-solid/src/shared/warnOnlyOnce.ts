import { DEV } from "solid-js";

export default function warnOnlyOnce(message: string): () => void {
  if (DEV) {
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
