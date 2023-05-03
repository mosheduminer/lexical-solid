import {
  COMMAND_PRIORITY_HIGH,
  EditorState,
  ElementNode,
  GridSelection,
  LexicalCommand,
  LexicalEditor,
  LexicalNode,
  NodeSelection,
  RangeSelection,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  DEPRECATED_$isGridSelection,
} from "lexical";

import { $isLinkNode, LinkNode } from "@lexical/link";
import { $isMarkNode } from "@lexical/mark";
import { mergeRegister } from "@lexical/utils";
import { $generateHtmlFromNodes } from "@lexical/html";
import { Accessor, createEffect, createSignal, JSX, onCleanup } from "solid-js";

const NON_SINGLE_WIDTH_CHARS_REPLACEMENT: Readonly<Record<string, string>> =
  Object.freeze({
    "\t": "\\t",
    "\n": "\\n",
  });
const NON_SINGLE_WIDTH_CHARS_REGEX = new RegExp(
  Object.keys(NON_SINGLE_WIDTH_CHARS_REPLACEMENT).join("|"),
  "g"
);
const SYMBOLS: Record<string, string> = Object.freeze({
  ancestorHasNextSibling: "|",
  ancestorIsLastChild: " ",
  hasNextSibling: "├",
  isLastChild: "└",
  selectedChar: "^",
  selectedLine: ">",
});

