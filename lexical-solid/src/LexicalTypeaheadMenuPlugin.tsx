import { useLexicalComposerContext } from "./LexicalComposerContext";
import {
  MenuRenderFn,
  MenuResolution,
  MenuTextMatch,
  TriggerFn,
  useMenuAnchorRef,
  LexicalMenu,
  MenuOption,
} from "./shared/LexicalMenu";
import {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  createCommand,
  LexicalCommand,
  LexicalEditor,
  RangeSelection,
  TextNode,
} from "lexical";
import {
  createEffect,
  on,
  createSignal,
  Show,
  JSX,
  startTransition,
  onCleanup,
  Accessor,
} from "solid-js";

export type QueryMatch = {
  leadOffset: number;
  matchingString: string;
  replaceableString: string;
};

export type Resolution = {
  match: QueryMatch;
  getRect: () => DOMRect;
};

export const PUNCTUATION =
  "\\.,\\+\\*\\?\\$\\@\\|#{}\\(\\)\\^\\-\\[\\]\\\\/!%'\"~=<>_:;";

const scrollIntoViewIfNeeded = (target: HTMLElement) => {
  const typeaheadContainerNode = document.getElementById("typeahead-menu");
  if (!typeaheadContainerNode) return;

  const typeaheadRect = typeaheadContainerNode.getBoundingClientRect();

  if (typeaheadRect.top + typeaheadRect.height > window.innerHeight) {
    typeaheadContainerNode.scrollIntoView({
      block: "center",
    });
  }

  if (typeaheadRect.top < 0) {
    typeaheadContainerNode.scrollIntoView({
      block: "center",
    });
  }

  target.scrollIntoView({ block: "nearest" });
};

function getTextUpToAnchor(selection: RangeSelection): string | null {
  const anchor = selection.anchor;
  if (anchor.type !== "text") {
    return null;
  }
  const anchorNode = anchor.getNode();
  if (!anchorNode.isSimpleText()) {
    return null;
  }
  const anchorOffset = anchor.offset;
  return anchorNode.getTextContent().slice(0, anchorOffset);
}

function tryToPositionRange(leadOffset: number, range: Range): boolean {
  const domSelection = window.getSelection();
  if (domSelection === null || !domSelection.isCollapsed) {
    return false;
  }
  const anchorNode = domSelection.anchorNode;
  const startOffset = leadOffset;
  const endOffset = domSelection.anchorOffset;

  if (anchorNode == null || endOffset == null) {
    return false;
  }

  try {
    range.setStart(anchorNode, startOffset);
    range.setEnd(anchorNode, endOffset);
  } catch (error) {
    return false;
  }

  return true;
}

function getQueryTextForSearch(editor: LexicalEditor): string | null {
  let text = null;
  editor.getEditorState().read(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) {
      return;
    }
    text = getTextUpToAnchor(selection);
  });
  return text;
}

function isSelectionOnEntityBoundary(
  editor: LexicalEditor,
  offset: number
): boolean {
  if (offset !== 0) {
    return false;
  }
  return editor.getEditorState().read(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      const anchor = selection.anchor;
      const anchorNode = anchor.getNode();
      const prevSibling = anchorNode.getPreviousSibling();
      return $isTextNode(prevSibling) && prevSibling.isTextEntity();
    }
    return false;
  });
}

// Got from https://stackoverflow.com/a/42543908/2013580
export function getScrollParent(
  element: HTMLElement,
  includeHidden: boolean
): HTMLElement | HTMLBodyElement {
  let style = getComputedStyle(element);
  const excludeStaticParent = style.position === "absolute";
  const overflowRegex = includeHidden
    ? /(auto|scroll|hidden)/
    : /(auto|scroll)/;
  if (style.position === "fixed") {
    return document.body;
  }
  for (
    let parent: HTMLElement | null = element;
    (parent = parent.parentElement);

  ) {
    style = getComputedStyle(parent);
    if (excludeStaticParent && style.position === "static") {
      continue;
    }
    if (
      overflowRegex.test(style.overflow + style.overflowY + style.overflowX)
    ) {
      return parent;
    }
  }
  return document.body;
}

function isTriggerVisibleInNearestScrollContainer(
  targetElement: HTMLElement,
  containerElement: HTMLElement
): boolean {
  const tRect = targetElement.getBoundingClientRect();
  const cRect = containerElement.getBoundingClientRect();
  return tRect.top > cRect.top && tRect.top < cRect.bottom;
}

