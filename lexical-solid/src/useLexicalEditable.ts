import { LexicalSubscription } from "./useLexicalSubscription";
import { useLexicalSubscription } from "./useLexicalSubscription";
import { LexicalEditor } from "lexical";

function subscription(editor: LexicalEditor): LexicalSubscription<boolean> {
  return {
    initialValueFn: () => editor.isEditable(),
    subscribe: (callback) => {
      return editor.registerEditableListener(callback);
    },
  };
}

export function useLexicalEditable(): boolean {
  return useLexicalSubscription(subscription);
}
