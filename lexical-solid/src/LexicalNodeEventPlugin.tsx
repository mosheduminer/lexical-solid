import { useLexicalComposerContext } from "./LexicalComposerContext";
import {
  type Klass,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
} from "lexical";
import { createEffect, on, onCleanup } from "solid-js";

export function NodeEventPlugin(props: {
  nodeType: Klass<LexicalNode>;
  eventType: string;
  eventListener: (
    event: Event,
    editor: LexicalEditor,
    nodeKey: NodeKey
  ) => void;
}): null {
  const [editor] = useLexicalComposerContext();
  let listenerRef = props.eventListener;

  createEffect(
    on(
      () => props.nodeType,
      () => {
        onCleanup(
          editor.registerMutationListener(props.nodeType, (mutations) => {
            const registedElements: WeakSet<HTMLElement> = new WeakSet();

            editor.getEditorState().read(() => {
              for (const [key, mutation] of mutations) {
                const element: null | HTMLElement = editor.getElementByKey(key);

                if (
                  // Updated might be a move, so that might mean a new DOM element
                  // is created. In this case, we need to add and event listener too.
                  (mutation === "created" || mutation === "updated") &&
                  element !== null &&
                  !registedElements.has(element)
                ) {
                  registedElements.add(element);
                  element.addEventListener(props.eventType, (event: Event) => {
                    listenerRef(event, editor, key);
                  });
                }
              }
            });
          })
        );
      }
    )
  );

  return null;
}
