export function resolve<T>(t: T | (() => T)): T {
  if (typeof t === "function") {
    //@ts-ignore
    return t();
  } else {
    return t;
  }
}