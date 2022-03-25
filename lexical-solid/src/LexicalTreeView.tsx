import { createEffect, createSignal, JSX, on, onCleanup, Show } from "solid-js";
import {
  $getRoot,
  $getSelection,
  $isElementNode,
  $isGridSelection,
  $isRangeSelection,
  $isTextNode,
  EditorState,
  ElementNode,
  GridSelection,
  LexicalEditor,
  LexicalNode,
  NodeSelection,
  RangeSelection,
  TextNode,
} from "lexical";

const NON_SINGLE_WIDTH_CHARS_REPLACEMENT = Object.freeze({
  "\t": "\\t",
  "\n": "\\n",
});
const NON_SINGLE_WIDTH_CHARS_REGEX = new RegExp(
  Object.keys(NON_SINGLE_WIDTH_CHARS_REPLACEMENT).join("|"),
  "g"
);
const SYMBOLS = Object.freeze({
  ancestorHasNextSibling: "|",
  ancestorIsLastChild: " ",
  hasNextSibling: "├",
  isLastChild: "└",
  selectedChar: "^",
  selectedLine: ">",
});

export default function TreeView(props: {
  timeTravelPanelClassName: string;
  timeTravelPanelSliderClassName: string;
  timeTravelPanelButtonClassName: string;
  timeTravelButtonClassName: string;
  viewClassName: string;
  editor: LexicalEditor;
}): JSX.Element {
  const [timeStampedEditorStates, setTimeStampedEditorStates] = createSignal<
    [number, EditorState][]
  >([]);
  const [content, setContent] = createSignal("");
  const [timeTravelEnabled, setTimeTravelEnabled] = createSignal(false);
  let playingIndexRef = 0;
  let treeElementRef!: HTMLPreElement;
  let inputRef!: HTMLInputElement;
  const [isPlaying, setIsPlaying] = createSignal(false);
  createEffect(
    on(
      () => [timeTravelEnabled(), props.editor],
      () => {
        setContent(generateContent(props.editor.getEditorState()));
        onCleanup(
          props.editor.addListener("update", ({ editorState }) => {
            const compositionKey = props.editor._compositionKey;
            const treeText = generateContent(props.editor.getEditorState());
            const compositionText =
              compositionKey !== null && `Composition key: ${compositionKey}`;
            setContent(
              [treeText, compositionText].filter(Boolean).join("\n\n")
            );

            if (!timeTravelEnabled()) {
              setTimeStampedEditorStates((currentEditorStates) => [
                ...currentEditorStates,
                [Date.now(), editorState],
              ]);
            }
          })
        );
      }
    )
  );
  const totalEditorStates = () => timeStampedEditorStates().length;
  createEffect(() => {
    if (isPlaying()) {
      let timeoutId: number;
      const play = () => {
        const currentIndex = playingIndexRef;

        if (currentIndex === totalEditorStates() - 1) {
          setIsPlaying(false);
          return;
        }

        const currentTime = timeStampedEditorStates()[currentIndex][0];
        const nextTime = timeStampedEditorStates()[currentIndex + 1][0];
        const timeDiff = nextTime - currentTime;
        timeoutId = setTimeout(() => {
          playingIndexRef++;
          const index = playingIndexRef;
          const input = inputRef;

          if (input !== null) {
            input.value = String(index);
          }

          props.editor.setEditorState(timeStampedEditorStates()[index][1]);
          play();
        }, timeDiff) as unknown as number;
      };

      play();
      onCleanup(() => window.clearTimeout(timeoutId));
    }
  });
  createEffect(() => {
    const element = treeElementRef;
    const editor = props.editor;

    if (element !== null) {
      //@ts-ignore
      element.__lexicalEditor = editor;
      onCleanup(() => {
        //@ts-ignore
        element.__lexicalEditor = null;
      });
    }
  });
  return (
    <div class={props.viewClassName}>
      <Show when={!timeTravelEnabled() && totalEditorStates() > 2}>
        <button
          onClick={() => {
            const rootElement = props.editor.getRootElement();

            if (rootElement !== null) {
              rootElement.contentEditable = "false";
              playingIndexRef = totalEditorStates() - 1;
              setTimeTravelEnabled(true);
            }
          }}
          class={props.timeTravelButtonClassName}
        >
          Time Travel
        </button>
      </Show>
      <pre ref={treeElementRef}>{content()}</pre>
      <Show when={timeTravelEnabled()}>
        <div class={props.timeTravelPanelClassName}>
          <button
            class={props.timeTravelPanelButtonClassName}
            onClick={() => {
              setIsPlaying(!isPlaying);
            }}
          >
            {isPlaying() ? "Pause" : "Play"}
          </button>
          <input
            type="range"
            min="1"
            max={totalEditorStates() - 1}
            ref={inputRef}
            class={props.timeTravelPanelSliderClassName}
            onChange={(event) => {
              const editorStateIndex = Number(event.currentTarget.value);
              const timeStampedEditorState =
                timeStampedEditorStates()[editorStateIndex];

              if (timeStampedEditorState) {
                playingIndexRef = editorStateIndex;
                props.editor.setEditorState(timeStampedEditorState[1]);
              }
            }}
          />
          <button class={props.timeTravelPanelButtonClassName} onClick={() => {
            const rootElement = props.editor.getRootElement();

            if (rootElement !== null) {
              rootElement.contentEditable = "true";
              const index = timeStampedEditorStates().length - 1;
              const timeStampedEditorState = timeStampedEditorStates()[index];
              props.editor.setEditorState(timeStampedEditorState[1]);
              const input = inputRef;

              if (input !== null) {
                input.value = String(index);
              }

              setTimeTravelEnabled(false);
              setIsPlaying(false);
            }
          }}>
            Exit
          </button>
        </div>
      </Show>
    </div>
  );
}

