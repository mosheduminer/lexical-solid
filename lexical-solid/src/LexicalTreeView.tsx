import type {
  EditorState,
  ElementNode,
  GridSelection,
  LexicalEditor,
  LexicalNode,
  NodeSelection,
  RangeSelection,
  TextNode,
} from "lexical";

import { $isMarkNode } from "@lexical/mark";
import {
  $getRoot,
  $getSelection,
  $isElementNode,
  $isGridSelection,
  $isRangeSelection,
  $isTextNode,
} from "lexical";
import { createEffect, createSignal, JSX, onCleanup } from "solid-js";
import { $isLinkNode, LinkNode } from "@lexical/link";

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
  let playingIndexRef = 0;
  let treeElementRef!: HTMLPreElement;
  let inputRef!: HTMLInputElement;
  const [isPlaying, setIsPlaying] = createSignal(false);
  createEffect(() => {
    setContent(generateContent(props.editor.getEditorState()));
    onCleanup(
      props.editor.registerUpdateListener(({ editorState }) => {
        const compositionKey = props.editor._compositionKey;
        const treeText = generateContent(props.editor.getEditorState());
        const compositionText =
          compositionKey !== null && `Composition key: ${compositionKey}`;
        setContent([treeText, compositionText].filter(Boolean).join("\n\n"));
        if (!timeTravelEnabled()) {
          setTimeStampedEditorStates((currentEditorStates) => [
            ...currentEditorStates,
            [Date.now(), editorState],
          ]);
        }
      })
    );
  });
  const totalEditorStates = () => timeStampedEditorStates().length;

  createEffect(() => {
    if (isPlaying()) {
      let timeoutId: ReturnType<typeof setTimeout>;

      const play = () => {
        const currentIndex = playingIndexRef;
        if (currentIndex === totalEditorStates() - 1) {
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
        }, timeDiff) as unknown as number;
      };

      play();
      onCleanup(() => clearTimeout(timeoutId));
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
    <div class={props.viewClass}>
      {!timeTravelEnabled() && totalEditorStates() > 2 && (
        <button
          onClick={() => {
            const rootElement = props.editor.getRootElement();
            if (rootElement !== null) {
              rootElement.contentEditable = "false";
              playingIndexRef = totalEditorStates() - 1;
              setTimeTravelEnabled(true);
            }
          }}
          class={props.timeTravelButtonClass}
          type="button"
        >
          Time Travel
        </button>
      )}
      <pre ref={treeElementRef}>{content()}</pre>
      {timeTravelEnabled() && (
        <div class={props.timeTravelPanelClass}>
          <button
            class={props.timeTravelPanelButtonClass}
            onClick={() => {
              setIsPlaying(!isPlaying());
            }}
          >
            {isPlaying() ? "Pause" : "Play"}
          </button>
          <input
            class={props.timeTravelPanelSliderClass}
            ref={inputRef}
            onInput={(event) => {
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
            max={totalEditorStates() - 1}
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

function printRangeSelection(selection: RangeSelection): string {
  let res = "";

  //@ts-ignore
  const formatText = printFormatProperties(selection);
  res += `: range ${formatText !== "" ? `{ ${formatText} }` : ""}`;

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

function printObjectSelection(selection: NodeSelection): string {
  return `: node\n  └ [${Array.from(selection._nodes).join(", ")}]`;
}

function printGridSelection(selection: GridSelection): string {
  return `: grid\n  └ { grid: ${selection.gridKey}, anchorCell: ${selection.anchor.key}, focusCell: ${selection.focus.key} }`;
}

function generateContent(editorState: EditorState): string {
  let res = " root\n";

  const selectionString = editorState.read(() => {
    const selection = $getSelection() as RangeSelection | GridSelection;

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
      : $isGridSelection(selection)
      ? printGridSelection(selection)
      : printObjectSelection(selection);
  });

  return res + "\n selection" + selectionString;
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

function printNode(node: LexicalNode) {
  if ($isTextNode(node)) {
    const text = node.getTextContent(true);
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
  }

  return "";
}

const FORMAT_PREDICATES = [
  (node: TextNode) => node.hasFormat("bold") && "Bold",
  (node: TextNode) => node.hasFormat("code") && "Code",
  (node: TextNode) => node.hasFormat("italic") && "Italic",
  (node: TextNode) => node.hasFormat("strikethrough") && "Strikethrough",
  (node: TextNode) => node.hasFormat("subscript") && "Subscript",
  (node: TextNode) => node.hasFormat("superscript") && "Superscript",
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

function printAllTextNodeProperties(node: TextNode) {
  return [
    printFormatProperties(node),
    printDetailProperties(node),
    printModeProperties(node),
  ]
    .filter(Boolean)
    .join(", ");
}

function printAllLinkNodeProperties(node: LinkNode) {
  return [printTargetProperties(node), printRelProperties(node)]
    .filter(Boolean)
    .join(", ");
}

function printDetailProperties(nodeOrSelection: TextNode) {
  let str = DETAIL_PREDICATES.map((predicate) => predicate(nodeOrSelection))
    .filter(Boolean)
    .join(", ")
    .toLocaleLowerCase();
  if (str !== "") {
    str = "detail: " + str;
  }
  return str;
}

function printModeProperties(nodeOrSelection: TextNode) {
  let str = MODE_PREDICATES.map((predicate) => predicate(nodeOrSelection))
    .filter(Boolean)
    .join(", ")
    .toLocaleLowerCase();
  if (str !== "") {
    str = "mode: " + str;
  }
  return str;
}

function printFormatProperties(nodeOrSelection: TextNode) {
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
  selection: RangeSelection | GridSelection
): [number, number] {
  const anchor = selection.anchor;
  const focus = selection.focus;
  const textContent = node.getTextContent(true);
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

export default TreeView;
