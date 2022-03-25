import { useLexicalComposerContext, LexicalTreeView } from "lexical-solid";

export default function TreeViewPlugin() {
  const [editor] = useLexicalComposerContext();
  return (
    <LexicalTreeView
      viewClassName="tree-view-output"
      timeTravelPanelClassName="debug-timetravel-panel"
      timeTravelButtonClassName="debug-timetravel-button"
      timeTravelPanelSliderClassName="debug-timetravel-panel-slider"
      timeTravelPanelButtonClassName="debug-timetravel-panel-button"
      editor={editor}
    />
  );
}
