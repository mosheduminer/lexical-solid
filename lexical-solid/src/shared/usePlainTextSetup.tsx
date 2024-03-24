import { onCleanup } from "solid-js";
import { LexicalEditor } from "lexical";
import { registerDragonSupport } from "@lexical/dragon";
import { registerPlainText } from "@lexical/plain-text";
import { mergeRegister } from "@lexical/utils";
import { isServer } from "solid-js/web";

export function usePlainTextSetup(editor: LexicalEditor) {
  if (!isServer) {
    onCleanup(
      mergeRegister(registerPlainText(editor), registerDragonSupport(editor)) // We only do this for init
    );
  }
}
