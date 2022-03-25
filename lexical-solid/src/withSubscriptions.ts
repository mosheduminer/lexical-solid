type UnsubscribeFn = () => void;
export default function withSubscriptions(
  ...unsubscribe: Array<UnsubscribeFn>
): () => void {
  return () => {
    unsubscribe.forEach(f => f());
  };
};