export function TreeView(props: {
  editor: LexicalEditor;
  treeTypeButtonClassName: string;
  timeTravelButtonClass: string;
  timeTravelPanelButtonClass: string;
  timeTravelPanelClass: string;
  timeTravelPanelSliderClass: string;
  viewClass: string;
}): JSX.Element {
  const [timeStampedEditorStates, setTimeStampedEditorStates] = createSignal<
    [number, EditorState][]
  >([]);
  const [content, setContent] = createSignal("");
  const [timeTravelEnabled, setTimeTravelEnabled] = createSignal(false);
  const [showExportDOM, setShowExportDOM] = createSignal(false);
  let playingIndexRef = 0;
  let treeElementRef!: HTMLPreElement;
  let inputRef!: HTMLInputElement;
  const [isPlaying, setIsPlaying] = createSignal(false);
  const [isLimited, setIsLimited] = createSignal(false);
  const [showLimited, setShowLimited] = createSignal(false);
  let lastEditorStateRef: EditorState | null = null;

  const commandsLog = useLexicalCommandsLog(props.editor);

  const generateTree = (editorState: EditorState) => {
    // const treeText = generateContent(
    //   props.editor.getEditorState(),
    //   props.editor._config,
    //   commandsLog(),
    //   props.editor._compositionKey,
    //   props.editor._editable
    // );
    const treeText = generateContent(
      props.editor,
      commandsLog(),
      showExportDOM()
    );
    setContent(treeText);

    if (!timeTravelEnabled()) {
      setTimeStampedEditorStates((currentEditorStates) => [
        ...currentEditorStates,
        [Date.now(), editorState],
      ]);
    }
  };

  createEffect(() => {
    const editorState = props.editor.getEditorState();
    if (!showLimited() && editorState._nodeMap.size < 1000) {
      setContent(generateContent(props.editor, commandsLog(), showExportDOM()));
    }
  });

  createEffect(() => {
    onCleanup(
      mergeRegister(
        props.editor.registerUpdateListener(({ editorState }) => {
          if (!showLimited() && editorState._nodeMap.size > 1000) {
            lastEditorStateRef = editorState;
            setIsLimited(true);
            if (!showLimited) {
              return;
            }
          }
          generateTree(editorState);
        }),
        props.editor.registerEditableListener(() => {
          const treeText = generateContent(
            props.editor,
            commandsLog(),
            showExportDOM()
          );
          setContent(treeText);
        })
      )
    );
  });

  const totalEditorStates = timeStampedEditorStates.length;

  createEffect(() => {
    if (isPlaying()) {
      let timeoutId: ReturnType<typeof setTimeout>;

      const play = () => {
        const currentIndex = playingIndexRef;

        if (currentIndex === totalEditorStates - 1) {
          setIsPlaying(false);
          return;
        }

        const timeStampedEditorStatesRaw = timeStampedEditorStates();
        const currentTime = timeStampedEditorStatesRaw[currentIndex][0];
        const nextTime = timeStampedEditorStatesRaw[currentIndex + 1][0];
        const timeDiff = nextTime - currentTime;
        timeoutId = setTimeout(() => {
          playingIndexRef++;
          const index = playingIndexRef;
          const input = inputRef;

          if (input !== null) {
            input.value = String(index);
          }

          props.editor.setEditorState(timeStampedEditorStatesRaw[index][1]);
          play();
        }, timeDiff);
      };

      play();

      onCleanup(() => {
        clearTimeout(timeoutId);
      });
    }
  });

  createEffect(() => {
    const element = treeElementRef;

    if (element !== null) {
      // @ts-ignore Internal field
      element.__lexicalEditor = props.editor;

      onCleanup(() => {
        // @ts-ignore Internal field
        element.__lexicalEditor = null;
      });
    }
  });

  return (
    <div class={props.viewClass}>
      {!showLimited() && isLimited() ? (
        <div style={{ padding: "20px" }}>
          <span style={{ "margin-right": "20px" }}>
            Detected large EditorState, this can impact debugging performance.
          </span>
          <button
            onClick={() => {
              setShowLimited(true);
              const editorState = lastEditorStateRef;
              if (editorState !== null) {
                lastEditorStateRef = null;
                generateTree(editorState);
              }
            }}
            style={{
              background: "transparent",
              border: "1px solid white",
              color: "white",
              cursor: "pointer",
              padding: "5px",
            }}
          >
            Show full tree
          </button>
        </div>
      ) : null}
      {!showLimited() ? (
        <button
          onClick={() => setShowExportDOM(!showExportDOM())}
          class={props.treeTypeButtonClassName}
          type="button"
        >
          {showExportDOM() ? "Tree" : "Export DOM"}
        </button>
      ) : null}
      {!timeTravelEnabled() &&
        (showLimited() || !isLimited()) &&
        totalEditorStates > 2 && (
          <button
            onClick={() => {
              const rootElement = props.editor.getRootElement();

              if (rootElement !== null) {
                rootElement.contentEditable = "false";
                playingIndexRef = totalEditorStates - 1;
                setTimeTravelEnabled(true);
              }
            }}
            class={props.timeTravelButtonClass}
            type="button"
          >
            Time Travel
          </button>
        )}
      {(showLimited() || !isLimited()) && (
        <pre ref={treeElementRef}>{content}</pre>
      )}
      {timeTravelEnabled() && (showLimited() || !isLimited()) && (
        <div class={props.timeTravelPanelClass}>
          <button
            class={props.timeTravelPanelButtonClass}
            onClick={() => {
              if (playingIndexRef === totalEditorStates - 1) {
                playingIndexRef = 1;
              }
              setIsPlaying(!isPlaying());
            }}
            type="button"
          >
            {isPlaying() ? "Pause" : "Play"}
          </button>
          <input
            class={props.timeTravelPanelSliderClass}
            ref={inputRef}
            onChange={(event) => {
              const editorStateIndex = Number(event.currentTarget.value);
              const timeStampedEditorState =
                timeStampedEditorStates()[editorStateIndex];

              if (timeStampedEditorState) {
                playingIndexRef = editorStateIndex;
                props.editor.setEditorState(timeStampedEditorState[1]);
              }
            }}
            type="range"
            min="1"
            max={totalEditorStates - 1}
          />
          <button
            class={props.timeTravelPanelButtonClass}
            onClick={() => {
              const rootElement = props.editor.getRootElement();

              if (rootElement !== null) {
                rootElement.contentEditable = "true";
                const index = timeStampedEditorStates.length - 1;
                const timeStampedEditorState = timeStampedEditorStates()[index];
                props.editor.setEditorState(timeStampedEditorState[1]);
                const input = inputRef;

                if (input !== null) {
                  input.value = String(index);
                }

                setTimeTravelEnabled(false);
                setIsPlaying(false);
              }
            }}
            type="button"
          >
            Exit
          </button>
        </div>
      )}
    </div>
  );
}

function useLexicalCommandsLog(
  editor: LexicalEditor
): Accessor<ReadonlyArray<LexicalCommand<unknown> & { payload: unknown }>> {
  const [loggedCommands, setLoggedCommands] = createSignal<
    ReadonlyArray<LexicalCommand<unknown> & { payload: unknown }>
  >([]);

  createEffect(() => {
    const unregisterCommandListeners = new Set<() => void>();

    for (const [command] of editor._commands) {
      unregisterCommandListeners.add(
        editor.registerCommand(
          command,
          (payload) => {
            setLoggedCommands((state) => {
              const newState = [...state];
              newState.push({
                payload,
                type: command.type ? command.type : "UNKNOWN",
              });

              if (newState.length > 10) {
                newState.shift();
              }

              return newState;
            });

            return false;
          },
          COMMAND_PRIORITY_HIGH
        )
      );
    }

    onCleanup(() =>
      unregisterCommandListeners.forEach((unregister) => unregister())
    );
  });

  return loggedCommands;
}

