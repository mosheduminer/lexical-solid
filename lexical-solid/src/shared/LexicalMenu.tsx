import { useLexicalComposerContext } from "../LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  createCommand,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_TAB_COMMAND,
  LexicalCommand,
  LexicalEditor,
  TextNode,
} from "lexical";
import {
  Accessor,
  createEffect,
  createMemo,
  createSignal,
  JSX,
  on,
  onCleanup,
  untrack,
} from "solid-js";

export type MenuTextMatch = {
  leadOffset: number;
  matchingString: string;
  replaceableString: string;
};

export type MenuResolution = {
  match?: MenuTextMatch;
  getRect: () => DOMRect;
};

export const PUNCTUATION =
  "\\.,\\+\\*\\?\\$\\@\\|#{}\\(\\)\\^\\-\\[\\]\\\\/!%'\"~=<>_:;";

export type MutableRefObject<T> = { current: T };

export class MenuOption {
  key: string;
  ref?: MutableRefObject<HTMLElement | null>;

  constructor(key: string) {
    this.key = key;
    this.ref = { current: null };
    this.setRefElement = this.setRefElement.bind(this);
  }

  setRefElement(element: HTMLElement | null) {
    this.ref = { current: element };
  }
}

export type MenuRenderFn<TOption extends MenuOption> = (
  anchorElementRef: MutableRefObject<HTMLElement | null | undefined>,
  itemProps: {
    selectedIndex: Accessor<number | null>;
    selectOptionAndCleanUp: (option: TOption) => void;
    setHighlightedIndex: (index: number) => void;
    options: Array<TOption>;
  },
  matchingString: string | null
) => JSX.Element;

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

/**
 * Walk backwards along user input and forward through entity title to try
 * and replace more of the user's text with entity.
 */
function getFullMatchOffset(
  documentText: string,
  entryText: string,
  offset: number
): number {
  let triggerOffset = offset;
  for (let i = triggerOffset; i <= entryText.length; i++) {
    if (documentText.substr(-i) === entryText.substr(0, i)) {
      triggerOffset = i;
    }
  }
  return triggerOffset;
}

/**
 * Split Lexical TextNode and return a new TextNode only containing matched text.
 * Common use cases include: removing the node, replacing with a new node.
 */
function $splitNodeContainingQuery(match: MenuTextMatch): TextNode | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
    return null;
  }
  const anchor = selection.anchor;
  if (anchor.type !== "text") {
    return null;
  }
  const anchorNode = anchor.getNode();
  if (!anchorNode.isSimpleText()) {
    return null;
  }
  const selectionOffset = anchor.offset;
  const textContent = anchorNode.getTextContent().slice(0, selectionOffset);
  const characterOffset = match.replaceableString.length;
  const queryOffset = getFullMatchOffset(
    textContent,
    match.matchingString,
    characterOffset
  );
  const startOffset = selectionOffset - queryOffset;
  if (startOffset < 0) {
    return null;
  }
  let newNode;
  if (startOffset === 0) {
    [newNode] = anchorNode.splitText(selectionOffset);
  } else {
    [, newNode] = anchorNode.splitText(startOffset, selectionOffset);
  }

  return newNode;
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
  targetElement: HTMLElement | null,
  onReposition: () => void,
  onVisibilityChange?: (isInView: boolean) => void
) {
  const [editor] = useLexicalComposerContext();
  createEffect(() => {
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
      onCleanup(() => {
        resizeObserver.unobserve(targetElement);
        window.removeEventListener("resize", onReposition);
        document.removeEventListener("scroll", handleScroll);
      });
    }
  });
}

export const SCROLL_TYPEAHEAD_OPTION_INTO_VIEW_COMMAND: LexicalCommand<{
  index: number;
  option: MenuOption;
}> = createCommand("SCROLL_TYPEAHEAD_OPTION_INTO_VIEW_COMMAND");

