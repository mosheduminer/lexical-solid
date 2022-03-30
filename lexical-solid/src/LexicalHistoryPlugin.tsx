import {
  $getSelection,
  $isRangeSelection,
  $isRootNode,
  $isTextNode,
  CommandListener,
  EditorState,
  GridSelection,
  LexicalEditor,
  NodeSelection,
  RangeSelection,
  TextNode,
  UpdateListener,
} from "lexical";
import { Accessor, createEffect, createMemo, JSX, on } from "solid-js";
import { useLexicalComposerContext } from "./LexicalComposerContext";
import { MaybeAccessor, resolve } from "./utils";
import withSubscriptions from "./withSubscriptions";
export type HistoryStateEntry = {
  editor: LexicalEditor;
  editorState: EditorState;
  undoSelection?: RangeSelection | NodeSelection | GridSelection | null;
};
export type HistoryState = {
  current: undefined | null | HistoryStateEntry;
  redoStack: Array<HistoryStateEntry>;
  undoStack: Array<HistoryStateEntry>;
};

const HISTORY_MERGE = 0;
const HISTORY_PUSH = 1;
const DISCARD_HISTORY_CANDIDATE = 2;
const OTHER = 0;
const COMPOSING_CHARACTER = 1;
const INSERT_CHARACTER_AFTER_SELECTION = 2;
const DELETE_CHARACTER_BEFORE_SELECTION = 3;
const DELETE_CHARACTER_AFTER_SELECTION = 4;
const EditorPriority = 0;

function getDirtyNodes(
  editorState: EditorState,
  dirtyLeavesSet: Set<string>,
  dirtyElementsSet: Map<string, boolean>
) {
  const dirtyLeaves = Array.from(dirtyLeavesSet);
  const dirtyElements = Array.from(dirtyElementsSet);
  const nodeMap = editorState._nodeMap;
  const nodes = [];

  for (let i = 0; i < dirtyLeaves.length; i++) {
    const dirtyLeafKey = dirtyLeaves[i];
    const dirtyLeaf = nodeMap.get(dirtyLeafKey);

    if (dirtyLeaf !== undefined) {
      nodes.push(dirtyLeaf);
    }
  }

  for (let i = 0; i < dirtyElements.length; i++) {
    const intentionallyMarkedAsDirty = dirtyElements[i][1];

    if (!intentionallyMarkedAsDirty) {
      continue;
    }

    const dirtyElementKey = dirtyElements[i][0];
    const dirtyElement = nodeMap.get(dirtyElementKey);

    if (dirtyElement !== undefined && !$isRootNode(dirtyElement)) {
      nodes.push(dirtyElement);
    }
  }

  return nodes;
}

