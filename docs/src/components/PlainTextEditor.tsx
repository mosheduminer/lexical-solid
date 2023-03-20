import { $getRoot, $getSelection, EditorState, LexicalEditor } from "lexical";

import ExampleTheme from "../themes/PlainTextTheme";
import { OnChangePlugin } from "lexical-solid/LexicalOnChangePlugin";
import { AutoFocusPlugin } from "lexical-solid/LexicalAutoFocusPlugin";
import { LexicalComposer } from "lexical-solid/LexicalComposer";
import { PlainTextPlugin } from "lexical-solid/LexicalPlainTextPlugin";
import { ContentEditable } from "lexical-solid/LexicalContentEditable";
import { HistoryPlugin } from "lexical-solid/LexicalHistoryPlugin";
import { LexicalErrorBoundary } from "lexical-solid/LexicalErrorBoundary";
import TreeViewPlugin from "~/plugins/TreeViewPlugin";

//import { EmojiNode } from "./nodes/EmojiNode";
//import EmoticonPlugin from "./plugins/EmoticonPlugin";

function Placeholder() {
  return <div class="editor-placeholder">Enter some plain text...</div>;
}

// When the editor changes, you can get notified via the
// LexicalOnChangePlugin!
function onChange(editorState: EditorState, tags: Set<string>, editor: LexicalEditor) {
  editorState.read(() => {
    // Read the contents of the EditorState here.
    const root = $getRoot();
    const selection = $getSelection();

    console.log(root, selection);
  });
}

const editorConfig = {
  // The editor theme
  theme: ExampleTheme,
  namespace: "",
  // Handling of errors during update
  onError(error: any) {
    throw error;
  },
  // Any custom nodes go here
  //nodes: [EmojiNode]
};

export default function Editor() {
  return (
    <LexicalComposer initialConfig={editorConfig}>
      <div class="editor-container">
        <PlainTextPlugin
          contentEditable={<ContentEditable class="editor-input" />}
          placeholder={<Placeholder />}
          errorBoundary={LexicalErrorBoundary}
        />
        <OnChangePlugin onChange={onChange} />
        <HistoryPlugin />
        <TreeViewPlugin />
        {/*<EmoticonPlugin />*/}
        <AutoFocusPlugin />
      </div>
    </LexicalComposer>
  );
}
