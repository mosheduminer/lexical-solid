import type { LexicalEditor } from "lexical";
import {
  Accessor,
  createComponent,
  createMemo,
  createSignal,
  JSX,
  onCleanup,
  onMount,
} from "solid-js";
import { Portal } from "solid-js/web";

export default function useDecorators(
  editor: LexicalEditor
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

  onMount(() => setDecorators(editor.getDecorators<JSX.Element>()));

  // Return decorators defined as Solid Portals

  return createMemo(() => {
    const decoratedPortals = [];
    const decoratorKeys = Object.keys(decorators());

    for (let i = 0; i < decoratorKeys.length; i++) {
      const nodeKey = decoratorKeys[i];
      const decorator = decorators()[nodeKey];
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
