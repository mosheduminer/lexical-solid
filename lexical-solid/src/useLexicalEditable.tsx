import { LexicalSubscription } from "./useLexicalSubscription";
import { useLexicalSubscription } from "./useLexicalSubscription";
import { LexicalEditor } from "lexical";
import { Accessor } from "solid-js";

function subscription(editor: LexicalEditor): LexicalSubscription<boolean> {
  return {
    initialValueFn: () => editor.isEditable(),
    subscribe: (callback) => {
      return editor.registerEditableListener(callback);
    },
  };
}

export function useLexicalEditable(): Accessor<boolean> {
  return useLexicalSubscription(subscription);
}
