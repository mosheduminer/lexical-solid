import { useLexicalComposerContext } from "lexical-solid/LexicalComposerContext";
import { $getSelection, $isRangeSelection } from "lexical";
import { createEffect, JSX } from "solid-js";

type Props = Readonly<{
  scrollRef: () => HTMLElement;
}>;

export function AutoScrollPlugin({
  scrollRef,
}: Props): JSX.Element {
  const [editor] = useLexicalComposerContext();
  createEffect(() => {
    return editor.registerUpdateListener(({ tags, editorState }) => {
      const scrollElement = scrollRef();
      if (scrollElement === null || !tags.has("scroll-into-view")) {
        return;
      }

      const selection = editorState.read(() => $getSelection());
      if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
        return;
      }

      const anchorElement = editor.getElementByKey(selection.anchor.key);
      if (anchorElement === null) {
        return;
      }

      const scrollRect = scrollElement.getBoundingClientRect();
      const rect = anchorElement.getBoundingClientRect();
      if (rect.bottom > scrollRect.bottom) {
        anchorElement.scrollIntoView(false);
      } else if (rect.top < scrollRect.top) {
        anchorElement.scrollIntoView();
      }
    });
  });

  return null;
}