function getChangeType(
  prevEditorState: EditorState,
  nextEditorState: EditorState,
  dirtyLeavesSet: Set<string>,
  dirtyElementsSet: Map<string, boolean>,
  isComposing: boolean,
) {
  if (
    prevEditorState === null ||
    (dirtyLeavesSet.size === 0 && dirtyElementsSet.size === 0)
  ) {
    return OTHER;
  }

  const nextSelection = nextEditorState._selection;
  const prevSelection = prevEditorState._selection;

  if (isComposing) {
    return COMPOSING_CHARACTER;
  }

  if (
    !$isRangeSelection(nextSelection) ||
    !$isRangeSelection(prevSelection) ||
    !(prevSelection as GridSelection | RangeSelection).isCollapsed() ||
    !(nextSelection as GridSelection | RangeSelection).isCollapsed()
  ) {
    return OTHER;
  }

  const dirtyNodes = getDirtyNodes(
    nextEditorState,
    dirtyLeavesSet,
    dirtyElementsSet
  );

  if (dirtyNodes.length === 0) {
    return OTHER;
  } // Catching the case when inserting new text node into an element (e.g. first char in paragraph/list),
  // or after existing node.

  if (dirtyNodes.length > 1) {
    const nextNodeMap = nextEditorState._nodeMap;
    const nextAnchorNode = nextNodeMap.get((nextSelection as GridSelection | RangeSelection).anchor.key);
    const prevAnchorNode = nextNodeMap.get((prevSelection as GridSelection | RangeSelection).anchor.key);

    if (
      nextAnchorNode &&
      prevAnchorNode &&
      !prevEditorState._nodeMap.has(nextAnchorNode.__key) &&
      $isTextNode(nextAnchorNode) &&
      (nextAnchorNode as TextNode).__text.length === 1 &&
      (nextSelection as GridSelection | RangeSelection).anchor.offset === 1
    ) {
      return INSERT_CHARACTER_AFTER_SELECTION;
    }

    return OTHER;
  }

  const nextDirtyNode = dirtyNodes[0];

  const prevDirtyNode = prevEditorState._nodeMap.get(nextDirtyNode.__key);

  if (
    !$isTextNode(prevDirtyNode) ||
    !$isTextNode(nextDirtyNode) ||
    (prevDirtyNode as TextNode).__mode !== (nextDirtyNode as TextNode).__mode
  ) {
    return OTHER;
  }

  const prevText = (prevDirtyNode as TextNode).__text;
  const nextText = (nextDirtyNode as TextNode).__text;

  if (prevText === nextText) {
    return OTHER;
  }

  const nextAnchor = (nextSelection as RangeSelection | GridSelection).anchor;
  const prevAnchor = (prevSelection as RangeSelection | GridSelection).anchor;

  if (nextAnchor.key !== prevAnchor.key || nextAnchor.type !== "text") {
    return OTHER;
  }

  const nextAnchorOffset = nextAnchor.offset;
  const prevAnchorOffset = prevAnchor.offset;
  const textDiff = nextText.length - prevText.length;

  if (textDiff === 1 && prevAnchorOffset === nextAnchorOffset - 1) {
    return INSERT_CHARACTER_AFTER_SELECTION;
  }

  if (textDiff === -1 && prevAnchorOffset === nextAnchorOffset + 1) {
    return DELETE_CHARACTER_BEFORE_SELECTION;
  }

  if (textDiff === -1 && prevAnchorOffset === nextAnchorOffset) {
    return DELETE_CHARACTER_AFTER_SELECTION;
  }

  return OTHER;
}

function createMergeActionGetter(editor: LexicalEditor, delay: number) {
  let prevChangeTime = Date.now();
  let prevChangeType = OTHER;
  return (
    prevEditorState: EditorState,
    nextEditorState: EditorState,
    currentHistoryEntry: HistoryStateEntry,
    dirtyLeaves: Set<string>,
    dirtyElements: Map<string, boolean>,
    tags: Set<string>,
  ) => {
    const changeTime = Date.now(); // If applying changes from history stack there's no need
    // to run history logic again, as history entries already calculated

    if (tags.has("historic")) {
      prevChangeType = OTHER;
      prevChangeTime = changeTime;
      return DISCARD_HISTORY_CANDIDATE;
    }

    const changeType = getChangeType(
      prevEditorState,
      nextEditorState,
      dirtyLeaves,
      dirtyElements,
      editor.isComposing()
    );

    const mergeAction = (() => {
      const shouldPushHistory = tags.has("history-push");
      const shouldMergeHistory =
        !shouldPushHistory && tags.has("history-merge");

      if (shouldMergeHistory) {
        return HISTORY_MERGE;
      }

      if (prevEditorState === null) {
        return HISTORY_PUSH;
      }

      const selection = nextEditorState._selection;
      const prevSelection = prevEditorState._selection;
      const hasDirtyNodes = dirtyLeaves.size > 0 || dirtyElements.size > 0;

      if (!hasDirtyNodes) {
        if (prevSelection === null && selection !== null) {
          return HISTORY_MERGE;
        }

        return DISCARD_HISTORY_CANDIDATE;
      }

      const isSameEditor =
        currentHistoryEntry === null || currentHistoryEntry.editor === editor;

      if (
        shouldPushHistory === false &&
        changeType !== OTHER &&
        changeType === prevChangeType &&
        changeTime < prevChangeTime + delay &&
        isSameEditor
      ) {
        return HISTORY_MERGE;
      }

      return HISTORY_PUSH;
    })();

    prevChangeTime = changeTime;
    prevChangeType = changeType;
    return mergeAction;
  };
}