export function LexicalMenu<TOption extends MenuOption>(props: {
  close: () => void;
  editor: LexicalEditor;
  anchorElementRef: MutableRefObject<HTMLElement>;
  resolution: MenuResolution;
  options: Array<TOption>;
  shouldSplitNodeWithQuery?: boolean;
  menuRenderFn: MenuRenderFn<TOption>;
  onSelectOption: (
    option: TOption,
    textNodeContainingQuery: TextNode | null,
    closeMenu: () => void,
    matchingString: string
  ) => void;
}): JSX.Element | null {
  const [selectedIndex, setHighlightedIndex] = createSignal<null | number>(
    null
  );

  createEffect(
    on(
      () => props.resolution.match && props.resolution.match.matchingString,
      () => {
        setHighlightedIndex(0);
      }
    )
  );

  const selectOptionAndCleanUp = (selectedEntry: TOption) => {
    props.editor.update(() => {
      const textNodeContainingQuery =
        props.resolution.match != null && props.shouldSplitNodeWithQuery
          ? $splitNodeContainingQuery(props.resolution.match)
          : null;

      props.onSelectOption(
        selectedEntry,
        textNodeContainingQuery,
        props.close,
        props.resolution.match ? props.resolution.match.matchingString : ""
      );
    });
  };

  const updateSelectedIndex = (index: number) => {
    const rootElem = props.editor.getRootElement();
    if (rootElem !== null) {
      rootElem.setAttribute("aria-activedescendant", "typeahead-item-" + index);
      setHighlightedIndex(index);
    }
  };

  createEffect(() => {
    onCleanup(() => {
      const rootElem = props.editor.getRootElement();
      if (rootElem !== null) {
        rootElem.removeAttribute("aria-activedescendant");
      }
    });
  });

  createEffect(() => {
    if (props.options === null) {
      setHighlightedIndex(null);
    } else if (selectedIndex === null) {
      updateSelectedIndex(0);
    }
  });

  createEffect(() => {
    onCleanup(() =>
      mergeRegister(
        props.editor.registerCommand(
          SCROLL_TYPEAHEAD_OPTION_INTO_VIEW_COMMAND,
          ({ option }) => {
            if (option.ref && option.ref.current != null) {
              scrollIntoViewIfNeeded(option.ref.current);
              return true;
            }

            return false;
          },
          COMMAND_PRIORITY_LOW
        )
      )
    );
  });

  createEffect(() => {
    onCleanup(
      mergeRegister(
        props.editor.registerCommand<KeyboardEvent>(
          KEY_ARROW_DOWN_COMMAND,
          (payload) => {
            const event = payload;
            if (
              props.options !== null &&
              props.options.length &&
              selectedIndex() !== null
            ) {
              const newSelectedIndex =
                selectedIndex() !== props.options.length - 1
                  ? selectedIndex()! + 1
                  : 0;
              updateSelectedIndex(newSelectedIndex);
              const option = props.options[newSelectedIndex];
              if (option.ref != null && option.ref.current) {
                props.editor.dispatchCommand(
                  SCROLL_TYPEAHEAD_OPTION_INTO_VIEW_COMMAND,
                  {
                    index: newSelectedIndex,
                    option,
                  }
                );
              }
              event.preventDefault();
              event.stopImmediatePropagation();
            }
            return true;
          },
          COMMAND_PRIORITY_LOW
        ),
        props.editor.registerCommand<KeyboardEvent>(
          KEY_ARROW_UP_COMMAND,
          (payload) => {
            const event = payload;
            if (
              props.options !== null &&
              props.options.length &&
              selectedIndex() !== null
            ) {
              const newSelectedIndex =
                selectedIndex() !== 0
                  ? selectedIndex()! - 1
                  : props.options.length - 1;
              updateSelectedIndex(newSelectedIndex);
              const option = props.options[newSelectedIndex];
              if (option.ref != null && option.ref.current) {
                scrollIntoViewIfNeeded(option.ref.current);
              }
              event.preventDefault();
              event.stopImmediatePropagation();
            }
            return true;
          },
          COMMAND_PRIORITY_LOW
        ),
        props.editor.registerCommand<KeyboardEvent>(
          KEY_ESCAPE_COMMAND,
          (payload) => {
            const event = payload;
            event.preventDefault();
            event.stopImmediatePropagation();
            close();
            return true;
          },
          COMMAND_PRIORITY_LOW
        ),
        props.editor.registerCommand<KeyboardEvent>(
          KEY_TAB_COMMAND,
          (payload) => {
            const event = payload;
            if (
              props.options === null ||
              selectedIndex === null ||
              props.options[selectedIndex()!] == null
            ) {
              return false;
            }
            event.preventDefault();
            event.stopImmediatePropagation();
            selectOptionAndCleanUp(props.options[selectedIndex()!]);
            return true;
          },
          COMMAND_PRIORITY_LOW
        ),
        props.editor.registerCommand(
          KEY_ENTER_COMMAND,
          (event: KeyboardEvent | null) => {
            if (
              props.options === null ||
              selectedIndex === null ||
              props.options[selectedIndex()!] == null
            ) {
              return false;
            }
            if (event !== null) {
              event.preventDefault();
              event.stopImmediatePropagation();
            }
            selectOptionAndCleanUp(props.options[selectedIndex()!]);
            return true;
          },
          COMMAND_PRIORITY_LOW
        )
      )
    );
  });

  const listItemProps = {
    options: props.options,
    selectOptionAndCleanUp,
    selectedIndex: createMemo(selectedIndex),
    setHighlightedIndex,
  };

  return untrack(() =>
    props.menuRenderFn(
      props.anchorElementRef,
      listItemProps,
      props.resolution.match ? props.resolution.match.matchingString : ""
    )
  );
}