function printRangeSelection(selection: RangeSelection): string {
  let res = "";

  const formatText = printFormatProperties(selection);

  res += `: range ${formatText !== "" ? `{ ${formatText} }` : ""} ${
    selection.style !== "" ? `{ style: ${selection.style} } ` : ""
  }`;

  const anchor = selection.anchor;
  const focus = selection.focus;
  const anchorOffset = anchor.offset;
  const focusOffset = focus.offset;

  res += `\n  ├ anchor { key: ${anchor.key}, offset: ${
    anchorOffset === null ? "null" : anchorOffset
  }, type: ${anchor.type} }`;
  res += `\n  └ focus { key: ${focus.key}, offset: ${
    focusOffset === null ? "null" : focusOffset
  }, type: ${focus.type} }`;

  return res;
}

function printNodeSelection(selection: NodeSelection): string {
  return `: node\n  └ [${Array.from(selection._nodes).join(", ")}]`;
}

function printGridSelection(selection: GridSelection): string {
  return `: grid\n  └ { grid: ${selection.gridKey}, anchorCell: ${selection.anchor.key}, focusCell: ${selection.focus.key} }`;
}

function generateContent(
  editor: LexicalEditor,
  commandsLog: ReadonlyArray<LexicalCommand<unknown> & { payload: unknown }>,
  exportDOM: boolean
): string {
  const editorState = editor.getEditorState();
  const editorConfig = editor._config;
  const compositionKey = editor._compositionKey;
  const editable = editor._editable;

  if (exportDOM) {
    let htmlString = "";
    editorState.read(() => {
      htmlString = printPrettyHTML($generateHtmlFromNodes(editor));
    });
    return htmlString;
  }

  let res = " root\n";

  const selectionString = editorState.read(() => {
    const selection = $getSelection();

    visitTree($getRoot(), (node: LexicalNode, indent: Array<string>) => {
      const nodeKey = node.getKey();
      const nodeKeyDisplay = `(${nodeKey})`;
      const typeDisplay = node.getType() || "";
      const isSelected = node.isSelected();
      const idsDisplay = $isMarkNode(node)
        ? ` id: [ ${node.getIDs().join(", ")} ] `
        : "";

      res += `${isSelected ? SYMBOLS.selectedLine : " "} ${indent.join(
        " "
      )} ${nodeKeyDisplay} ${typeDisplay} ${idsDisplay} ${printNode(node)}\n`;

      res += printSelectedCharsLine({
        indent,
        isSelected,
        node,
        nodeKeyDisplay,
        selection,
        typeDisplay,
      });
    });

    return selection === null
      ? ": null"
      : $isRangeSelection(selection)
      ? printRangeSelection(selection)
      : DEPRECATED_$isGridSelection(selection)
      ? printGridSelection(selection)
      : printNodeSelection(selection);
  });

  res += "\n selection" + selectionString;

  res += "\n\n commands:";

  if (commandsLog.length) {
    for (const { type, payload } of commandsLog) {
      res += `\n  └ { type: ${type}, payload: ${
        payload instanceof Event ? payload.constructor.name : payload
      } }`;
    }
  } else {
    res += "\n  └ None dispatched.";
  }

  res += "\n\n editor:";
  res += `\n  └ namespace ${editorConfig.namespace}`;
  if (compositionKey !== null) {
    res += `\n  └ compositionKey ${compositionKey}`;
  }
  res += `\n  └ editable ${String(editable)}`;

  return res;
}

function visitTree(
  currentNode: ElementNode,
  visitor: (node: LexicalNode, indentArr: Array<string>) => void,
  indent: Array<string> = []
) {
  const childNodes = currentNode.getChildren();
  const childNodesLength = childNodes.length;

  childNodes.forEach((childNode, i) => {
    visitor(
      childNode,
      indent.concat(
        i === childNodesLength - 1
          ? SYMBOLS.isLastChild
          : SYMBOLS.hasNextSibling
      )
    );

    if ($isElementNode(childNode)) {
      visitTree(
        childNode,
        visitor,
        indent.concat(
          i === childNodesLength - 1
            ? SYMBOLS.ancestorIsLastChild
            : SYMBOLS.ancestorHasNextSibling
        )
      );
    }
  });
}

