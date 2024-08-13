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
  TableObserver,
  $getNodeTriplet,
  $isTableRowNode,
  $computeTableMap,
  $isTableCellNode,
  $computeTableMapSkipCellCheck,
} from "@lexical/table";
import { useLexicalComposerContext } from "./LexicalComposerContext";
import {
  $createParagraphNode,
  $getNodeByKey,
  $isTextNode,
  $nodesOfType,
  COMMAND_PRIORITY_EDITOR,
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
import {
  $insertFirst,
  $insertNodeToNearestRoot,
  mergeRegister,
} from "@lexical/utils";

export function TablePlugin(props: {
  hasCellMerge?: boolean;
  hasCellBackgroundColor?: boolean;
  hasTabHandler?: boolean;
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
      mergeRegister(
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
        ),
        editor.registerNodeTransform(TableNode, (node) => {
          const [gridMap] = $computeTableMapSkipCellCheck(node, null, null);
          const maxRowLength = gridMap.reduce((curLength, row) => {
            return Math.max(curLength, row.length);
          }, 0);
          for (let i = 0; i < gridMap.length; ++i) {
            const rowLength = gridMap[i].length;
            if (rowLength === maxRowLength) {
              continue;
            }
            const lastCellMap = gridMap[i][rowLength - 1];
            const lastRowCell = lastCellMap.cell;
            for (let j = rowLength; j < maxRowLength; ++j) {
              // TODO: inherit header state from another header or body
              const newCell = $createTableCellNode(0);
              newCell.append($createParagraphNode());
              if (lastRowCell !== null) {
                lastRowCell.insertAfter(newCell);
              } else {
                $insertFirst(lastRowCell, newCell);
              }
            }
          }
        })
      )
    );
  });

  onMount(() => {
    const tableSelections = new Map<NodeKey, TableObserver>();

    const initializeTableNode = (tableNode: TableNode) => {
      const nodeKey = tableNode.getKey();
      const tableElement = editor.getElementByKey(
        nodeKey
      ) as HTMLTableElementWithWithTableSelectionState;
      if (tableElement && !tableSelections.has(nodeKey)) {
        const tableSelection = applyTableHandlers(
          tableNode,
          tableElement,
          editor,
          props.hasTabHandler ?? true
        );
        tableSelections.set(nodeKey, tableSelection);
      }
    };

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
      },
      { skipInitialization: true }
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
          const [, , gridNode] = $getNodeTriplet(node);
          const [gridMap] = $computeTableMap(gridNode, node, node);
          // TODO this function expects Tables to be normalized. Look into this once it exists
          const rowsCount = gridMap.length;
          const columnsCount = gridMap[0].length;
          let row = gridNode.getFirstChild();
          if (!$isTableRowNode(row)) {
            throw new Error("Expected TableNode first child to be a RowNode");
          }
          const unmerged = [];
          for (let i = 0; i < rowsCount; i++) {
            if (i !== 0) {
              row = row.getNextSibling();
              if (!$isTableRowNode(row)) {
                throw new Error(
                  "Expected TableNode first child to be a RowNode"
                );
              }
            }
            let lastRowCell: null | TableCellNode = null;
            for (let j = 0; j < columnsCount; j++) {
              const cellMap = gridMap[i][j];
              const cell = cellMap.cell;
              if (cellMap.startRow === i && cellMap.startColumn === j) {
                lastRowCell = cell;
                unmerged.push(cell);
              } else if (cell.getColSpan() > 1 || cell.getRowSpan() > 1) {
                if (!$isTableCellNode(cell)) {
                  throw new Error(
                    "Expected TableNode cell to be a TableCellNode"
                  );
                }
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
