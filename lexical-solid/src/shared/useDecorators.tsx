import { LexicalEditor } from "lexical";
import {
  createMemo,
  createSignal,
  onMount,
  JSX,
  Component,
  Accessor,
  createComponent,
  Suspense,
  onCleanup,
} from "solid-js";
import { Portal } from "solid-js/web";

type ErrorBoundaryProps = {
  children: JSX.Element;
  onError: (err: any, reset: () => void) => JSX.Element;
};
export type ErrorBoundaryType = Component<ErrorBoundaryProps>;

export function useDecorators(
  editor: LexicalEditor,
  ErrorBoundary: ErrorBoundaryType
): Accessor<JSX.Element[]> {
  const [decorators, setDecorators] = createSignal<Record<string, JSX.Element>>(
    editor.getDecorators<JSX.Element>()
  );

  // Subscribe to changes
  onCleanup(
    editor.registerDecoratorListener<JSX.Element>((nextDecorators) => {
      setDecorators(nextDecorators);
    })
  );

  onMount(() => {
    // If the content editable mounts before the subscription is added, then
    // nothing will be rendered on initial pass. We can get around that by
    // ensuring that we set the value.
    setDecorators(editor.getDecorators<JSX.Element>());
  });

  // Return decorators defined as React Portals
  return createMemo(() => {
    const decoratedPortals = [];
    const decoratorKeys = Object.keys(decorators());

    for (let i = 0; i < decoratorKeys.length; i++) {
      const nodeKey = decoratorKeys[i];
      const decorator = (
        <ErrorBoundary
          onError={(error, reset) => editor._onError(error) as undefined}
        >
          <Suspense fallback={null}>{decorators()[nodeKey]}</Suspense>
        </ErrorBoundary>
      );
      const element = editor.getElementByKey(nodeKey);

      if (element !== null) {
        decoratedPortals.push(
          createComponent(Portal, { mount: element, children: decorator })
        );
      }
    }

    return decoratedPortals;
  });
}
