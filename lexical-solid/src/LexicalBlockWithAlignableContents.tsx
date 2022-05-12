import type { ElementFormatType, NodeKey } from "lexical";

import { useLexicalComposerContext } from "./LexicalComposerContext";
import {
  $isDecoratorBlockNode,
  DecoratorBlockNode,
} from "./LexicalDecoratorBlockNode";
import useLexicalNodeSelection from "./useLexicalNodeSelection";
import {
  $getNearestBlockElementAncestorOrThrow,
  mergeRegister,
} from "@lexical/utils";
import {
  $getNodeByKey,
  $getSelection,
  $isDecoratorNode,
  $isNodeSelection,
  $isRangeSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  FORMAT_ELEMENT_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
} from "lexical";
import { JSX, onCleanup } from "solid-js";

type Props = Readonly<{
  children: JSX.Element;
  format: ElementFormatType | null;
  nodeKey: NodeKey;
}>;

export function BlockWithAlignableContents({
  children,
  format,
  nodeKey,
}: Props): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] =
    useLexicalNodeSelection(nodeKey);
  let ref!: HTMLDivElement;

  const onDelete = (payload: KeyboardEvent) => {
    if (isSelected() && $isNodeSelection($getSelection())) {
      const event = payload;
      event.preventDefault();
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isDecoratorNode(node) && node.isTopLevel()) {
          node.remove();
        }
        setSelected(false);
      });
    }
    return false;
  };

  onCleanup(
    mergeRegister(
      editor.registerCommand(
        FORMAT_ELEMENT_COMMAND,
        (payload: ElementFormatType) => {
          if (isSelected()) {
            const selection = $getSelection();
            if ($isNodeSelection(selection)) {
              const node = $getNodeByKey(nodeKey)!;
              if ($isDecoratorBlockNode(node)) {
                (node as DecoratorBlockNode).setFormat(payload);
              }
            } else if ($isRangeSelection(selection)) {
              const nodes = selection.getNodes();
              for (const node of nodes) {
                if ($isDecoratorBlockNode(node)) {
                  (node as DecoratorBlockNode).setFormat(payload);
                } else {
                  const element = $getNearestBlockElementAncestorOrThrow(node);
                  element.setFormat(payload);
                }
              }
            }
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        CLICK_COMMAND,
        (payload: MouseEvent) => {
          const event = payload;
          event.preventDefault();
          if (event.currentTarget === ref) {
            if (!event.shiftKey) {
              clearSelection();
            }
            setSelected(!isSelected);
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        KEY_DELETE_COMMAND,
        onDelete,
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        KEY_BACKSPACE_COMMAND,
        onDelete,
        COMMAND_PRIORITY_LOW
      )
    )
  );

  return (
    <div
      className={`embed-block${isSelected() ? " focused" : ""}`}
      ref={ref}
      style={{ textAlign: format }}
    >
      {children}
    </div>
  );
}
