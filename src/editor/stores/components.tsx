import { CSSProperties } from 'react';
import { create, StateCreator } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Component {
  id: number;
  name: string;
  props: any;
  styles?: CSSProperties;
  desc: string;
  children?: Component[];
  parentId?: number;
}

interface State {
  components: Component[];
  mode: 'edit' | 'preview';
  curComponentId?: number | null;
  curComponent: Component | null;
  history: Component[][]; // 新增历史记录
  historyIndex: number;   // 新增当前历史索引
}

interface Action {
  addComponent: (component: Component, parentId?: number) => void;
  deleteComponent: (componentId: number) => void;
  updateComponentProps: (componentId: number, props: any) => void;
  updateComponentStyles: (componentId: number, styles: CSSProperties, replace?: boolean) => void;
  setCurComponentId: (componentId: number | null) => void;
  setMode: (mode: State['mode']) => void;
  undo: () => void;
  redo: () => void;
  saveHistory: () => void;
  setComponents: (components: Component[]) => void;
}

const creator: StateCreator<State & Action> = (set, get) => ({
  components: [
    {
      id: 1,
      name: 'Page',
      props: {},
      desc: '页面',
    }
  ],
  curComponentId: null,
  curComponent: null,
  mode: 'edit',
  history: [],     // 初始化历史记录
  historyIndex: 0, // 初始化历史索引

  saveHistory: () => {
    const { components, history, historyIndex } = get();
    const newHistory = history.slice(0, historyIndex + 1);
    // 确保保存的是当前组件的深拷贝
    const snapshot = JSON.parse(JSON.stringify(components));
    newHistory.push(snapshot);
    set({
      history: newHistory,
      historyIndex: newHistory.length - 1
    });
  },

  // 撤销
  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      set({
        components: JSON.parse(JSON.stringify(history[historyIndex - 1])),
        curComponentId: null, // 重置当前选中组件
        curComponent: null,
        historyIndex: historyIndex - 1
      });
    }
  },

  // 重做
  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      set({
        components: JSON.parse(JSON.stringify(history[historyIndex + 1])),
        historyIndex: historyIndex + 1
      });
    }
  },

  setMode: (mode) => set({ mode }),

  setCurComponentId: (componentId) =>
    set((state) => ({
      curComponentId: componentId,
      curComponent: getComponentById(componentId, state.components),
    })),

  addComponent: (component, parentId) => {
    const result = set((state) => {
      if (parentId) {
        const parentComponent = getComponentById(
          parentId,
          state.components
        );

        if (parentComponent) {
          if (parentComponent.children) {
            parentComponent.children.push(component);
          } else {
            parentComponent.children = [component];
          }
        }

        component.parentId = parentId;
        return { components: [...state.components] };
      }
      return { components: [...state.components, component] };
    });
    get().saveHistory();
    return result;
  },


  deleteComponent: (componentId) => {
    if (!componentId) return;
    const { components } = get();
    const component = getComponentById(componentId, components);
    if (!component) return;
    if (component.parentId) {
      const parentComponent = getComponentById(component.parentId, components);
      if (parentComponent?.children) {
        parentComponent.children = parentComponent.children.filter((item) => item.id !== componentId);
      }
    } else {
      const newComponents = components.filter((item) => item.id !== componentId);
      set({ components: newComponents });
      get().saveHistory();
      return;
    }
    if (get().curComponentId === componentId) {
      set({
        components: [...components],
        curComponentId: null,
        curComponent: null,
      });
    } else {
      set({ components: [...components] });
    }
    get().saveHistory();
  },


  updateComponentProps: (componentId, props) => {
    const result = set((state) => {
      const component = getComponentById(componentId, state.components);
      if (component) {
        component.props = { ...component.props, ...props };
        return { components: [...state.components] };
      }
      return { components: [...state.components] };
    });
    get().saveHistory();
    return result;
  },


  updateComponentStyles: (componentId, styles, replace) => {
    const result = set((state) => {
      const component = getComponentById(componentId, state.components);
      if (component) {
        component.styles = replace ? { ...styles } : { ...component.styles, ...styles };
        return { components: [...state.components] };
      }
      return { components: [...state.components] };
    });
    get().saveHistory();
    return result;
  },
  setComponents: (newComponents) => {
    set({
      components: JSON.parse(JSON.stringify(newComponents)), // 深拷贝
      curComponentId: null, // 重置当前选中组件
      curComponent: null
    });
    get().saveHistory(); // 保存历史记录
  },
});


export const useComponetsStore = create<State & Action>()(
  persist(creator, {
    name: 'components-store', // 修改为明确的存储键名
    partialize: (state) => ({
      components: state.components, // 只持久化components数据
      mode: state.mode
    })
  })
);

export function getComponentById(
  id: number | null,
  components: Component[]
): Component | null {
  if (!id) return null;

  for (const component of components) {
    if (component.id == id) return component;
    if (component.children && component.children.length > 0) {
      const result = getComponentById(id, component.children);
      if (result !== null) return result;
    }
  }
  return null;
}

// 初始化时保存历史记录
useComponetsStore.getState().saveHistory();