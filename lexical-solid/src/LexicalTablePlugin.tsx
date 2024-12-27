import {
  TableCellNode,
  setScrollableTablesActive,
  registerTablePlugin,
  registerTableSelectionObserver,
  registerTableCellUnmergeTransform,
} from "@lexical/table";
import { useLexicalComposerContext } from "./LexicalComposerContext";
import {
  onCleanup,
  onMount,
  JSX,
  mergeProps,
  createEffect,
  on,
} from "solid-js";

export interface TablePluginProps {
  /**
   * When `false` (default `true`), merged cell support (colspan and rowspan) will be disabled and all
   * tables will be forced into a regular grid with 1x1 table cells.
   */
  hasCellMerge?: boolean;
  /**
   * When `false` (default `true`), the background color of TableCellNode will always be removed.
   */
  hasCellBackgroundColor?: boolean;
  /**
   * When `true` (default `true`), the tab key can be used to navigate table cells.
   */
  hasTabHandler?: boolean;
  /**
   * When `true` (default `false`), tables will be wrapped in a `<div>` to enable horizontal scrolling
   */
  hasHorizontalScroll?: boolean;
}

/**
 * A plugin to enable all of the features of Lexical's TableNode.
 *
 * @param mergedProps - See type for documentation
 * @returns An element to render in your LexicalComposer
 */
export function TablePlugin(props: TablePluginProps): JSX.Element | null {
  const mergedProps = mergeProps(
    {
      hasCellMerge: true,
      hasCellBackgroundColor: true,
      hasHorizontalScroll: false,
    },
    props
  );
  const [editor] = useLexicalComposerContext();
  createEffect(() => {
    setScrollableTablesActive(editor, mergedProps.hasHorizontalScroll);
  });

  onMount(() => onCleanup(registerTablePlugin(editor)));

  createEffect(() =>
    onCleanup(registerTableSelectionObserver(editor, props.hasTabHandler))
  );

  // Unmerge cells when the feature isn't enabled
  createEffect(() => {
    if (!mergedProps.hasCellMerge) {
      onCleanup(registerTableCellUnmergeTransform(editor));
    }
  });

  // Remove cell background color when feature is disabled
  createEffect(
    on(
      () => [mergedProps.hasCellBackgroundColor, mergedProps.hasCellMerge],
      () => {
        if (mergedProps.hasCellBackgroundColor) {
          return;
        }
        onCleanup(
          editor.registerNodeTransform(TableCellNode, (node) => {
            if (node.getBackgroundColor() !== null) {
              node.setBackgroundColor(null);
            }
          })
        );
      }
    )
  );

  return null;
}
