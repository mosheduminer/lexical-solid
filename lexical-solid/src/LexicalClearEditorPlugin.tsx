import { useLexicalComposerContext } from "./LexicalComposerContext";
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  CLEAR_EDITOR_COMMAND,
  COMMAND_PRIORITY_EDITOR,
} from "lexical";
import { JSX, onCleanup } from "solid-js";

type Props = Readonly<{
  onClear?: () => void;
}>;

export function ClearEditorPlugin(props: Props): JSX.Element {
  const [editor] = useLexicalComposerContext();
  onCleanup(
    editor.registerCommand(
      CLEAR_EDITOR_COMMAND,
      (_payload) => {
        editor.update(() => {
          if (props.onClear == null) {
            const root = $getRoot();
            const selection = $getSelection();
            const paragraph = $createParagraphNode();
            root.clear();
            root.append(paragraph);
            if (selection !== null) {
              paragraph.select();
            }
          } else {
            props.onClear();
          }
        });
        return true;
      },
      COMMAND_PRIORITY_EDITOR
    )
  );
  return null;
}
