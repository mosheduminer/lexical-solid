import { useLexicalComposerContext } from "./LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_NORMAL,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_TAB_COMMAND,
  LexicalEditor,
  RangeSelection,
  TextNode,
  NodeKey,
  $getNodeByKey,
} from "lexical";
import {
  Accessor,
  createEffect,
  createMemo,
  createSignal,
  JSX,
  on,
  onCleanup,
  Show,
  startTransition,
  untrack,
} from "solid-js";

export type QueryMatch = {
  leadOffset: number;
  matchingString: string;
  replaceableString: string;
};

export type Resolution = {
  match: QueryMatch;
  getRect: () => ClientRect;
};

export const PUNCTUATION =
  "\\.,\\+\\*\\?\\$\\@\\|#{}\\(\\)\\^\\-\\[\\]\\\\/!%'\"~=<>_:;";

export class TypeaheadOption {
  key: string;
  ref: HTMLElement | null;

  constructor(key: string) {
    this.key = key;
    this.ref = null;
    this.setRefElement = this.setRefElement.bind(this);
  }

  setRefElement(elementAccessor: HTMLElement | undefined) {
    this.ref = elementAccessor || null;
  }
}

export type MenuRenderFn<TOption extends TypeaheadOption> = (
  anchorElement: () => HTMLElement | null,
  itemProps: {
    selectedIndex: Accessor<number | null>;
    selectOptionAndCleanUp: (option: TOption) => void;
    setHighlightedIndex: (index: number) => void;
  },
  matchingString: string
) => JSX.Element;