function useHistory(
  editor: LexicalEditor,
  externalHistoryState: Accessor<HistoryState | undefined>,
  delay: MaybeAccessor<number> = 1000
) {
  const historyStateAccessor = createMemo(() => {
    return externalHistoryState() || createEmptyHistoryState()
  });
  const clearHistory = () => {
    const hs = historyStateAccessor();
    hs.undoStack = [];
    hs.redoStack = [];
    hs.current = null;
  };
  createEffect(on(() => [resolve(delay), editor, historyStateAccessor()], () => {
    const getMergeAction = createMergeActionGetter(editor, resolve(delay));
    const historyState = historyStateAccessor();

    const applyChange: UpdateListener = ({
      editorState,
      prevEditorState,
      dirtyLeaves,
      dirtyElements,
      tags,
    }) => {
      const current = historyState.current;
      const redoStack = historyState.redoStack;
      const undoStack = historyState.undoStack;
      const currentEditorState = current === null ? null : current!.editorState;

      if (current !== null && editorState === currentEditorState) {
        return;
      }

      const mergeAction = getMergeAction(
        prevEditorState,
        editorState,
        current!,
        dirtyLeaves,
        dirtyElements,
        tags
      );

      if (mergeAction === HISTORY_PUSH) {
        if (redoStack.length !== 0) {
          historyState.redoStack = [];
        }

        if (current !== null) {
          undoStack.push({
            ...current!,
            undoSelection: prevEditorState.read($getSelection),
          });
          editor.execCommand("canUndo", true);
        }
      } else if (mergeAction === DISCARD_HISTORY_CANDIDATE) {
        return;
      } // Else we merge

      historyState.current = {
        editor,
        editorState,
      };
    };

    const undo = () => {
      const redoStack = historyState.redoStack;
      const undoStack = historyState.undoStack;
      const undoStackLength = undoStack.length;

      if (undoStackLength !== 0) {
        const current = historyState.current;
        const historyStateEntry = undoStack.pop();

        if (current !== null) {
          redoStack.push(current!);
          editor.execCommand("canRedo", true);
        }

        if (undoStack.length === 0) {
          editor.execCommand("canUndo", false);
        }

        historyState.current = historyStateEntry;
        historyStateEntry!.editor.setEditorState(
          historyStateEntry!.editorState.clone(historyStateEntry!.undoSelection),
          {
            tag: "historic",
          }
        );
      }
    };

    const redo = () => {
      const redoStack = historyState.redoStack;
      const undoStack = historyState.undoStack;

      if (redoStack.length !== 0) {
        const current = historyState.current;

        if (current !== null) {
          undoStack.push(current!);
          editor.execCommand("canUndo", true);
        }

        const historyStateEntry = redoStack.pop();

        if (redoStack.length === 0) {
          editor.execCommand("canRedo", false);
        }

        historyState.current = historyStateEntry;
        historyStateEntry!.editor.setEditorState(historyStateEntry!.editorState, {
          tag: "historic",
        });
      }
    };

    const applyCommand: CommandListener = (type) => {
      switch (type) {
        case "undo":
          undo();
          return true;

        case "redo":
          redo();
          return true;

        case "clearEditor":
          clearHistory();
          return false;

        case "clearHistory":
          clearHistory();
          return true;

        default:
          return false;
      }
    };

    return withSubscriptions(
      editor.addListener("command", applyCommand, EditorPriority),
      editor.addListener("update", applyChange)
    );
  }));
}

export function HistoryPlugin(props: {
  externalHistoryState?: HistoryState;
}): JSX.Element {
  const [editor] = useLexicalComposerContext();
  useHistory(editor, () => props.externalHistoryState);
  return null;
}

export function createEmptyHistoryState(): HistoryState {
  return {
    current: null,
    redoStack: [],
    undoStack: [],
  };
}