function normalize(text: string) {
  return Object.entries(NON_SINGLE_WIDTH_CHARS_REPLACEMENT).reduce(
    (acc, [key, value]) => acc.replace(new RegExp(key, "g"), String(value)),
    text
  );
}

// TODO Pass via props to allow customizability
function printNode(node: LexicalNode) {
  if ($isTextNode(node)) {
    const text = node.getTextContent();
    const title = text.length === 0 ? "(empty)" : `"${normalize(text)}"`;
    const properties = printAllTextNodeProperties(node);
    return [title, properties.length !== 0 ? `{ ${properties} }` : null]
      .filter(Boolean)
      .join(" ")
      .trim();
  } else if ($isLinkNode(node)) {
    const link = node.getURL();
    const title = link.length === 0 ? "(empty)" : `"${normalize(link)}"`;
    const properties = printAllLinkNodeProperties(node);
    return [title, properties.length !== 0 ? `{ ${properties} }` : null]
      .filter(Boolean)
      .join(" ")
      .trim();
  } else {
    return "";
  }
}

const FORMAT_PREDICATES = [
  (node: LexicalNode | RangeSelection) => node.hasFormat("bold") && "Bold",
  (node: LexicalNode | RangeSelection) => node.hasFormat("code") && "Code",
  (node: LexicalNode | RangeSelection) => node.hasFormat("italic") && "Italic",
  (node: LexicalNode | RangeSelection) =>
    node.hasFormat("strikethrough") && "Strikethrough",
  (node: LexicalNode | RangeSelection) =>
    node.hasFormat("subscript") && "Subscript",
  (node: LexicalNode | RangeSelection) =>
    node.hasFormat("superscript") && "Superscript",
  (node: LexicalNode | RangeSelection) =>
    node.hasFormat("underline") && "Underline",
];

const DETAIL_PREDICATES = [
  (node: LexicalNode) => node.isDirectionless() && "Directionless",
  (node: LexicalNode) => node.isUnmergeable() && "Unmergeable",
];

const MODE_PREDICATES = [
  (node: LexicalNode) => node.isToken() && "Token",
  (node: LexicalNode) => node.isSegmented() && "Segmented",
];

function printAllTextNodeProperties(node: LexicalNode) {
  return [
    printFormatProperties(node),
    printDetailProperties(node),
    printModeProperties(node),
  ]
    .filter(Boolean)
    .join(", ");
}

function printAllLinkNodeProperties(node: LinkNode) {
  return [
    printTargetProperties(node),
    printRelProperties(node),
    printTitleProperties(node),
  ]
    .filter(Boolean)
    .join(", ");
}

function printDetailProperties(nodeOrSelection: LexicalNode) {
  let str = DETAIL_PREDICATES.map((predicate) => predicate(nodeOrSelection))
    .filter(Boolean)
    .join(", ")
    .toLocaleLowerCase();

  if (str !== "") {
    str = "detail: " + str;
  }

  return str;
}

function printModeProperties(nodeOrSelection: LexicalNode) {
  let str = MODE_PREDICATES.map((predicate) => predicate(nodeOrSelection))
    .filter(Boolean)
    .join(", ")
    .toLocaleLowerCase();

  if (str !== "") {
    str = "mode: " + str;
  }

  return str;
}

function printFormatProperties(nodeOrSelection: LexicalNode | RangeSelection) {
  let str = FORMAT_PREDICATES.map((predicate) => predicate(nodeOrSelection))
    .filter(Boolean)
    .join(", ")
    .toLocaleLowerCase();

  if (str !== "") {
    str = "format: " + str;
  }

  return str;
}

function printTargetProperties(node: LinkNode) {
  let str = node.getTarget();
  // TODO Fix nullish on LinkNode
  if (str != null) {
    str = "target: " + str;
  }
  return str;
}

function printRelProperties(node: LinkNode) {
  let str = node.getRel();
  // TODO Fix nullish on LinkNode
  if (str != null) {
    str = "rel: " + str;
  }
  return str;
}

function printTitleProperties(node: LinkNode) {
  let str = node.getTitle();
  // TODO Fix nullish on LinkNode
  if (str != null) {
    str = "title: " + str;
  }
  return str;
}

