import { useLexicalComposerContext } from "./LexicalComposerContext";
import {
  $createLinkNode,
  $isLinkNode,
  LinkNode,
  TOGGLE_LINK_COMMAND,
} from "@lexical/link";
import { onCleanup, onMount } from "solid-js";
import {
  $getSelection,
  $isElementNode,
  $setSelection,
  ElementNode,
  LexicalNode,
} from "lexical";
import { Class } from "utility-types";

const EditorPriority = 0;

function toggleLink(url: string) {
  const selection = $getSelection();

  if (selection !== null) {
    $setSelection(selection);
  }

  const sel = $getSelection();

  if (sel !== null) {
    const nodes = sel.extract();

    if (url === null) {
      // Remove LinkNodes
      nodes.forEach((node) => {
        const parent = node.getParent()!;

        if ($isLinkNode(parent)) {
          const children = parent.getChildren();

          for (let i = 0; i < children.length; i++) {
            parent.insertBefore(children[i]);
          }

          parent.remove();
        }
      });
    } else {
      // Add or merge LinkNodes
      if (nodes.length === 1) {
        const firstNode = nodes[0]; // if the first node is a LinkNode or if its
        // parent is a LinkNode, we update the URL.

        if ($isLinkNode(firstNode)) {
          (firstNode as unknown as LinkNode).setURL(url);
          return;
        } else {
          const parent = firstNode.getParent()!;

          if ($isLinkNode(parent)) {
            // set parent to be the current linkNode
            // so that other nodes in the same parent
            // aren't handled separately below.
            (parent as unknown as LinkNode).setURL(url);
            return;
          }
        }
      }

      let prevParent: LexicalNode | null = null;
      let linkNode: LexicalNode | null = null;
      nodes.forEach((node) => {
        const parent = node.getParent();

        if (
          parent === linkNode ||
          parent === null ||
          ($isElementNode(node) && !(node as ElementNode).isInline())
        ) {
          return;
        }

        if (!parent.is(prevParent)) {
          prevParent = parent;
          linkNode = $createLinkNode(url) as unknown as LexicalNode;

          if ($isLinkNode(parent)) {
            if (node.getPreviousSibling() === null) {
              parent.insertBefore(linkNode);
            } else {
              parent.insertAfter(linkNode);
            }
          } else {
            node.insertBefore(linkNode);
          }
        }

        if ($isLinkNode(node)) {
          if (linkNode !== null) {
            const children = (node as ElementNode).getChildren();

            for (let i = 0; i < children.length; i++) {
              (linkNode as ElementNode).append(children[i]);
            }
          }

          node.remove();
          return;
        }

        if (linkNode !== null) {
          (linkNode as ElementNode).append(node);
        }
      });
    }
  }
}

function LinkPlugin() {
  const [editor] = useLexicalComposerContext();
  onMount(() => {
    if (!editor.hasNodes([LinkNode] as unknown as Class<LexicalNode>[])) {
      throw new Error("LinkPlugin: LinkNode not registered on editor");
    }
  });
  onCleanup(editor.registerCommand(
    TOGGLE_LINK_COMMAND,
    (payload: string) => {
      const url = payload;
      toggleLink(url);
      return true;
    },
    EditorPriority
  ))
  return null;
}

export default LinkPlugin;
