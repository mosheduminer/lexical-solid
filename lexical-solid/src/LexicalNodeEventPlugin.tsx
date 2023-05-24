import type { Klass, LexicalEditor, LexicalNode, NodeKey } from "lexical";

import { useLexicalComposerContext } from "./LexicalComposerContext";
import { $findMatchingParent } from "@lexical/utils";
import { $getNearestNodeFromDOMNode } from "lexical";
import { createEffect, untrack } from "solid-js";

const capturedEvents = new Set<string>(["mouseenter", "mouseleave"]);

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

  createEffect(() => {
    const eventType = untrack(() => props.eventType);
    const isCaptured = capturedEvents.has(eventType);

    const onEvent = (event: Event) => {
      editor.update(() => {
        const nearestNode = $getNearestNodeFromDOMNode(event.target as Element);
        if (nearestNode !== null) {
          const targetNode = isCaptured
            ? nearestNode instanceof props.nodeType
              ? nearestNode
              : null
            : $findMatchingParent(
                nearestNode,
                (node) => node instanceof props.nodeType
              );
          if (targetNode !== null) {
            props.eventListener(event, editor, targetNode.getKey());
            return;
          }
        }
      });
    };

    return editor.registerRootListener((rootElement, prevRootElement) => {
      if (rootElement) {
        rootElement.addEventListener(eventType, onEvent, isCaptured);
      }

      if (prevRootElement) {
        prevRootElement.removeEventListener(eventType, onEvent, isCaptured);
      }
    });
  });

  return null;
}
