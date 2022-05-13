import type { TableSelection } from "@lexical/table";
import type { ElementNode, NodeKey } from "lexical";

import { useLexicalComposerContext } from "./LexicalComposerContext";
import {
  $createTableNodeWithDimensions,
  applyTableHandlers,
  INSERT_TABLE_COMMAND,
  TableCellNode,
  TableNode,
  TableRowNode,
} from "@lexical/table";
import {
  $createParagraphNode,
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  $isRootNode,
  COMMAND_PRIORITY_EDITOR,
} from "lexical";
import { JSX, onMount } from "solid-js";

export default function TablePlugin(): JSX.Element {
  const [editor] = useLexicalComposerContext();

  onMount(() => {
    if (!editor.hasNodes([TableNode, TableCellNode, TableRowNode])) {
      throw Error(
        "TablePlugin: TableNode, TableCellNode or TableRowNode not registered on editor"
      );
    }
    return editor.registerCommand<{
      rows: string;
      columns: string;
    }>(
      INSERT_TABLE_COMMAND,
      (payload) => {
        const { columns, rows } = payload;
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) {
          return true;
        }
        const focus = selection.focus;
        const focusNode = focus.getNode();

        if (focusNode !== null) {
          const tableNode = $createTableNodeWithDimensions(
            Number(rows),
            Number(columns)
          );
          if ($isRootNode(focusNode)) {
            const target = focusNode.getChildAtIndex(focus.offset);
            if (target !== null) {
              target.insertBefore(tableNode);
            } else {
              focusNode.append(tableNode);
            }
            tableNode.insertBefore($createParagraphNode());
          } else {
            const topLevelNode = focusNode.getTopLevelElementOrThrow();
            topLevelNode.insertAfter(tableNode);
          }
          tableNode.insertAfter($createParagraphNode());
          const firstCell = tableNode
            .getFirstChildOrThrow<ElementNode>()
            .getFirstChildOrThrow<ElementNode>();
          firstCell.select();
        }
        return true;
      },
      COMMAND_PRIORITY_EDITOR
    );
  });

  onMount(() => {
    const tableSelections = new Map<NodeKey, TableSelection>();

    return editor.registerMutationListener(TableNode, (nodeMutations) => {
      for (const [nodeKey, mutation] of nodeMutations) {
        if (mutation === "created") {
          editor.update(() => {
            const tableElement = editor.getElementByKey(nodeKey);
            const tableNode = $getNodeByKey(nodeKey) as TableNode;

            if (tableElement && tableNode) {
              const tableSelection = applyTableHandlers(
                tableNode,
                tableElement,
                editor
              );

              tableSelections.set(nodeKey, tableSelection);
            }
          });
        } else if (mutation === "destroyed") {
          const tableSelection = tableSelections.get(nodeKey);
          if (tableSelection) {
            tableSelection.removeListeners();
            tableSelections.delete(nodeKey);
          }
        }
      }
    });
  });

  return null;
}
