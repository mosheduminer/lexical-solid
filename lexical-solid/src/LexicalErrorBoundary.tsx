import { ErrorBoundary, JSX } from "solid-js";

export type LexicalErrorBoundaryProps = {
  children: JSX.Element;
  onError: (err: any, reset: () => void) => JSX.Element;
};

export function LexicalErrorBoundary(
  props: LexicalErrorBoundaryProps
): JSX.Element {
  const defaultErrorFallback = () => (
    <div
      style={{
        border: "1px solid #f00",
        color: "#f00",
        padding: "8px",
      }}
    >
      An error was thrown.
    </div>
  );

  return (
    <ErrorBoundary fallback={props.onError || defaultErrorFallback}>
      {props.children}
    </ErrorBoundary>
  );
}