// Reposition the menu on scroll, window resize, and element resize.
export function useDynamicPositioning(
  resolution: Accessor<MenuResolution | null>,
  targetElementAccessor: Accessor<HTMLElement | null>,
  onReposition: () => void,
  onVisibilityChange?: (isInView: boolean) => void
) {
  const [editor] = useLexicalComposerContext();
  createEffect(
    on(
      () => [targetElementAccessor(), resolution()],
      () => {
        const targetElement = targetElementAccessor();
        if (targetElement != null && resolution() != null) {
          const rootElement = editor.getRootElement();
          const rootScrollParent =
            rootElement != null
              ? getScrollParent(rootElement, false)
              : document.body;
          let ticking = false;
          let previousIsInView = isTriggerVisibleInNearestScrollContainer(
            targetElement,
            rootScrollParent
          );
          const handleScroll = function () {
            if (!ticking) {
              window.requestAnimationFrame(function () {
                onReposition();
                ticking = false;
              });
              ticking = true;
            }
            const isInView = isTriggerVisibleInNearestScrollContainer(
              targetElement,
              rootScrollParent
            );
            if (isInView !== previousIsInView) {
              previousIsInView = isInView;
              if (onVisibilityChange != null) {
                onVisibilityChange(isInView);
              }
            }
          };
          const resizeObserver = new ResizeObserver(onReposition);
          window.addEventListener("resize", onReposition);
          document.addEventListener("scroll", handleScroll, {
            capture: true,
            passive: true,
          });
          resizeObserver.observe(targetElement);
          return () => {
            resizeObserver.unobserve(targetElement);
            window.removeEventListener("resize", onReposition);
            document.removeEventListener("scroll", handleScroll);
          };
        }
      }
    )
  );
}

export const SCROLL_TYPEAHEAD_OPTION_INTO_VIEW_COMMAND: LexicalCommand<{
  index: number;
  option: MenuOption;
}> = createCommand("SCROLL_TYPEAHEAD_OPTION_INTO_VIEW_COMMAND");

export function useBasicTypeaheadTriggerMatch(
  trigger: string,
  { minLength = 1, maxLength = 75 }: { minLength?: number; maxLength?: number }
): TriggerFn {
  return (text: string) => {
    const validChars = "[^" + trigger + PUNCTUATION + "\\s]";
    const TypeaheadTriggerRegex = new RegExp(
      "(^|\\s|\\()(" +
        "[" +
        trigger +
        "]" +
        "((?:" +
        validChars +
        "){0," +
        maxLength +
        "})" +
        ")$"
    );
    const match = TypeaheadTriggerRegex.exec(text);
    if (match !== null) {
      const maybeLeadingWhitespace = match[1];
      const matchingString = match[3];
      if (matchingString.length >= minLength) {
        return {
          leadOffset: match.index + maybeLeadingWhitespace.length,
          matchingString,
          replaceableString: match[2],
        };
      }
    }
    return null;
  };
}

export type TypeaheadMenuPluginProps<TOption extends MenuOption> = {
  onQueryChange: (matchingString: string | null) => void;
  onSelectOption: (
    option: TOption,
    textNodeContainingQuery: TextNode | null,
    closeMenu: () => void,
    matchingString: string
  ) => void;
  options: Array<TOption>;
  menuRenderFn: MenuRenderFn<TOption>;
  triggerFn: TriggerFn;
  onOpen?: (resolution: MenuResolution) => void;
  onClose?: () => void;
  anchorClassName?: string;
};

export function LexicalTypeaheadMenuPlugin<TOption extends MenuOption>(
  props: TypeaheadMenuPluginProps<TOption>
): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [resolution, setResolution] = createSignal<MenuResolution | null>(null);
  const anchorElementRef = useMenuAnchorRef(
    resolution,
    setResolution,
    props.anchorClassName
  );

  const closeTypeahead = () => {
    setResolution(null);
    if (props.onClose != null && resolution() !== null) {
      props.onClose();
    }
  };

  const openTypeahead = (res: MenuResolution) => {
    setResolution(res);
    if (props.onOpen != null && resolution() === null) {
      props.onOpen(res);
    }
  };

  createEffect(
    on(resolution, () => {
      const updateListener = () => {
        editor.getEditorState().read(() => {
          const range = document.createRange();
          const selection = $getSelection();
          const text = getQueryTextForSearch(editor);

          if (
            !$isRangeSelection(selection) ||
            !selection.isCollapsed() ||
            text === null ||
            range === null
          ) {
            closeTypeahead();
            return;
          }

          const match = props.triggerFn(text, editor);
          props.onQueryChange(match ? match.matchingString : null);

          if (
            match !== null &&
            !isSelectionOnEntityBoundary(editor, match.leadOffset)
          ) {
            const isRangePositioned = tryToPositionRange(
              match.leadOffset,
              range
            );
            if (isRangePositioned !== null) {
              startTransition(() =>
                openTypeahead({
                  getRect: () => range.getBoundingClientRect(),
                  match,
                })
              );
              return;
            }
          }
          closeTypeahead();
        });
      };

      const removeUpdateListener =
        editor.registerUpdateListener(updateListener);

      onCleanup(() => {
        removeUpdateListener();
      });
    })
  );

  return (
    <Show when={resolution() !== null && editor !== null}>
      <LexicalMenu<TOption>
        close={closeTypeahead}
        resolution={resolution()!}
        editor={editor}
        anchorElementRef={anchorElementRef}
        options={props.options}
        menuRenderFn={props.menuRenderFn}
        onSelectOption={props.onSelectOption}
        shouldSplitNodeWithQuery={true}
      />
    </Show>
  );
}

export { MenuOption, MenuRenderFn, MenuResolution, MenuTextMatch, TriggerFn };
