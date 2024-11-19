import type { MenuRenderFn, MenuResolution } from "./shared/LexicalMenu";

import { useLexicalComposerContext } from "./LexicalComposerContext";
import {
  $getNodeByKey,
  COMMAND_PRIORITY_LOW,
  CommandListenerPriority,
  NodeKey,
  TextNode,
} from "lexical";
import {
  type JSX,
  createSignal,
  createEffect,
  startTransition,
  Show,
} from "solid-js";

import {
  LexicalMenu,
  MenuOption,
  useMenuAnchorRef,
} from "./shared/LexicalMenu";

export type NodeMenuPluginProps<TOption extends MenuOption> = {
  onSelectOption: (
    option: TOption,
    textNodeContainingQuery: TextNode | null,
    closeMenu: () => void,
    matchingString: string
  ) => void;
  options: Array<TOption>;
  nodeKey: NodeKey | null;
  onClose?: () => void;
  onOpen?: (resolution: MenuResolution) => void;
  menuRenderFn: MenuRenderFn<TOption>;
  anchorClassName?: string;
  commandPriority?: CommandListenerPriority;
  parent?: HTMLElement;
};

export function LexicalNodeMenuPlugin<TOption extends MenuOption>(
  props: NodeMenuPluginProps<TOption>
): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [resolution, setResolution] = createSignal<MenuResolution | null>(null);
  const anchorElementRef = useMenuAnchorRef(
    resolution,
    setResolution,
    props.anchorClassName,
    props.parent
  );

  const closeNodeMenu = () => {
    if (props.onClose != null && resolution() !== null) {
      props.onClose();
    }
    setResolution(null);
  };

  const openNodeMenu = (res: MenuResolution) => {
    if (props.onOpen != null && resolution() === null) {
      props.onOpen(res);
    }
    setResolution(res);
  };

  const positionOrCloseMenu = () => {
    if (props.nodeKey) {
      editor.update(() => {
        const node = $getNodeByKey(props.nodeKey!);
        const domElement = editor.getElementByKey(props.nodeKey!);
        if (node != null && domElement != null) {
          if (resolution == null) {
            startTransition(() =>
              openNodeMenu({
                getRect: () => domElement.getBoundingClientRect(),
              })
            );
          }
        }
      });
    } else if (props.nodeKey == null && resolution() != null) {
      closeNodeMenu();
    }
  };

  createEffect(positionOrCloseMenu);

  createEffect(() => {
    if (props.nodeKey != null) {
      return editor.registerUpdateListener(({ dirtyElements }) => {
        if (dirtyElements.get(props.nodeKey!)) {
          positionOrCloseMenu();
        }
      });
    }
  });

  return (
    <Show
      when={
        anchorElementRef.current && resolution() !== null && editor !== null
      }
    >
      <LexicalMenu
        close={closeNodeMenu}
        resolution={resolution()!}
        editor={editor}
        anchorElementRef={anchorElementRef}
        options={props.options}
        menuRenderFn={props.menuRenderFn}
        onSelectOption={props.onSelectOption}
        commandPriority={props.commandPriority ?? COMMAND_PRIORITY_LOW}
      />
    </Show>
  );
}

export { MenuOption, MenuRenderFn, MenuResolution };