function printSelectedCharsLine({
  indent,
  isSelected,
  node,
  nodeKeyDisplay,
  selection,
  typeDisplay,
}: {
  indent: Array<string>;
  isSelected: boolean;
  node: LexicalNode;
  nodeKeyDisplay: string;
  selection: GridSelection | NodeSelection | RangeSelection | null;
  typeDisplay: string;
}) {
  // No selection or node is not selected.
  if (
    !$isTextNode(node) ||
    !$isRangeSelection(selection) ||
    !isSelected ||
    $isElementNode(node)
  ) {
    return "";
  }

  // No selected characters.
  const anchor = selection.anchor;
  const focus = selection.focus;

  if (
    node.getTextContent() === "" ||
    (anchor.getNode() === selection.focus.getNode() &&
      anchor.offset === focus.offset)
  ) {
    return "";
  }

  const [start, end] = $getSelectionStartEnd(node, selection);

  if (start === end) {
    return "";
  }

  const selectionLastIndent =
    indent[indent.length - 1] === SYMBOLS.hasNextSibling
      ? SYMBOLS.ancestorHasNextSibling
      : SYMBOLS.ancestorIsLastChild;

  const indentionChars = [
    ...indent.slice(0, indent.length - 1),
    selectionLastIndent,
  ];
  const unselectedChars = Array(start + 1).fill(" ");
  const selectedChars = Array(end - start).fill(SYMBOLS.selectedChar);
  const paddingLength = typeDisplay.length + 3; // 2 for the spaces around + 1 for the double quote.

  const nodePrintSpaces = Array(nodeKeyDisplay.length + paddingLength).fill(
    " "
  );

  return (
    [
      SYMBOLS.selectedLine,
      indentionChars.join(" "),
      [...nodePrintSpaces, ...unselectedChars, ...selectedChars].join(""),
    ].join(" ") + "\n"
  );
}

function printPrettyHTML(str: string) {
  const div = document.createElement("div");
  div.innerHTML = str.trim();
  return prettifyHTML(div, 0).innerHTML;
}

function prettifyHTML(node: Element, level: number) {
  const indentBefore = new Array(level++ + 1).join("  ");
  const indentAfter = new Array(level - 1).join("  ");
  let textNode;

  for (let i = 0; i < node.children.length; i++) {
    textNode = document.createTextNode("\n" + indentBefore);
    node.insertBefore(textNode, node.children[i]);
    prettifyHTML(node.children[i], level);
    if (node.lastElementChild === node.children[i]) {
      textNode = document.createTextNode("\n" + indentAfter);
      node.appendChild(textNode);
    }
  }

  return node;
}

function $getSelectionStartEnd(
  node: LexicalNode,
  selection: RangeSelection | GridSelection
): [number, number] {
  const anchor = selection.anchor;
  const focus = selection.focus;
  const textContent = node.getTextContent();
  const textLength = textContent.length;

  let start = -1;
  let end = -1;

  // Only one node is being selected.
  if (anchor.type === "text" && focus.type === "text") {
    const anchorNode = anchor.getNode();
    const focusNode = focus.getNode();

    if (
      anchorNode === focusNode &&
      node === anchorNode &&
      anchor.offset !== focus.offset
    ) {
      [start, end] =
        anchor.offset < focus.offset
          ? [anchor.offset, focus.offset]
          : [focus.offset, anchor.offset];
    } else if (node === anchorNode) {
      [start, end] = anchorNode.isBefore(focusNode)
        ? [anchor.offset, textLength]
        : [0, anchor.offset];
    } else if (node === focusNode) {
      [start, end] = focusNode.isBefore(anchorNode)
        ? [focus.offset, textLength]
        : [0, focus.offset];
    } else {
      // Node is within selection but not the anchor nor focus.
      [start, end] = [0, textLength];
    }
  }

  // Account for non-single width characters.
  const numNonSingleWidthCharBeforeSelection = (
    textContent.slice(0, start).match(NON_SINGLE_WIDTH_CHARS_REGEX) || []
  ).length;
  const numNonSingleWidthCharInSelection = (
    textContent.slice(start, end).match(NON_SINGLE_WIDTH_CHARS_REGEX) || []
  ).length;

  return [
    start + numNonSingleWidthCharBeforeSelection,
    end +
      numNonSingleWidthCharBeforeSelection +
      numNonSingleWidthCharInSelection,
  ];
}
