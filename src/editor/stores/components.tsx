import { CSSProperties } from 'react';
import { create, StateCreator } from 'zustand';
import { persist } from 'zustand/middleware';
import * as jsonPatch from 'fast-json-patch';
import type { Operation } from 'fast-json-patch';


export interface Component {
  id: number;          // 唯一标识符
  name: string;        // 组件名称（如 Button、Input）
  props: any;          // 属性对象
  styles?: CSSProperties; // 样式对象（可选）
  desc: string;        // 描述信息
  children?: Component[]; // 子组件列表（可选）
  parentId?: number;   // 父组件 ID（可选）
}


// 历史记录条目基础信息
interface HistoryEntryBase {
  timestamp: number;   // 时间戳
  description: string; // 操作描述
}


// 初始快照历史条目
interface InitialHistoryEntry extends HistoryEntryBase {
  type: 'initial';
  snapshot: Component[]; // 初始组件快照
}


// 补丁类型的历史条目
interface PatchHistoryEntry extends HistoryEntryBase {
  type: 'patch';
  forwardPatch: Operation[];  // 正向补丁操作
  reversePatch: Operation[];  // 反向补丁操作（用于撤销）
}

// 历史条目的联合类型
type HistoryEntry = InitialHistoryEntry | PatchHistoryEntry;


interface State {
  components: Component[];       // 当前组件树
  mode: 'edit' | 'preview';      // 编辑或预览模式
  curComponentId?: number | null; // 当前选中组件 ID
  curComponent: Component | null; // 当前选中组件对象
  history: HistoryEntry[];       // 历史记录
  historyIndex: number;          // 当前历史索引
  copyComponent: Component | null; // 复制的组件
}


interface Action {
  addComponent: (component: Component, parentId?: number) => void; // 添加组件
  deleteComponent: (componentId: number) => void;                 // 删除组件
  updateComponentProps: (componentId: number, props: any) => void; // 更新属性
  updateComponentStyles: (componentId: number, styles: CSSProperties, replace?: boolean) => void; // 更新样式
  setCurComponentId: (componentId: number | null) => void;        // 设置当前组件 ID
  setMode: (mode: State['mode']) => void;                         // 设置模式
  undo: () => void;                                               // 撤销
  redo: () => void;                                               // 重做
  setComponents: (components: Component[]) => void;               // 设置组件树
  jumpToHistory: (index: number) => void;                         // 跳转到指定历史版本
  copyComponentToClipboard: (componentId: number) => void;                   // 复制组件
  pasteComponent: (parentId?: number) => void;                    // 粘贴组件
}


//生成补丁描述
function generatePatchDescription(patch: Operation[]): string {
  if (!patch || patch.length === 0) {
    return "No change";
  }

  let added = 0;
  let removed = 0;
  let updated = 0;
  let moved = 0;
  let other = 0;

  for (const op of patch) {

    const isComponentAdd = op.op === 'add' && (op.path.endsWith('/children/-') || op.path.match(/^\/\d+$/) || op.path === '/-');
    const isComponentRemove = op.op === 'remove' && (op.path.includes('/children/') || op.path.match(/^\/\d+$/));

    if (isComponentAdd) added++;
    else if (isComponentRemove) removed++;
    else if (op.op === 'replace') updated++;
    else if (op.op === 'move') moved++;
    else if (op.op === 'add') updated++; 
    else if (op.op === 'remove') updated++; 
    else other++;
  }

  const parts: string[] = [];
  if (added > 0) parts.push(`Added ${added} item(s)`);
  if (removed > 0) parts.push(`Removed ${removed} item(s)`);
  if (updated > 0) parts.push(`Updated ${updated} item(s)`);
  if (moved > 0) parts.push(`Moved ${moved} item(s)`);
  if (other > 0) parts.push(`Other ${other} changes`);

  let description = parts.join(', ');
  if (description.length > 50) {
    description = `${patch.length} operation(s)`; 
  }
  if (patch.length === 1 && patch[0].op === 'replace' && patch[0].path.includes('/props/')) {
    description = "Updated props";
  } else if (patch.length === 1 && patch[0].op === 'replace' && patch[0].path.includes('/styles/')) {
    description = "Updated styles";
  }

  return description || "Change detected";
}


