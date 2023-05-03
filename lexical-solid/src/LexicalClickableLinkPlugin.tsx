import { $isLinkNode } from "@lexical/link";
import { useLexicalComposerContext } from "./LexicalComposerContext";
import { $findMatchingParent, isHTMLAnchorElement } from "@lexical/utils";
import {
  $getNearestNodeFromDOMNode,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  getNearestEditorFromDOMNode,
} from "lexical";
import { createEffect, mergeProps, onCleanup } from "solid-js";

function domGetParent(
  node: Node,
  predicate: (predicateNode: Node) => boolean
): null | Node {
  let parent = node.parentNode;
  while (parent != null) {
    if (predicate(parent)) {
      return parent;
    }
    parent = parent.parentNode;
  }
  return null;
}

export function LexicalClickableLinkPlugin(props: {
  newTab?: boolean;
}): null {
  const [editor] = useLexicalComposerContext();
  props = mergeProps({ newTab: true }, props);

  createEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      const nearestEditor = getNearestEditorFromDOMNode(target);

      if (nearestEditor === null) {
        return;
      }

      let url = null;
      let urlTarget = null;
      nearestEditor.update(() => {
        const clickedNode = $getNearestNodeFromDOMNode(target);
        if (clickedNode !== null) {
          const maybeLinkNode = $findMatchingParent(
            clickedNode,
            $isElementNode
          );
          if ($isLinkNode(maybeLinkNode)) {
            url = maybeLinkNode.getURL();
            urlTarget = maybeLinkNode.getTarget();
          } else {
            const a = (
              isHTMLAnchorElement(target)
                ? target
                : domGetParent(target, isHTMLAnchorElement)
            ) as HTMLAnchorElement;
            url = a.href;
            urlTarget = a.target;
          }
        }
      });

      if (url === null || url === "") {
        return;
      }

      // Allow user to select link text without follwing url
      const selection = editor.getEditorState().read($getSelection);
      if ($isRangeSelection(selection) && !selection.isCollapsed()) {
        event.preventDefault();
        return;
      }

      const isMiddle = event.type === "auxclick" && event.button === 1;
      window.open(
        url,
        props.newTab ||
          isMiddle ||
          event.metaKey ||
          event.ctrlKey ||
          urlTarget === "_blank"
          ? "_blank"
          : "_self"
      );
      event.preventDefault();
    };

    const onMouseUp = (event: MouseEvent) => {
      if (event.button === 1 && editor.isEditable()) {
        onClick(event);
      }
    };

    onCleanup(
      editor.registerRootListener((rootElement, prevRootElement) => {
        if (prevRootElement !== null) {
          prevRootElement.removeEventListener("click", onClick);
          prevRootElement.removeEventListener("mouseup", onMouseUp);
        }
        if (rootElement !== null) {
          rootElement.addEventListener("click", onClick);
          rootElement.addEventListener("mouseup", onMouseUp);
        }
      })
    );
  });

  return null;
}