const scrollIntoViewIfNeeded = (target: HTMLElement) => {
  const container = document.getElementById("typeahead-menu");
  if (container) {
    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    if (targetRect.bottom > containerRect.bottom) {
      target.scrollIntoView(false);
    } else if (targetRect.top < containerRect.top) {
      target.scrollIntoView();
    }
  }
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

function LexicalPopoverMenu<TOption extends TypeaheadOption>(props: {
  close: () => void;
  editor: LexicalEditor;
  anchorElement: HTMLElement;
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
  const [selectedIndex, setHighlightedIndex] = createSignal<number | null>(
    null
  );

  createEffect(
    on(
      () => props.resolution.match.matchingString,
      () => {
        setHighlightedIndex(0);
      }
    )
  );

  const selectOptionAndCleanUp = async (selectedEntry: TOption) => {
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

  onCleanup(() => {
    const rootElem = props.editor.getRootElement();
    if (rootElem !== null) {
      rootElem.removeAttribute("aria-activedescendant");
    }
  });

  createEffect(() => {
    if (props.options === null) {
      setHighlightedIndex(null);
    } else if (selectedIndex() === null) {
      updateSelectedIndex(0);
    }
  });

  createEffect(
    on(selectedIndex, () => {
      onCleanup(
        mergeRegister(
          props.editor.registerCommand<KeyboardEvent>(
            KEY_ARROW_DOWN_COMMAND,
            (payload) => {
              const event = payload;
              if (props.options !== null && selectedIndex() !== null) {
                const newSelectedIndex =
                  selectedIndex() !== props.options.length - 1
                    ? (selectedIndex() as number) + 1
                    : 0;
                updateSelectedIndex(newSelectedIndex);
                const option = props.options[newSelectedIndex];
                if (option.ref != null && option.ref) {
                  scrollIntoViewIfNeeded(option.ref!);
                }
                event.preventDefault();
                event.stopImmediatePropagation();
              }
              return true;
            },
            COMMAND_PRIORITY_NORMAL
          ),
          props.editor.registerCommand<KeyboardEvent>(
            KEY_ARROW_UP_COMMAND,
            (payload) => {
              const event = payload;
              if (props.options !== null && selectedIndex() !== null) {
                const newSelectedIndex =
                  selectedIndex() !== 0
                    ? (selectedIndex() as number) - 1
                    : props.options.length - 1;
                updateSelectedIndex(newSelectedIndex);
                const option = props.options[newSelectedIndex];
                if (option.ref != null && option.ref) {
                  scrollIntoViewIfNeeded(option.ref!);
                }
                event.preventDefault();
                event.stopImmediatePropagation();
              }
              return true;
            },
            COMMAND_PRIORITY_NORMAL
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
            COMMAND_PRIORITY_NORMAL
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
            COMMAND_PRIORITY_NORMAL
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
            COMMAND_PRIORITY_NORMAL
          )
        )
      );
    })
  );

  const listItemProps = {
    selectOptionAndCleanUp,
    selectedIndex: createMemo(() => selectedIndex()),
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

function useAnchorElementRef(
  resolution: () => Resolution | null
): () => HTMLElement {
  const [editor] = useLexicalComposerContext();
  const [anchorElementRef, setAnchorElementRef] = createSignal(
    (<div />) as HTMLDivElement
  );

  createEffect(() => {
    const rootElement = editor.getRootElement();
    function positionMenu() {
      const containerDiv = anchorElementRef();
      containerDiv.setAttribute("aria-label", "Typeahead menu");
      containerDiv.setAttribute("id", "typeahead-menu");
      containerDiv.setAttribute("role", "listbox");
      if (rootElement !== null && resolution() !== null) {
        const { left, top, height } = resolution()!.getRect();
        containerDiv.style.top = `${top + height + 5 + window.pageYOffset}px`;
        containerDiv.style.left = `${left + window.pageXOffset}px`;
        containerDiv.style.display = "block";
        containerDiv.style.position = "absolute";
        if (!containerDiv.isConnected) {
          document.body.append(containerDiv);
        }
        setAnchorElementRef(containerDiv);
        rootElement.setAttribute("aria-controls", "typeahead-menu");
      }
    }

    if (resolution !== null) {
      positionMenu();
      window.addEventListener("resize", positionMenu);
      return () => {
        window.removeEventListener("resize", positionMenu);
        if (rootElement !== null) {
          rootElement.removeAttribute("aria-controls");
        }
      };
    }
  });

  return anchorElementRef;
}

export type TypeaheadMenuPluginArgs<TOption extends TypeaheadOption> = {
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
};

export type TriggerFn = (
  text: string,
  editor: LexicalEditor
) => QueryMatch | null;

export function LexicalTypeaheadMenuPlugin<TOption extends TypeaheadOption>(
  props: TypeaheadMenuPluginArgs<TOption>
): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const [resolution, setResolution] = createSignal<Resolution | null>(null);
  const anchorElementRef = useAnchorElementRef(resolution);

  createEffect(() => {
    let activeRange: Range | null = document.createRange();
    let previousText: string | null = null;

    const updateListener = () => {
      editor.getEditorState().read(() => {
        const range = activeRange;
        const selection = $getSelection();
        const text = getQueryTextForSearch(editor);

        if (
          !$isRangeSelection(selection) ||
          !selection.isCollapsed() ||
          text === previousText ||
          text === null ||
          range === null
        ) {
          setResolution(null);
          return;
        }
        previousText = text;

        const match = props.triggerFn(text, editor);
        props.onQueryChange(match ? match.matchingString : null);

        if (
          match !== null &&
          !isSelectionOnEntityBoundary(editor, match.leadOffset)
        ) {
          const isRangePositioned = tryToPositionRange(match.leadOffset, range);
          if (isRangePositioned !== null) {
            startTransition(() =>
              setResolution({
                match,
                getRect: () => range.getBoundingClientRect(),
              })
            );
            return;
          }
        }
        setResolution(null);
      });
    };

    const removeUpdateListener = editor.registerUpdateListener(updateListener);

    onCleanup(() => {
      activeRange = null;
      removeUpdateListener();
    });
  });

  const closeTypeahead = () => {
    setResolution(null);
  };

  return (
    <Show when={resolution() !== null && editor !== null}>
      <LexicalPopoverMenu
        anchorElement={anchorElementRef()}
        close={closeTypeahead}
        resolution={resolution()!}
        editor={editor}
        options={props.options}
        menuRenderFn={props.menuRenderFn}
        onSelectOption={props.onSelectOption}
      />
    </Show>
  );
}

type NodeMenuPluginArgs<TOption extends TypeaheadOption> = {
  onSelectOption: (
    option: TOption,
    textNodeContainingQuery: TextNode | null,
    closeMenu: () => void,
    matchingString: string
  ) => void;
  options: Array<TOption>;
  nodeKey: NodeKey | null;
  onClose: () => void;
  menuRenderFn: MenuRenderFn<TOption>;
};

export function LexicalNodeMenuPlugin<TOption extends TypeaheadOption>(
  props: NodeMenuPluginArgs<TOption>
): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [resolution, setResolution] = createSignal<Resolution | null>(null);
  const anchorElementRef = useAnchorElementRef(resolution);

  createEffect(() => {
    if (props.nodeKey && resolution() == null) {
      editor.update(() => {
        const node = $getNodeByKey(props.nodeKey as string);
        const domElement = editor.getElementByKey(props.nodeKey as string);

        if (node != null && domElement != null) {
          const text = node.getTextContent();
          startTransition(() =>
            setResolution({
              getRect: () => domElement.getBoundingClientRect(),
              match: {
                leadOffset: text.length,
                matchingString: text,
                replaceableString: text,
              },
            })
          );
        }
      });
    } else if (props.nodeKey == null && resolution() != null) {
      setResolution(null);
    }
  });

  return (
    <Show when={resolution() !== null && editor === null}>
      <LexicalPopoverMenu
        anchorElement={anchorElementRef()}
        close={props.onClose}
        resolution={resolution()!}
        editor={editor}
        options={props.options}
        menuRenderFn={props.menuRenderFn}
        onSelectOption={props.onSelectOption}
      />
    </Show>
  );
}
