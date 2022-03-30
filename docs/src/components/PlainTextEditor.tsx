import { $getRoot, $getSelection, EditorState } from "lexical";

import ExampleTheme from "../themes/PlainTextTheme";
import {
  OnChangePlugin,
  LexicalComposer,
  ContentEditable,
  PlainTextPlugin,
  useLexicalComposerContext,
} from "lexical-solid";
import { HistoryPlugin } from "lexical-solid";
import TreeViewPlugin from "../plugins/TreeViewPlugin";
import { onMount } from "solid-js";
//import { EmojiNode } from "./nodes/EmojiNode";
//import EmoticonPlugin from "./plugins/EmoticonPlugin";

function Placeholder() {
  return <div class="editor-placeholder">Enter some plain text...</div>;
}

// When the editor changes, you can get notified via the
// LexicalOnChangePlugin!
function onChange(editorState: EditorState) {
  editorState.read(() => {
    // Read the contents of the EditorState here.
    const root = $getRoot();
    const selection = $getSelection();

    console.log(root, selection);
  });
}

// Lexical React plugins are React components, which makes them
// highly composable. Furthermore, you can lazy load plugins if
// desired, so you don't pay the cost for plugins until you
// actually use them.
function MyCustomAutoFocusPlugin() {
  const [editor] = useLexicalComposerContext();

  onMount(() => {
    // Focus the editor when the effect fires!
    editor.focus();
  });

  return null;
}

const editorConfig = {
  // The editor theme
  theme: ExampleTheme,
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
      <div className="editor-container">
        <PlainTextPlugin
          contentEditable={<ContentEditable className="editor-input" />}
          placeholder={<Placeholder />}
        />
        <OnChangePlugin onChange={onChange} />
        <HistoryPlugin />
        <TreeViewPlugin />
        {/*<EmoticonPlugin />*/}
        <MyCustomAutoFocusPlugin />
      </div>
    </LexicalComposer>
  );
}
