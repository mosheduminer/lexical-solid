import { onCleanup } from "solid-js";
import { LexicalEditor } from "lexical";
import { isServer } from "solid-js/web";
import { registerRichText } from "@lexical/rich-text";
import { mergeRegister } from "@lexical/utils";
import { registerDragonSupport } from "@lexical/dragon";
import { InitialEditorStateType } from "@lexical/rich-text";

function useRichTextSetup(
  editor: LexicalEditor,
  initialEditorState?: InitialEditorStateType
) {
  if (!isServer) {
    onCleanup(
      mergeRegister(
        registerRichText(editor, initialEditorState),
        registerDragonSupport(editor)
      ) // We only do this for init
    );
  }
}

export default useRichTextSetup;
