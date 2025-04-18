import type { EditorSetOptions, EditorState } from "lexical";
import { JSX, createEffect, createSignal } from "solid-js";
import type { LexicalCommandLog } from "./useLexicalCommandsLog";

const LARGE_EDITOR_STATE_SIZE = 1000;

export const TreeView = (props: {
  editorState: EditorState;
  treeTypeButtonClassName?: string;
  timeTravelButtonClassName?: string;
  timeTravelPanelButtonClassName?: string;
  timeTravelPanelClassName?: string;
  timeTravelPanelSliderClassName?: string;
  viewClassName?: string;
  generateContent: (exportDOM: boolean) => Promise<string>;
  setEditorState: (state: EditorState, options?: EditorSetOptions) => void;
  setEditorReadOnly: (isReadonly: boolean) => void;
  commandsLog?: LexicalCommandLog;
  ref: (_: HTMLPreElement) => void;
}): JSX.Element => {
  const [timeStampedEditorStates, setTimeStampedEditorStates] = createSignal<
    Array<[number, EditorState]>
  >([]);
  const [content, setContent] = createSignal<string>("");
  const [timeTravelEnabled, setTimeTravelEnabled] = createSignal(false);
  const [showExportDOM, setShowExportDOM] = createSignal(false);
  let playingIndexRef = 0;
  let inputRef: HTMLInputElement | undefined;
  const [isPlaying, setIsPlaying] = createSignal(false);
  const [isLimited, setIsLimited] = createSignal(false);
  const [showLimited, setShowLimited] = createSignal(false);
  let lastEditorStateRef: EditorState | null | undefined = null;
  let lastCommandsLogRef: LexicalCommandLog | null | undefined = [];
  let lastGenerationID = 0;

  const generateTree = (exportDOM: boolean) => {
    const myID = ++lastGenerationID;
    props
      .generateContent(exportDOM)
      .then((treeText) => {
        if (myID === lastGenerationID) {
          setContent(treeText);
        }
      })
      .catch((err) => {
        if (myID === lastGenerationID) {
          setContent(
            `Error rendering tree: ${err.message}\n\nStack:\n${err.stack}`
          );
        }
      });
  };

  createEffect(() => {
    if (
      !showLimited() &&
      props.editorState._nodeMap.size > LARGE_EDITOR_STATE_SIZE
    ) {
      setIsLimited(true);
      if (!showLimited()) {
        return;
      }
    }

    // Update view when either editor state changes or new commands are logged
    const shouldUpdate =
      lastEditorStateRef !== props.editorState ||
      lastCommandsLogRef !== props.commandsLog;

    if (shouldUpdate) {
      // Check if it's a real editor state change
      const isEditorStateChange = lastEditorStateRef !== props.editorState;
      lastEditorStateRef = props.editorState;
      lastCommandsLogRef = props.commandsLog;
      generateTree(showExportDOM());

      // Only record in time travel if there was an actual editor state change
      if (!timeTravelEnabled() && isEditorStateChange) {
        setTimeStampedEditorStates((currentEditorStates) => [
          ...currentEditorStates,
          [Date.now(), props.editorState],
        ]);
      }
    }
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

        const currentTime = timeStampedEditorStates()[currentIndex][0];
        const nextTime = timeStampedEditorStates()[currentIndex + 1][0];
        const timeDiff = nextTime - currentTime;
        timeoutId = setTimeout(() => {
          playingIndexRef++;
          const index = playingIndexRef;
          const input = inputRef;

          if (input != null) {
            input.value = String(index);
          }

          props.setEditorState(timeStampedEditorStates()[index][1]);
          play();
        }, timeDiff);
      };

      play();

      return () => {
        clearTimeout(timeoutId);
      };
    }
  });

  const handleExportModeToggleClick = () => {
    generateTree(!showExportDOM());
    setShowExportDOM(!showExportDOM());
  };

  return (
    <div class={props.viewClassName}>
      {!showLimited() && isLimited() ? (
        <div style={{ padding: "20px" }}>
          <span style={{ "margin-right": "20px" }}>
            Detected large EditorState, this can impact debugging performance.
          </span>
          <button
            onClick={() => {
              setShowLimited(true);
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
          onClick={() => handleExportModeToggleClick()}
          class={props.treeTypeButtonClassName}
          type="button"
        >
          {showExportDOM() ? "Tree" : "Export DOM"}
        </button>
      ) : null}
      {!timeTravelEnabled() &&
        (showLimited() || !isLimited()) &&
        totalEditorStates() > 2 && (
          <button
            onClick={() => {
              props.setEditorReadOnly(true);
              playingIndexRef = totalEditorStates() - 1;
              setTimeTravelEnabled(true);
            }}
            class={props.timeTravelButtonClassName}
            type="button"
          >
            Time Travel
          </button>
        )}
      {(showLimited() || !isLimited()) && (
        <pre ref={props.ref}>{content()}</pre>
      )}
      {timeTravelEnabled() && (showLimited() || !isLimited()) && (
        <div class={props.timeTravelPanelClassName}>
          <button
            class={props.timeTravelPanelButtonClassName}
            onClick={() => {
              if (playingIndexRef === totalEditorStates() - 1) {
                playingIndexRef = 1;
              }
              setIsPlaying(!isPlaying());
            }}
            type="button"
          >
            {isPlaying() ? "Pause" : "Play"}
          </button>
          <input
            class={props.timeTravelPanelSliderClassName}
            ref={inputRef}
            onChange={(event) => {
              const editorStateIndex = Number(event.target.value);
              const timeStampedEditorState =
                timeStampedEditorStates()[editorStateIndex];

              if (timeStampedEditorState) {
                playingIndexRef = editorStateIndex;
                props.setEditorState(timeStampedEditorState[1]);
              }
            }}
            type="range"
            min="1"
            max={totalEditorStates() - 1}
          />
          <button
            class={props.timeTravelPanelButtonClassName}
            onClick={() => {
              props.setEditorReadOnly(false);
              const index = timeStampedEditorStates().length - 1;
              const timeStampedEditorState = timeStampedEditorStates()[index];
              props.setEditorState(timeStampedEditorState[1]);
              const input = inputRef;

              if (input != null) {
                input.value = String(index);
              }

              setTimeTravelEnabled(false);
              setIsPlaying(false);
            }}
            type="button"
          >
            Exit
          </button>
        </div>
      )}
    </div>
  );
};
