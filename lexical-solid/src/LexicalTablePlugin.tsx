import {
  HTMLTableElementWithWithTableSelectionState,
  InsertTableCommandPayload,
  TableSelection,
  $createTableNodeWithDimensions,
  $isTableNode,
  applyTableHandlers,
  INSERT_TABLE_COMMAND,
  TableCellNode,
  TableNode,
  TableRowNode,
} from "@lexical/table";
import { useLexicalComposerContext } from "./LexicalComposerContext";
import {
  $createParagraphNode,
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  $isRootOrShadowRoot,
  $nodesOfType,
  COMMAND_PRIORITY_EDITOR,
  ElementNode,
  NodeKey,
} from "lexical";
import { onCleanup, onMount, JSX } from "solid-js";

export function TablePlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();

  onMount(() => {
    if (!editor.hasNodes([TableNode, TableCellNode, TableRowNode])) {
      throw Error(
        "TablePlugin: TableNode, TableCellNode or TableRowNode not registered on editor"
      );
    }

    onCleanup(
      editor.registerCommand<InsertTableCommandPayload>(
        INSERT_TABLE_COMMAND,
        ({ columns, rows, includeHeaders }) => {
          const selection = $getSelection();

          if (!$isRangeSelection(selection)) {
            return true;
          }

          const focus = selection.focus;
          const focusNode = focus.getNode();

          if (focusNode !== null) {
            const tableNode = $createTableNodeWithDimensions(
              Number(rows),
              Number(columns),
              includeHeaders
            );

            if ($isRootOrShadowRoot(focusNode)) {
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
      )
    );
  });

  onMount(() => {
    const tableSelections = new Map<NodeKey, TableSelection>();

    const initializeTableNode = (tableNode: TableNode) => {
      const nodeKey = tableNode.getKey();
      const tableElement = editor.getElementByKey(
        nodeKey
      ) as HTMLTableElementWithWithTableSelectionState;
      if (tableElement && !tableSelections.has(nodeKey)) {
        const tableSelection = applyTableHandlers(
          tableNode,
          tableElement,
          editor
        );
        tableSelections.set(nodeKey, tableSelection);
      }
    };

    // Plugins might be loaded _after_ initial content is set, hence existing table nodes
    // won't be initialized from mutation[create] listener. Instead doing it here,
    editor.getEditorState().read(() => {
      const tableNodes = $nodesOfType(TableNode);
      for (const tableNode of tableNodes) {
        if ($isTableNode(tableNode)) {
          initializeTableNode(tableNode);
        }
      }
    });

    const unregisterMutationListener = editor.registerMutationListener(
      TableNode,
      (nodeMutations) => {
        for (const [nodeKey, mutation] of nodeMutations) {
          if (mutation === "created") {
            editor.getEditorState().read(() => {
              const tableNode = $getNodeByKey<TableNode>(nodeKey);
              if ($isTableNode(tableNode)) {
                initializeTableNode(tableNode);
              }
            });
          } else if (mutation === "destroyed") {
            const tableSelection = tableSelections.get(nodeKey);

            if (tableSelection !== undefined) {
              tableSelection.removeListeners();
              tableSelections.delete(nodeKey);
            }
          }
        }
      }
    );

    onCleanup(() => {
      unregisterMutationListener();
      // Hook might be called multiple times so cleaning up tables listeners as well,
      // as it'll be reinitialized during recurring call
      for (const [, tableSelection] of tableSelections) {
        tableSelection.removeListeners();
      }
    });
  });

  return null;
}