//获取组件Id
export function getComponentById(
  id: number | null,
  components: Component[]
): Component | null {
  if (!id) return null;
  for (const component of components) {
    if (component.id === id) {
      return component;
    }
    if (component.children && component.children.length > 0) {
      const result = getComponentById(id, component.children);
      if (result !== null) {
        return result;
      }
    }
  }
  return null;
}


const creator: StateCreator<State & Action> = (set, get) => {
   // 根据历史索引重建组件状态
  const reconstructStateAtIndex = (index: number): Component[] => {
    const { history } = get();
    if (index < 0 || index >= history.length) {
      throw new Error(`History index ${index} out of bounds (0-${history.length - 1})`);
    }

    const initialEntry = history[0];
    if (initialEntry.type !== 'initial') {
      throw new Error("History must start with an initial snapshot entry.");
    }


    let reconstructedState = JSON.parse(JSON.stringify(initialEntry.snapshot));
    for (let i = 1; i <= index; i++) {
      const entry = history[i];
      if (entry.type === 'patch') {
        try {
          reconstructedState = jsonPatch.applyPatch(reconstructedState, entry.forwardPatch, true, false).newDocument;
        } catch (error) {
          console.error(`Error applying patch at history index ${i}:`, error);
          console.error("Patch:", JSON.stringify(entry.forwardPatch));
          console.error("State before patch:", JSON.stringify(reconstructedState));
          throw new Error(`Failed to apply history patch at index ${i}. History might be corrupted.`);
        }
      } else {
        throw new Error(`Invalid history structure: Found non-patch entry at index ${i}`);
      }
    }
    return reconstructedState;
  };

   // 保存历史记录
  const saveHistoryInternal = (previousState: Component[]) => {
    const { components: nextState, history, historyIndex } = get();


    const prevStateCopy = JSON.parse(JSON.stringify(previousState));
    const nextStateCopy = JSON.parse(JSON.stringify(nextState));

    const forwardPatch = jsonPatch.compare(prevStateCopy, nextStateCopy);
    const reversePatch = jsonPatch.compare(nextStateCopy, prevStateCopy);

    if (forwardPatch.length === 0) {
      return;
    }

    const description = generatePatchDescription(forwardPatch);
    const newHistory = history.slice(0, historyIndex + 1);

    const newEntry: PatchHistoryEntry = {
      type: 'patch',
      timestamp: Date.now(),
      description: description,
      forwardPatch,
      reversePatch,
    };

    newHistory.push(newEntry);

    set({
      history: newHistory,
      historyIndex: newHistory.length - 1,
    }, false);
  };

  //页面初始状态
  const initialComponents: Component[] = [
    {
      id: 1,
      name: 'Page',
      props: { style: { width: '100%', minHeight: '80vh', backgroundColor: '#ffffff' } },
      desc: '页面根节点',
      children: [],
    }
  ];

  //初始历史记录
  const initialHistoryEntry: InitialHistoryEntry = {
    type: 'initial',
    snapshot: JSON.parse(JSON.stringify(initialComponents)),
    timestamp: Date.now(),
    description: "Initial state",
  };

  return {

    // --- State ---
    components: initialComponents,
    curComponentId: null,
    curComponent: null,
    copyComponent: null,
    mode: 'edit',
    history: [initialHistoryEntry],
    historyIndex: 0,



    // --- Actions ---
    setMode: (mode) => set({ mode }),

    setCurComponentId: (componentId) => {
      set((state) => ({
        curComponentId: componentId,
        curComponent: getComponentById(componentId, state.components),
      }));
    },


    // 添加组件
    addComponent: (component, parentId) => {
      const previousState = JSON.parse(JSON.stringify(get().components));
      set((state) => {
        const newComponents = JSON.parse(JSON.stringify(state.components));
        const newComponent = { ...component, id: Date.now() };
        if (parentId) {
          const parentComponent = getComponentById(parentId, newComponents);
          if (parentComponent) {
            newComponent.parentId = parentId;
            if (!parentComponent.children) {
              parentComponent.children = [];
            }
            parentComponent.children.push(newComponent);
          } else {
            console.warn(`Parent component with ID ${parentId} not found. Adding to root.`);
            newComponents.push(newComponent); 
          }
        } else {
          newComponents.push(newComponent); 
        }
        return { components: newComponents };
      });
      saveHistoryInternal(previousState); 
    },

    //删除组件
    deleteComponent: (componentId) => {
      if (!componentId || componentId === 1) {
        console.warn("Cannot delete the root Page component or invalid ID.");
        return;
      }
      const previousState = JSON.parse(JSON.stringify(get().components)); 
      let componentFoundAndDeleted = false;

      set((state) => {
        const newComponents = JSON.parse(JSON.stringify(state.components)); 
        const findAndDelete = (comps: Component[], targetId: number): boolean => {
          for (let i = 0; i < comps.length; i++) {
            if (comps[i].id === targetId) {
              comps.splice(i, 1);
              componentFoundAndDeleted = true; // Mark as deleted
              return true;
            }
            if (comps[i].children?.length && findAndDelete(comps[i].children || [], targetId)) {

              return true;
            }
          }
          return false;
        };

        findAndDelete(newComponents, componentId);

        const shouldResetSelection = state.curComponentId === componentId && componentFoundAndDeleted;

        return {
          components: newComponents,
          ...(shouldResetSelection && { curComponentId: null, curComponent: null })
        };
      });
      if (componentFoundAndDeleted) {
        saveHistoryInternal(previousState);
      }
    },


    //复制组件
    copyComponentToClipboard: (componentId: number) => {
      const component = getComponentById(componentId, get().components);
      if (component) {
        set({ copyComponent: JSON.parse(JSON.stringify(component)) }); // 深拷贝组件到剪贴板
      } else {
        console.warn(`Component with ID ${componentId} not found.`);
      }
    },


    //粘贴组件
    pasteComponent: (parentId?: number) => {
      const { copyComponent, components } = get();
      if (!copyComponent) {
        console.warn("No component in copyComponent.");
        return;
      }
    
      const previousState = JSON.parse(JSON.stringify(components));
      const newComponent = copyComponent
      newComponent.id = Date.now(); // 生成新ID
    
      const updatedComponents = [...components];
      const targetParentId=parentId || 1;
      const parentComponent = getComponentById(targetParentId, updatedComponents);
      if (parentComponent) {
        newComponent.parentId = targetParentId;
        if (parentComponent) {
          if (!parentComponent.children) {
            parentComponent.children = [];
          }
          parentComponent.children.push(newComponent);
        } else {
          console.warn(`Parent component with ID ${parentId} not found. Adding to root.`);
          updatedComponents.push(newComponent);
        }
      } 
      set({ components: updatedComponents });
      saveHistoryInternal(previousState); // 记录历史
    },


    //更新组件属性
    updateComponentProps: (componentId, propsToUpdate) => {
      const previousStateForHistory = JSON.parse(JSON.stringify(get().components));
      let stateActuallyChanged = false;
      set((state) => {
        const component = getComponentById(componentId, state.components);

        if (component) {

          const newProps = { ...component.props, ...propsToUpdate };
          if (JSON.stringify(component.props) !== JSON.stringify(newProps)) {
            component.props = newProps;
            stateActuallyChanged = true;
          }
        }
        if (stateActuallyChanged) {

          return { components: [...state.components] };
        } else {
          return {};
        }

      }, false);
      if (stateActuallyChanged) {
        saveHistoryInternal(previousStateForHistory);
      }
    },


    //更新组件样式
    updateComponentStyles: (componentId, styles, replace) => {
      const previousState = JSON.parse(JSON.stringify(get().components));
      let updated = false;
      set((state) => {
        const newComponents = JSON.parse(JSON.stringify(state.components));
        const component = getComponentById(componentId, newComponents);
        if (component) {
          const currentStylesString = JSON.stringify(component.styles);
          const newStyles = replace ? { ...styles } : { ...component.styles, ...styles };
          if (JSON.stringify(newStyles) !== currentStylesString) {
            component.styles = newStyles;
            updated = true;
          }
        }
        return { components: newComponents };
      });
      if (updated) {
        saveHistoryInternal(previousState);
      }
    },


    //设置组件树
    setComponents: (newComponents) => {
      if (!Array.isArray(newComponents)) {
        console.error("setComponents received data that is not an array.");
        return;
      }
      if (newComponents.length === 0 || !newComponents[0]?.id) {
        console.error("setComponents received invalid component data structure.");
        return;
      }
      const validatedComponents = JSON.parse(JSON.stringify(newComponents));
      const newInitialEntry: InitialHistoryEntry = {
        type: 'initial',
        snapshot: JSON.parse(JSON.stringify(validatedComponents)),
        timestamp: Date.now(),
        description: "Imported state",
      };
      set({
        components: validatedComponents,
        curComponentId: null,
        curComponent: null,
        history: [newInitialEntry],
        historyIndex: 0,
        mode: 'edit',
      });
    },

    //撤销
    undo: () => {
      const { history, historyIndex } = get();
      if (historyIndex <= 0) {
        return;
      }
      const entryToUndo = history[historyIndex];
      if (entryToUndo.type === 'patch') {
        const currentState = get().components;
        try {
          const stateBeforePatch = JSON.parse(JSON.stringify(currentState));
          const previousState = jsonPatch.applyPatch(stateBeforePatch, entryToUndo.reversePatch, true, false).newDocument;

          set({
            components: previousState,
            historyIndex: historyIndex - 1,
            curComponentId: null,
            curComponent: null,
          }, false);
        } catch (error) {
          console.error("Error applying reverse patch during undo:", error);
        }
      } else {
        console.error("History Error: Expected a patch entry at index", historyIndex, "but found initial entry.");
      }
    },

    //重做
    redo: () => {
      const { history, historyIndex } = get();
      if (historyIndex >= history.length - 1) {
        return;
      }
      const entryToRedo = history[historyIndex + 1];

      if (entryToRedo.type === 'patch') {
        const currentState = get().components;
        try {
          const stateBeforePatch = JSON.parse(JSON.stringify(currentState));
          const nextState = jsonPatch.applyPatch(stateBeforePatch, entryToRedo.forwardPatch, true, false).newDocument;

          set({
            components: nextState,
            historyIndex: historyIndex + 1,
            curComponentId: null,
            curComponent: null,
          }, false);
        } catch (error) {
          console.error("Error applying forward patch during redo:", error);
        }

      } else {
        console.error("History Error: Expected a patch entry at index", historyIndex + 1, "for redo.");
      }
    },

    //跳转到指定历史记录
    jumpToHistory: (index: number) => {
      const { history, historyIndex } = get();
      if (index < 0 || index >= history.length || index === historyIndex) {
        return;
      }
      try {
        const targetState = reconstructStateAtIndex(index);

        set({
          components: targetState,
          historyIndex: index,
          curComponentId: null,
          curComponent: null,
        }, false);
      } catch (error) {
        console.error("Failed to jump to history state:", error);
      }
    },
  };
};


export const useComponetsStore = create<State & Action>()(
  persist(
    creator,
    {
      name: 'components-store',
      partialize: (state) => ({
        components: state.components,
        mode: state.mode,
      }),
      merge: (persistedState, currentState) => {
        const hydratedState = { ...currentState };
        if ((persistedState as any)?.components) {
          try {
            if (!Array.isArray((persistedState as any).components) || (persistedState as any).components.length === 0) {
              throw new Error("Invalid persisted components structure.");
            }
            hydratedState.components = JSON.parse(JSON.stringify((persistedState as any).components));
          } catch (e) {
            console.error("Failed to use persisted components, falling back to initial:", e);
          }
        }
        if ((persistedState as any)?.mode) {
          hydratedState.mode = (persistedState as any).mode;
        }

        const initialSnapshot = JSON.parse(JSON.stringify(hydratedState.components));
        const initialEntry: InitialHistoryEntry = {
          type: 'initial',
          snapshot: initialSnapshot,
          timestamp: Date.now(),
          description: "Loaded state",
        };

        hydratedState.history = [initialEntry];
        hydratedState.historyIndex = 0;
        hydratedState.curComponentId = null;
        hydratedState.curComponent = null;
        return hydratedState;
      },
    }
  )
);