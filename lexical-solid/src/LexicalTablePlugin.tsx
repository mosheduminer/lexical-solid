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
  $createTableCellNode,
} from "@lexical/table";
import { useLexicalComposerContext } from "./LexicalComposerContext";
import {
  $getNodeByKey,
  $isTextNode,
  $nodesOfType,
  COMMAND_PRIORITY_EDITOR,
  DEPRECATED_$computeGridMap,
  DEPRECATED_$getNodeTriplet,
  DEPRECATED_$isGridRowNode,
  DEPRECATED_GridCellNode,
  ElementNode,
  LexicalNode,
  NodeKey,
} from "lexical";
import {
  onCleanup,
  onMount,
  JSX,
  mergeProps,
  createEffect,
  on,
} from "solid-js";
import { $insertNodeToNearestRoot } from "@lexical/utils";

function $insertFirst(parent: ElementNode, node: LexicalNode): void {
  const firstChild = parent.getFirstChild();
  if (firstChild !== null) {
    firstChild.insertBefore(node);
  } else {
    parent.append(node);
  }
}

export function TablePlugin(props: {
  hasCellMerge?: boolean;
  hasCellBackgroundColor?: boolean;
}): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  props = mergeProps(
    { hasCellMerge: true, hasCellBackgroundColor: true },
    props
  );

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
          const tableNode = $createTableNodeWithDimensions(
            Number(rows),
            Number(columns),
            includeHeaders
          );
          $insertNodeToNearestRoot(tableNode);
          const firstDescendant = tableNode.getFirstDescendant();
          if ($isTextNode(firstDescendant)) {
            firstDescendant.select();
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

  // Unmerge cells when the feature isn't enabled
  createEffect(() => {
    if (props.hasCellMerge) {
      return;
    }
    onCleanup(
      editor.registerNodeTransform(TableCellNode, (node) => {
        if (node.getColSpan() > 1 || node.getRowSpan() > 1) {
          // When we have rowSpan we have to map the entire Table to understand where the new Cells
          // fit best; let's analyze all Cells at once to save us from further transform iterations
          const [, , gridNode] = DEPRECATED_$getNodeTriplet(node);
          const [gridMap] = DEPRECATED_$computeGridMap(gridNode, node, node);
          // TODO this function expects Tables to be normalized. Look into this once it exists
          const rowsCount = gridMap.length;
          const columnsCount = gridMap[0].length;
          let row = gridNode.getFirstChild();
          if (!DEPRECATED_$isGridRowNode(row)) {
            throw new Error("Expected TableNode first child to be a RowNode");
          }
          const unmerged = [];
          for (let i = 0; i < rowsCount; i++) {
            if (i !== 0) {
              row = row.getNextSibling();
              if (!DEPRECATED_$isGridRowNode(row)) {
                throw new Error(
                  "Expected TableNode first child to be a RowNode"
                );
              }
            }
            let lastRowCell: null | DEPRECATED_GridCellNode = null;
            for (let j = 0; j < columnsCount; j++) {
              const cellMap = gridMap[i][j];
              const cell = cellMap.cell;
              if (cellMap.startRow === i && cellMap.startColumn === j) {
                lastRowCell = cell;
                unmerged.push(cell);
              } else if (cell.getColSpan() > 1 || cell.getRowSpan() > 1) {
                const newCell = $createTableCellNode(cell.__headerState);
                if (lastRowCell !== null) {
                  lastRowCell.insertAfter(newCell);
                } else {
                  $insertFirst(row, newCell);
                }
              }
            }
          }
          for (const cell of unmerged) {
            cell.setColSpan(1);
            cell.setRowSpan(1);
          }
        }
      })
    );
  });

  // Remove cell background color when feature is disabled
  createEffect(
    on(
      () => [props.hasCellBackgroundColor, props.hasCellMerge],
      () => {
        if (props.hasCellBackgroundColor) {
          return;
        }
        return editor.registerNodeTransform(TableCellNode, (node) => {
          if (node.getBackgroundColor() !== null) {
            node.setBackgroundColor(null);
          }
        });
      }
    )
  );

  return null;
}
