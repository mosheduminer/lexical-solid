import {
  LexicalNode,
  MutationListener,
  $getNodeByKey,
  $getSelection,
  COMMAND_PRIORITY_EDITOR,
  createCommand,
  LexicalCommand,
  LexicalEditor,
  NodeKey,
  TextNode,
} from "lexical";
import { $isLinkNode, AutoLinkNode, LinkNode } from "@lexical/link";
import { useLexicalComposerContext } from "./LexicalComposerContext";
import {
  LexicalNodeMenuPlugin,
  MenuRenderFn,
  TypeaheadOption,
} from "./LexicalTypeaheadMenuPlugin";
import { mergeRegister } from "@lexical/utils";
import {
  createEffect,
  createMemo,
  createSignal,
  JSX,
  Show,
  onCleanup,
} from "solid-js";

export type EmbedMatchResult<TEmbedMatchResult = unknown> = {
  url: string;
  id: string;
  data?: TEmbedMatchResult;
};

export interface EmbedConfig<
  TEmbedMatchResultData = unknown,
  TEmbedMatchResult = EmbedMatchResult<TEmbedMatchResultData>
> {
  // Used to identify this config e.g. youtube, tweet, google-maps.
  type: string;
  // Determine if a given URL is a match and return url data.
  parseUrl: (
    text: string
  ) => Promise<TEmbedMatchResult | null> | TEmbedMatchResult | null;
  // Create the Lexical embed node from the url data.
  insertNode: (editor: LexicalEditor, result: TEmbedMatchResult) => void;
}

export const URL_MATCHER =
  /((https?:\/\/(www\.)?)|(www\.))[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/;

export const INSERT_EMBED_COMMAND: LexicalCommand<EmbedConfig["type"]> =
  createCommand("INSERT_EMBED_COMMAND");

export class AutoEmbedOption extends TypeaheadOption {
  title: string;
  onSelect: (targetNode: LexicalNode | null) => void;
  constructor(
    title: string,
    options: {
      onSelect: (targetNode: LexicalNode | null) => void;
    }
  ) {
    super(title);
    this.title = title;
    this.onSelect = options.onSelect.bind(this);
  }
}

type LexicalAutoEmbedPluginProps<TEmbedConfig extends EmbedConfig> = {
  embedConfigs: Array<TEmbedConfig>;
  onOpenEmbedModalForConfig: (embedConfig: TEmbedConfig) => void;
  getMenuOptions: (
    activeEmbedConfig: TEmbedConfig,
    embedFn: () => void,
    dismissFn: () => void
  ) => Array<AutoEmbedOption>;
  menuRenderFn: MenuRenderFn<AutoEmbedOption>;
};

export function LexicalAutoEmbedPlugin<TEmbedConfig extends EmbedConfig>(
  props: LexicalAutoEmbedPluginProps<TEmbedConfig>
): JSX.Element | null {
  const [editor] = useLexicalComposerContext();

  const [nodeKey, setNodeKey] = createSignal<NodeKey | null>(null);
  const [activeEmbedConfig, setActiveEmbedConfig] =
    createSignal<TEmbedConfig | null>(null);

  const reset = () => {
    setNodeKey(null);
    setActiveEmbedConfig(null);
  };

  const checkIfLinkNodeIsEmbeddable = (key: NodeKey) => {
    editor.getEditorState().read(async () => {
      const linkNode = $getNodeByKey(key);
      if ($isLinkNode(linkNode)) {
        for (let i = 0; i < props.embedConfigs.length; i++) {
          const embedConfig = props.embedConfigs[i];

          const urlMatch = await Promise.resolve(
            embedConfig.parseUrl(linkNode.__url)
          );

          if (urlMatch != null) {
            setActiveEmbedConfig(() => embedConfig);
            setNodeKey(linkNode.getKey());
          }
        }
      }
    });
  };

  createEffect(() => {
    const listener: MutationListener = (
      nodeMutations,
      { updateTags, dirtyLeaves }
    ) => {
      for (const [key, mutation] of nodeMutations) {
        if (
          mutation === "created" &&
          updateTags.has("paste") &&
          dirtyLeaves.size === 1
        ) {
          checkIfLinkNodeIsEmbeddable(key);
        } else if (key === nodeKey()) {
          reset();
        }
      }
    };
    onCleanup(
      mergeRegister(
        ...[LinkNode, AutoLinkNode].map((Klass) =>
          editor.registerMutationListener(Klass, (...args) => listener(...args))
        )
      )
    );
  });

  createEffect(() => {
    onCleanup(
      editor.registerCommand(
        INSERT_EMBED_COMMAND,
        (embedConfigType: TEmbedConfig["type"]) => {
          const embedConfig = props.embedConfigs.find(
            ({ type }) => type === embedConfigType
          );
          if (embedConfig) {
            props.onOpenEmbedModalForConfig(embedConfig);
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_EDITOR
      )
    );
  });

  const embedLinkViaActiveEmbedConfig = async () => {
    if (activeEmbedConfig() != null && nodeKey() != null) {
      const linkNode = editor.getEditorState().read(() => {
        const node = $getNodeByKey(nodeKey()!);
        if ($isLinkNode(node)) {
          return node;
        }
        return null;
      });

      if ($isLinkNode(linkNode)) {
        const result = await Promise.resolve(
          activeEmbedConfig()!.parseUrl(linkNode.__url)
        );
        if (result != null) {
          editor.update(() => {
            if (!$getSelection()) {
              linkNode.selectEnd();
            }
            activeEmbedConfig()!.insertNode(editor, result);
            if (linkNode.isAttached()) {
              linkNode.remove();
            }
          });
        }
      }
    }
  };

  const options = createMemo(() => {
    return activeEmbedConfig() != null && nodeKey() != null
      ? props.getMenuOptions(
          activeEmbedConfig()!,
          embedLinkViaActiveEmbedConfig,
          reset
        )
      : [];
  });

  const onSelectOption = (
    selectedOption: AutoEmbedOption,
    targetNode: TextNode | null,
    closeMenu: () => void
  ) => {
    editor.update(() => {
      selectedOption.onSelect(targetNode);
      closeMenu();
    });
  };

  return (
    <Show when={nodeKey() != null}>
      <LexicalNodeMenuPlugin<AutoEmbedOption>
        nodeKey={nodeKey()}
        onClose={reset}
        onSelectOption={onSelectOption}
        options={options()}
        menuRenderFn={props.menuRenderFn}
      />
    </Show>
  );
}
