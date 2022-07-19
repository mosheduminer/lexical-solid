import { onCleanup } from "solid-js";
import { LexicalEditor } from "lexical";
import { registerDragonSupport } from "@lexical/dragon";
import plainText from "@lexical/plain-text";
import { mergeRegister } from "@lexical/utils";
import { isServer } from "solid-js/web";

import { InitialEditorStateType } from "lexical-solid/shared/PlainRichTextUtils";

export function usePlainTextSetup(
  editor: LexicalEditor,
  initialEditorState?: InitialEditorStateType
) {
  if (!isServer) {
    onCleanup(
      mergeRegister(
        plainText.registerPlainText(editor, initialEditorState),
        registerDragonSupport(editor)
      ) // We only do this for init
    );
  }
}