type NodeOrSelection = TextNode | RangeSelection | GridSelection | NodeSelection;

function printRangeSelection(selection: NodeOrSelection) {
  let res = "";
  const formatText = printFormatProperties(selection);
  res += `: range ${formatText !== "" ? `{ ${formatText} }` : ""}`;
  const anchor = selection.anchor;
  const focus = selection.focus;
  const anchorOffset = anchor.offset;
  const focusOffset = focus.offset;
  res += `\n  ├ anchor { key: ${anchor.key}, offset: ${anchorOffset === null ? "null" : anchorOffset
    }, type: ${anchor.type} }`;
  res += `\n  └ focus { key: ${focus.key}, offset: ${focusOffset === null ? "null" : focusOffset
    }, type: ${focus.type} }`;
  return res;
}

function printObjectSelection(selection: NodeSelection) {
  return `: node\n  └ [${Array.from(selection._nodes).join(", ")}]`;
}

function printGridSelection(selection: GridSelection) {
  return `: grid\n  └ { grid: ${selection.gridKey}, anchorCell: ${selection.anchorCellKey}, focusCell: ${selection.focusCellKey} }`;
}

function generateContent(editorState: EditorState) {
  let res = " root\n";
  const selectionString = editorState.read(() => {
    const selection = $getSelection() as
      | RangeSelection
      | GridSelection
      | NodeSelection;
    visitTree($getRoot(), (node: LexicalNode, indent: string[]) => {
      const nodeKey = node.getKey();
      const nodeKeyDisplay = `(${nodeKey})`;
      const typeDisplay = node.getType() || "";
      const isSelected = node.isSelected();
      res += `${isSelected ? SYMBOLS.selectedLine : " "} ${indent.join(
        " "
      )} ${nodeKeyDisplay} ${typeDisplay} ${printNode(node)}\n`;
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
        ? printRangeSelection(selection as RangeSelection)
        : $isGridSelection(selection)
          ? printGridSelection(selection as GridSelection)
          : printObjectSelection(selection as NodeSelection);
  });
  return res + "\n selection" + selectionString;
}

function visitTree(
  currentNode: ElementNode,
  visitor: (node: LexicalNode, indent: string[]) => void,
  indent: string[] = []
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
        childNode as ElementNode,
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

function printNode(node: LexicalNode) {
  if ($isTextNode(node)) {
    const text = node.getTextContent(true);
    const title = text.length === 0 ? "(empty)" : `"${normalize(text)}"`;
    const properties = printAllProperties(node as TextNode);
    return [title, properties.length !== 0 ? `{ ${properties} }` : null]
      .filter(Boolean)
      .join(" ")
      .trim();
  }

  return "";
}

const FORMAT_PREDICATES = [
  (node: TextNode) => node.hasFormat("bold") && "Bold",
  (node: TextNode) => node.hasFormat("code") && "Code",
  (node: TextNode) => node.hasFormat("italic") && "Italic",
  (node: TextNode) => node.hasFormat("strikethrough") && "Strikethrough",
  (node: TextNode) => node.hasFormat("underline") && "Underline",
];
const DETAIL_PREDICATES = [
  (node: TextNode) => node.isDirectionless() && "Directionless",
  (node: TextNode) => node.isUnmergeable() && "Unmergeable",
];
const MODE_PREDICATES = [
  (node: TextNode) => node.isToken() && "Token",
  (node: TextNode) => node.isSegmented() && "Segmented",
  (node: TextNode) => node.isInert() && "Inert",
];

function printAllProperties(node: TextNode) {
  return [
    printFormatProperties(node),
    printDetailProperties(node),
    printModeProperties(node),
  ]
    .filter(Boolean)
    .join(", ");
}

function printDetailProperties(nodeOrSelection: NodeOrSelection) {
  let str = DETAIL_PREDICATES.map((predicate) => predicate(nodeOrSelection))
    .filter(Boolean)
    .join(", ")
    .toLocaleLowerCase();

  if (str !== "") {
    str = "detail: " + str;
  }

  return str;
}

function printModeProperties(nodeOrSelection: NodeOrSelection) {
  let str = MODE_PREDICATES.map((predicate) => predicate(nodeOrSelection))
    .filter(Boolean)
    .join(", ")
    .toLocaleLowerCase();

  if (str !== "") {
    str = "mode: " + str;
  }

  return str;
}

function printFormatProperties(nodeOrSelection: NodeOrSelection) {
  let str = FORMAT_PREDICATES.map((predicate) => predicate(nodeOrSelection))
    .filter(Boolean)
    .join(", ")
    .toLocaleLowerCase();

  if (str !== "") {
    str = "format: " + str;
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
  indent: string[];
  isSelected: boolean;
  node: LexicalNode;
  nodeKeyDisplay: string;
  selection: RangeSelection | GridSelection | NodeSelection;
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
  } // No selected characters.

  //@ts-ignore
  const anchor = selection.anchor;
  //@ts-ignore
  const focus = selection.focus;

  if (
    node.getTextContent() === "" ||
    //@ts-ignore
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
  const unselectedChars = Array(start).fill(" ");
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

function $getSelectionStartEnd(
  node: LexicalNode,
  selection: RangeSelection | GridSelection | NodeSelection
) {
  //@ts-ignore
  const anchor = selection.anchor;
  //@ts-ignore
  const focus = selection.focus;
  const textContent = node.getTextContent(true);
  const textLength = textContent.length;
  let start = -1;
  let end = -1; // Only one node is being selected.

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
  } // Account for non-single width characters.

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