export function useMenuAnchorRef(
  resolution: Accessor<MenuResolution | null>,
  setResolution: (r: MenuResolution | null) => void,
  className?: string
): MutableRefObject<HTMLElement> {
  const [editor] = useLexicalComposerContext();
  let anchorElementRef = document.createElement("div");
  const positionMenu = () => {
    const rootElement = editor.getRootElement();
    const containerDiv = anchorElementRef;

    const menuEle = containerDiv.firstChild as Element;
    if (rootElement !== null && resolution() !== null) {
      const { left, top, width, height } = resolution()!.getRect();
      containerDiv.style.top = `${top + window.pageYOffset}px`;
      containerDiv.style.left = `${left + window.pageXOffset}px`;
      containerDiv.style.height = `${height}px`;
      containerDiv.style.width = `${width}px`;
      if (menuEle !== null) {
        const menuRect = menuEle.getBoundingClientRect();
        const menuHeight = menuRect.height;
        const menuWidth = menuRect.width;

        const rootElementRect = rootElement.getBoundingClientRect();

        if (left + menuWidth > rootElementRect.right) {
          containerDiv.style.left = `${
            left - menuWidth + window.pageXOffset
          }px`;
        }
        const margin = 10;
        if (
          (top + menuHeight > window.innerHeight ||
            top + menuHeight > rootElementRect.bottom) &&
          top - rootElementRect.top > menuHeight
        ) {
          containerDiv.style.top = `${
            top - menuHeight + window.pageYOffset - (height + margin)
          }px`;
        }
      }

      if (!containerDiv.isConnected) {
        if (className != null) {
          containerDiv.className = className;
        }
        containerDiv.setAttribute("aria-label", "Typeahead menu");
        containerDiv.setAttribute("id", "typeahead-menu");
        containerDiv.setAttribute("role", "listbox");
        containerDiv.style.display = "block";
        containerDiv.style.position = "absolute";
        document.body.append(containerDiv);
      }
      anchorElementRef = containerDiv;
      rootElement.setAttribute("aria-controls", "typeahead-menu");
    }
  };

  createEffect(() => {
    const rootElement = editor.getRootElement();
    if (resolution() !== null) {
      positionMenu();
      onCleanup(() => {
        if (rootElement !== null) {
          rootElement.removeAttribute("aria-controls");
        }

        const containerDiv = anchorElementRef;
        if (containerDiv !== null && containerDiv.isConnected) {
          containerDiv.remove();
        }
      });
    }
  });

  const onVisibilityChange = (isInView: boolean) => {
    if (resolution() !== null) {
      if (!isInView) {
        setResolution(null);
      }
    }
  };

  useDynamicPositioning(
    resolution,
    anchorElementRef,
    positionMenu,
    onVisibilityChange
  );

  return {
    get current() {
      return anchorElementRef;
    },
  };
}

export type TriggerFn = (
  text: string,
  editor: LexicalEditor
) => MenuTextMatch | null;
