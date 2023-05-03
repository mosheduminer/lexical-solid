import { useLexicalComposerContext } from "./LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import {
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_LOW,
  createCommand,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_TAB_COMMAND,
  LexicalCommand,
  LexicalEditor,
  NodeKey,
  RangeSelection,
  TextNode,
} from "lexical";
import {
  createEffect,
  on,
  createMemo,
  createSignal,
  Show,
  JSX,
  startTransition,
  onCleanup,
  untrack,
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

type MutableRefObject<T> = { current: T };

export class TypeaheadOption {
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

export type MenuRenderFn<TOption extends TypeaheadOption> = (
  anchorElement: Accessor<HTMLElement | null | undefined>,
  itemProps: {
    selectedIndex: Accessor<number | null>;
    selectOptionAndCleanUp: (option: TOption) => void;
    setHighlightedIndex: (index: number) => void;
    options: Array<TOption>;
  },
  matchingString: string
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
function splitNodeContainingQuery(
  editor: LexicalEditor,
  match: QueryMatch
): TextNode | null {
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
  resolution: Accessor<Resolution | null>,
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
  option: TypeaheadOption;
}> = createCommand("SCROLL_TYPEAHEAD_OPTION_INTO_VIEW_COMMAND");

function LexicalPopoverMenu<TOption extends TypeaheadOption>(props: {
  close: () => void;
  editor: LexicalEditor;
  anchorElement: HTMLElement | undefined;
  resolution: Resolution;
  options: Array<TOption>;
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
      () => [props.resolution.match.matchingString],
      () => {
        setHighlightedIndex(0);
      }
    )
  );

  const selectOptionAndCleanUp = (selectedEntry: TOption) => {
    props.editor.update(() => {
      const textNodeContainingQuery = splitNodeContainingQuery(
        props.editor,
        props.resolution.match
      );

      props.onSelectOption(
        selectedEntry,
        textNodeContainingQuery,
        close,
        props.resolution.match.matchingString
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
    } else if (selectedIndex() === null) {
      updateSelectedIndex(0);
    }
  });

  createEffect(
    on(
      () => [props.editor, updateSelectedIndex],
      () => {
        return mergeRegister(
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
        );
      }
    )
  );

  createEffect(
    on(
      () => [
        selectOptionAndCleanUp,
        close,
        props.editor,
        props.options,
        selectedIndex(),
        updateSelectedIndex,
      ],
      () => {
        return mergeRegister(
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
                selectedIndex() === null ||
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
                selectedIndex() === null ||
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
        );
      }
    )
  );

  const listItemProps = {
    options: props.options,
    selectOptionAndCleanUp,
    selectedIndex: createMemo(selectedIndex),
    setHighlightedIndex,
  };

  return untrack(() =>
    props.menuRenderFn(
      () => props.anchorElement,
      listItemProps,
      props.resolution.match.matchingString
    )
  );
}

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

function useMenuAnchorRef(
  resolution: Accessor<Resolution | null>,
  setResolution: (r: Resolution | null) => void,
  className?: string
): Accessor<HTMLElement> {
  const [editor] = useLexicalComposerContext();
  const [anchorElementRef, setAnchorElementRef] = createSignal(
    (<div />) as HTMLDivElement
  );
  const positionMenu = () => {
    const rootElement = editor.getRootElement();
    const containerDiv = anchorElementRef();

    if (rootElement !== null && resolution() !== null) {
      const { left, top, width, height } = resolution()!.getRect();
      containerDiv.style.top = `${top + window.pageYOffset}px`;
      containerDiv.style.left = `${left + window.pageXOffset}px`;
      containerDiv.style.height = `${height}px`;
      containerDiv.style.width = `${width}px`;

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
      setAnchorElementRef(containerDiv);
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

        const containerDiv = anchorElementRef();
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

  return anchorElementRef;
}

export type TypeaheadMenuPluginProps<TOption extends TypeaheadOption> = {
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
  onOpen?: (resolution: Resolution) => void;
  onClose?: () => void;
  anchorClassName?: string;
};

export type TriggerFn = (
  text: string,
  editor: LexicalEditor
) => QueryMatch | null;

export function LexicalTypeaheadMenuPlugin<TOption extends TypeaheadOption>(
  props: TypeaheadMenuPluginProps<TOption>
): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [resolution, setResolution] = createSignal<Resolution | null>(null);
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

  const openTypeahead = (res: Resolution) => {
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
      <LexicalPopoverMenu<TOption>
        close={closeTypeahead}
        resolution={resolution()!}
        editor={editor}
        anchorElement={anchorElementRef()}
        options={props.options}
        menuRenderFn={props.menuRenderFn}
        onSelectOption={props.onSelectOption}
      />
    </Show>
  );
}

type NodeMenuPluginProps<TOption extends TypeaheadOption> = {
  onSelectOption: (
    option: TOption,
    textNodeContainingQuery: TextNode | null,
    closeMenu: () => void,
    matchingString: string
  ) => void;
  options: Array<TOption>;
  nodeKey: NodeKey | null;
  onClose?: () => void;
  onOpen?: (resolution: Resolution) => void;
  menuRenderFn: MenuRenderFn<TOption>;
  anchorClassName?: string;
};

export function LexicalNodeMenuPlugin<TOption extends TypeaheadOption>(
  props: NodeMenuPluginProps<TOption>
): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [resolution, setResolution] = createSignal<Resolution | null>(null);
  const anchorElementRef = useMenuAnchorRef(
    resolution,
    setResolution,
    props.anchorClassName
  );

  const closeNodeMenu = () => {
    setResolution(null);
    if (props.onClose != null && resolution() !== null) {
      props.onClose();
    }
  };

  const openNodeMenu = (res: Resolution) => {
    setResolution(res);
    if (props.onOpen != null && resolution() === null) {
      props.onOpen(res);
    }
  };

  const positionOrCloseMenu = () => {
    if (props.nodeKey) {
      editor.update(() => {
        const node = $getNodeByKey(props.nodeKey!);
        const domElement = editor.getElementByKey(props.nodeKey!);

        if (node != null && domElement != null) {
          const text = node.getTextContent();
          if (
            resolution() == null ||
            resolution()!.match.matchingString !== text
          ) {
            startTransition(() =>
              openNodeMenu({
                getRect: () => domElement.getBoundingClientRect(),
                match: {
                  leadOffset: text.length,
                  matchingString: text,
                  replaceableString: text,
                },
              })
            );
          }
        }
      });
    } else if (props.nodeKey == null && resolution() != null) {
      closeNodeMenu();
    }
  };

  createEffect(on(() => props.nodeKey, positionOrCloseMenu));

  createEffect(() => {
    const nodeKey = props.nodeKey;
    if (nodeKey != null) {
      return editor.registerUpdateListener(({ dirtyElements }) => {
        if (dirtyElements.get(nodeKey)) {
          positionOrCloseMenu();
        }
      });
    }
  });

  return (
    <Show when={resolution() !== null && editor !== null}>
      <LexicalPopoverMenu
        close={closeNodeMenu}
        resolution={resolution()!}
        editor={editor}
        anchorElement={anchorElementRef()}
        options={props.options}
        menuRenderFn={props.menuRenderFn}
        onSelectOption={props.onSelectOption}
      />
    </Show>
  );
}
