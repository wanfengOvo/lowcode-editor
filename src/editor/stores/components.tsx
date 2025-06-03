import { CSSProperties } from 'react';
import { create, StateCreator } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';


let nextIdCounter = Date.now();
export function generateId(): number {
  return nextIdCounter++;
}


export interface Component {
  id: number;
  name: string;
  props: any;
  styles?: CSSProperties;
  desc: string;
  children?: Component[];
  parentId?: number;
}

export interface Command {
  execute(): void;
  undo(): void;
  description?: string;
}

export interface StoreState {
  components: Component[];
  mode: 'edit' | 'preview';
  curComponentId?: number | null;
  curComponent: Component | null;
  history: Command[];
  historyIndex: number;
}

export interface StoreActions {
  executeCommand: (command: Command) => void;
  undo: () => void;
  redo: () => void;
  jumpToHistoryState: (targetIndex: number) => void;
  addComponent: (
    componentData: Partial<Component> & Pick<Component, 'name'>,
    parentId?: number,
    targetIndex?: number // 可选：添加时指定索引
  ) => Component | undefined;
  deleteComponent: (componentId: number) => void;
  moveComponent: (
    componentIdToMove: number,
    targetParentId: number | undefined,
    targetIndex?: number
  ) => void;
  updateComponentProps: (componentId: number, props: any) => void;
  updateComponentStyles: (
    componentId: number,
    styles: CSSProperties,
    replace?: boolean
  ) => void;
  setComponents: (newComponents: Component[]) => void;
  setCurComponentId: (componentId: number | null) => void;
  setMode: (mode: StoreState['mode']) => void;
}

export type FullStore = StoreState & StoreActions;
type ImmerSet = (fn: (draft: FullStore) => void) => void;
type StoreGet = () => FullStore;


export function getComponentById(
  id: number | null,
  components: Component[] // 可以是普通数组或 Immer draft
): Component | null {
  if (id === null) return null;
  for (const component of components) {
    if (component.id === id) return component;
    if (component.children && component.children.length > 0) {
      const result = getComponentById(id, component.children);
      if (result !== null) return result;
    }
  }
  return null;
}



interface FoundComponentInfo {
  componentNode: Component;          // 找到的组件节点的引用 (来自 draft)
  parentChildrenArray: Component[]; // 包含该组件的 children 数组的引用 (来自 draft)
  indexInParentArray: number;      // 该组件在其父 children 数组中的索引
  actualParentId?: number;         // 该组件实际的父组件 ID (如果是根组件则为 undefined)
}

/**
 * 在 draft 组件树中查找组件及其上下文信息 (BFS)。
 * @param draftComponents - 组件树的根数组 (来自 Immer draft)。
 * @param componentId - 要查找的组件 ID。
 * @returns FoundComponentInfo 或 null。
 */
function findComponentInfoInDraft(
  draftComponents: Component[],
  componentId: number
): FoundComponentInfo | null {
  // 使用队列进行广度优先搜索
  const queue: Array<{ node: Component; parentArr: Component[]; parentNodeId_param?: number; currentIndex: number }> = [];

  // 初始化队列 (根节点)
  draftComponents.forEach((rootNode, index) => {
    queue.push({ node: rootNode, parentArr: draftComponents, currentIndex: index });
  });

  let head = 0;
  while (head < queue.length) {
    const { node, parentArr, parentNodeId_param, currentIndex } = queue[head++]; // 出队

    if (node.id === componentId) {
      return {
        componentNode: node, // 直接返回 draft 中的节点引用
        parentChildrenArray: parentArr,
        indexInParentArray: currentIndex,
        actualParentId: parentNodeId_param,
      };
    }

    if (node.children && node.children.length > 0) {
      node.children.forEach((childNode, childIndex) => {
        // 入队子节点
        queue.push({ node: childNode, parentArr: node.children!, parentNodeId_param: node.id, currentIndex: childIndex });
      });
    }
  }
  return null; // 未找到
}

/**
 * 从 draft 组件树中移除一个组件，并返回被移除的组件及其原始位置信息。
 * 如果未找到组件，则返回 null。
 * @param draftComponents - 组件树的根数组 (来自 Immer draft)。
 * @param componentId - 要移除的组件 ID。
 * @returns 包含被移除组件及其原始父ID和索引的对象，或 null。
 */
function removeComponentFromDraft(
  draftComponents: Component[],
  componentId: number
): { removedComponent: Component; originalParentId?: number; originalIndex: number } | null {
  const info = findComponentInfoInDraft(draftComponents, componentId);
  if (info) {
    // 从父组件的 children 数组中移除该组件
    info.parentChildrenArray.splice(info.indexInParentArray, 1);
    return {
      removedComponent: info.componentNode, // componentNode 是被移除的 draft 对象的引用
      originalParentId: info.actualParentId,
      originalIndex: info.indexInParentArray
    };
  }
  console.warn(`removeComponentFromDraft: Component with ID ${componentId} not found.`);
  return null;
}

/**
 * 将一个组件插入到 draft 组件树的指定位置。
 * @param draftComponents - 组件树的根数组 (来自 Immer draft)。
 * @param componentToInsert - 要插入的组件对象。
 * @param targetParentId - 目标父组件的 ID。如果为 undefined，则插入到根级别。
 * @param targetIndex - (可选) 在目标父组件的 children 数组中的插入位置索引。如果未提供或无效，则添加到末尾。
 * @returns boolean - 是否成功插入。
 */
function insertComponentInDraft(
  draftComponents: Component[],
  componentToInsert: Component,
  targetParentId: number | undefined,
  targetIndex?: number
): boolean {
  // 更新待插入组件的 parentId 属性
  componentToInsert.parentId = targetParentId;

  if (targetParentId === undefined) { // 插入到根级别
    if (typeof targetIndex === 'number' && targetIndex >= 0 && targetIndex <= draftComponents.length) {
      draftComponents.splice(targetIndex, 0, componentToInsert);
    } else {
      draftComponents.push(componentToInsert); // 默认添加到末尾
    }
    return true;
  } else {
    // 查找目标父组件
    const parentInfo = findComponentInfoInDraft(draftComponents, targetParentId);
    if (parentInfo && parentInfo.componentNode) {
      const parentNode = parentInfo.componentNode;
      if (!parentNode.children) {
        parentNode.children = []; // 如果父组件没有 children 数组，则初始化
      }
      if (typeof targetIndex === 'number' && targetIndex >= 0 && targetIndex <= parentNode.children.length) {
        parentNode.children.splice(targetIndex, 0, componentToInsert);
      } else {
        parentNode.children.push(componentToInsert); // 默认添加到末尾
      }
      return true;
    } else {
      console.warn(`insertComponentInDraft: Target parent with ID ${targetParentId} not found. Cannot insert component "${componentToInsert.name}".`);
      return false; // 父组件未找到，插入失败
    }
  }
}




class AddComponentCommand implements Command {
  description: string;
  private componentToAdd: Component; // 这是要添加的组件的“定义”或“快照”
  private targetParentId?: number;
  private targetIndex?: number; // 可选，指定在新父级中的位置
  private set: ImmerSet;
  private addedComponentId!: number; // 用于撤销时精确查找

  constructor(
    set: ImmerSet,
    componentData: Partial<Component> & Pick<Component, 'name'>,
    targetParentId?: number,
    targetIndex?: number // 构造时接收 targetIndex
  ) {
    this.set = set;
    if (!componentData || !componentData.name) { /* ... 错误处理 ... */ throw new Error("..."); }
    const id = componentData.id || generateId();
    this.addedComponentId = id; // 保存ID用于撤销
    const clonedData = JSON.parse(JSON.stringify(componentData));
    this.componentToAdd = {
      id: id,
      name: clonedData.name,
      props: clonedData.props || {},
      styles: clonedData.styles || undefined,
      desc: clonedData.desc || `新的 ${clonedData.name}`,
      children: clonedData.children || [], // 对于新组件，通常为空；对于移动，会保留
      parentId: undefined, // parentId 将在 insertComponentInDraft 中设置
    };
    this.targetParentId = targetParentId;
    this.targetIndex = targetIndex;
    this.description = `添加组件: ${this.componentToAdd.name} (ID: ${id})`;
  }

  public getAddedComponent(): Component {
    // 返回一个副本，确保原始的 componentToAdd 不被外部修改
    return JSON.parse(JSON.stringify(this.componentToAdd));
  }

  execute(): void {
    this.set((draft) => {
      // 每次执行都从 this.componentToAdd 创建一个新实例以确保它是干净的
      const componentInstanceToAdd = JSON.parse(JSON.stringify(this.componentToAdd));
      const success = insertComponentInDraft(
        draft.components,
        componentInstanceToAdd,
        this.targetParentId,
        this.targetIndex
      );
      if (success) {
        draft.curComponentId = componentInstanceToAdd.id;
        draft.curComponent = getComponentById(componentInstanceToAdd.id, draft.components);
      } else {
        console.error(`AddComponentCommand: Failed to insert component ${componentInstanceToAdd.name}`);
      }
    });
  }

  undo(): void {
    this.set((draft) => {
      const removalResult = removeComponentFromDraft(draft.components, this.addedComponentId);
      if (removalResult && draft.curComponentId === this.addedComponentId) {
        draft.curComponentId = null;
        draft.curComponent = null;
      }
      if (!removalResult) {
        console.warn(`AddComponentCommand undo: Component ID ${this.addedComponentId} not found for removal.`);
      }
    });
  }
}

class DeleteComponentCommand implements Command {
  description: string;
  private componentId: number;
  private deletedComponentSnapshot: Component | null = null;
  private originalParentId?: number;
  private originalIndexInParent!: number;
  private set: ImmerSet;


  constructor(set: ImmerSet, componentId: number) {
    this.set = set;
    this.componentId = componentId;
    this.description = `删除组件 (ID: ${componentId})`;
  }

  execute(): void {
    this.set((draft) => {
      const removalResult = removeComponentFromDraft(draft.components, this.componentId);
      if (removalResult) {
        this.deletedComponentSnapshot = removalResult.removedComponent; // 快照是被移除的那个实例
        this.originalParentId = removalResult.originalParentId;
        this.originalIndexInParent = removalResult.originalIndex;
      } else {
        console.warn(`DeleteComponent: 组件 ID ${this.componentId} 未找到。`);
        this.deletedComponentSnapshot = null; // 确保快照为null，undo时无操作
      }

      if (draft.curComponentId === this.componentId) {
        draft.curComponentId = null;
        draft.curComponent = null;
      }
    });
  }

  undo(): void {
    if (!this.deletedComponentSnapshot) return; // 如果执行时未找到组件，则撤销也无操作
    const componentToRestore = JSON.parse(JSON.stringify(this.deletedComponentSnapshot));
    this.set((draft) => {
      insertComponentInDraft(
        draft.components,
        componentToRestore,
        this.originalParentId,
        this.originalIndexInParent
      );
      // 可选：恢复选中状态（如果需要）
    });
  }
}

class MoveComponentCommand implements Command {
  description: string;
  private componentIdToMove: number;
  private targetParentId: number | undefined;
  private targetIndex?: number;

  private movedComponentSnapshot!: Component; // 保存移动前组件的完整状态
  private originalParentId?: number;
  private originalIndexInParent!: number;

  private set: ImmerSet;

  constructor(
    set: ImmerSet,
    componentIdToMove: number,
    targetParentId: number | undefined,
    targetIndex?: number
  ) {
    this.set = set;
    this.componentIdToMove = componentIdToMove;
    this.targetParentId = targetParentId;
    this.targetIndex = targetIndex;
    this.description = `移动组件 (ID: ${componentIdToMove}) 到父级 ${targetParentId === undefined ? '根' : targetParentId}`;
  }

  execute(): void {
    this.set(draft => {
      const removalResult = removeComponentFromDraft(draft.components, this.componentIdToMove);

      if (!removalResult) {
        console.error(`MoveComponentCommand execute: 组件 ${this.componentIdToMove} 未找到。`);
        throw new Error(`组件 ${this.componentIdToMove} 未找到以进行移动。`);
      }

      this.movedComponentSnapshot = removalResult.removedComponent; // 这是被移除的组件实例
      this.originalParentId = removalResult.originalParentId;
      this.originalIndexInParent = removalResult.originalIndex;

      // componentInstance 就是 removalResult.removedComponent，它是 draft 中的对象引用
      const componentInstance = removalResult.removedComponent;

      const success = insertComponentInDraft(
        draft.components,
        componentInstance, // 直接传递从 draft 中移除的实例
        this.targetParentId,
        this.targetIndex
      );

      if (!success) {
        console.error(`MoveComponentCommand: 插入组件 ${componentInstance.name} 到新位置失败。尝试恢复到根。`);
        insertComponentInDraft(draft.components, componentInstance, undefined); //尝试添加到根
      }

      if (draft.curComponentId === this.componentIdToMove) {
        draft.curComponent = getComponentById(this.componentIdToMove, draft.components);
      }
    });
  }

  undo(): void {
    if (!this.movedComponentSnapshot) {
      console.error("MoveComponentCommand undo: 缺少被移动组件的快照。");
      return;
    }
    // 必须从快照创建新实例，因为它包含了原始的 parentId 和 children 结构
    const componentToRestore = JSON.parse(JSON.stringify(this.movedComponentSnapshot));

    this.set(draft => {
      // 1. 从当前位置 (即 execute 时的 targetParentId) 移除组件
      removeComponentFromDraft(draft.components, this.componentIdToMove);

      // 2. 将从快照恢复的组件添加回其原始父级和原始索引
      insertComponentInDraft(
        draft.components,
        componentToRestore, // 使用从快照恢复的干净实例
        this.originalParentId,
        this.originalIndexInParent
      );

      if (draft.curComponentId === this.componentIdToMove) {
        draft.curComponent = getComponentById(this.componentIdToMove, draft.components);
      }
    });
  }
}

class UpdateComponentPropsCommand implements Command {
  description: string;
  private componentId: number;
  private newProps: any;
  private oldProps: any | null = null;
  private set: ImmerSet;
  private get: StoreGet;

  constructor(set: ImmerSet, get: StoreGet, componentId: number, newProps: any) {
    this.set = set;
    this.get = get;
    this.componentId = componentId;
    this.newProps = JSON.parse(JSON.stringify(newProps));
    this.description = `更新属性 (ID: ${componentId})`;
  }
  execute(): void {
    const component = getComponentById(this.componentId, this.get().components);
    if (component) this.oldProps = JSON.parse(JSON.stringify(component.props));
    else { console.warn(`UpdateProps: 组件 ${this.componentId} 未找到`); return; }

    this.set(draft => {
      const target = getComponentById(this.componentId, draft.components);
      if (target) {
        target.props = { ...target.props, ...this.newProps };
        if (draft.curComponentId === this.componentId) draft.curComponent = target;
      }
    });
  }
  undo(): void {
    if (this.oldProps === null) return;
    this.set(draft => {
      const target = getComponentById(this.componentId, draft.components);
      if (target) {
        target.props = JSON.parse(JSON.stringify(this.oldProps));
        if (draft.curComponentId === this.componentId) draft.curComponent = target;
      }
    });
  }
}


class UpdateComponentStylesCommand implements Command {
  description: string;
  private componentId: number;
  private newStyles: CSSProperties;
  private oldStyles: CSSProperties | undefined | null = null;
  private replace?: boolean;
  private set: ImmerSet;
  private get: StoreGet;

  constructor(set: ImmerSet, get: StoreGet, componentId: number, newStyles: CSSProperties, replace?: boolean) {
    this.set = set;
    this.get = get;
    this.componentId = componentId;
    this.newStyles = JSON.parse(JSON.stringify(newStyles));
    this.replace = replace;
    this.description = `更新样式 (ID: ${componentId})`;
  }
  execute(): void {
    const component = getComponentById(this.componentId, this.get().components);
    if (component) this.oldStyles = component.styles ? JSON.parse(JSON.stringify(component.styles)) : undefined;
    else { console.warn(`UpdateStyles: 组件 ${this.componentId} 未找到`); return; }

    this.set(draft => {
      const target = getComponentById(this.componentId, draft.components);
      if (target) {
        target.styles = this.replace ? { ...this.newStyles } : { ...target.styles, ...this.newStyles };
        if (draft.curComponentId === this.componentId) draft.curComponent = target;
      }
    });
  }
  undo(): void {
    if (this.oldStyles === null && !getComponentById(this.componentId, this.get().components)) return;
    this.set(draft => {
      const target = getComponentById(this.componentId, draft.components);
      if (target) {
        target.styles = this.oldStyles ? JSON.parse(JSON.stringify(this.oldStyles)) : undefined;
        if (draft.curComponentId === this.componentId) draft.curComponent = target;
      }
    });
  }
}


class SetComponentsCommand implements Command {
  description = "加载新组件树";
  private newComponentsState: Component[];
  private oldComponentsState: Component[] | null = null;
  private oldMode: StoreState['mode'] | null = null;
  private set: ImmerSet;
  private get: StoreGet;

  constructor(set: ImmerSet, get: StoreGet, newComponents: Component[]) {
    this.set = set;
    this.get = get;
    this.newComponentsState = JSON.parse(JSON.stringify(newComponents));
  }
  execute(): void {
    this.oldComponentsState = JSON.parse(JSON.stringify(this.get().components));
    this.oldMode = this.get().mode;
    this.set(draft => {
      draft.components = JSON.parse(JSON.stringify(this.newComponentsState));
      draft.curComponentId = null;
      draft.curComponent = null;
    });
  }
  undo(): void {
    if (!this.oldComponentsState || this.oldMode === null) return;
    this.set(draft => {
      draft.components = JSON.parse(JSON.stringify(this.oldComponentsState!));
      draft.mode = this.oldMode!;
      draft.curComponentId = null;
      draft.curComponent = null;
    });
  }
}


const storeCreator: StateCreator<FullStore, [['zustand/immer', never]], [], FullStore> = (set, get) => ({
  components: [
    {
      id: generateId(),
      name: 'Page',
      props: { style: { minHeight: '100vh', padding: '20px', position: 'relative' } },
      styles: { backgroundColor: '#f0f0f0' },
      desc: '页面根节点',
      children: [],
    },
  ],
  mode: 'edit',
  curComponentId: null,
  curComponent: null,
  history: [],
  historyIndex: -1,

  executeCommand: (command: Command) => {
    command.execute();
    set((draft) => {
      draft.history = draft.history.slice(0, draft.historyIndex + 1);
      draft.history.push(command);
      draft.historyIndex = draft.history.length - 1;
    });
  },
  undo: () => {
    const currentIndex = get().historyIndex;
    if (currentIndex >= 0) {
      get().history[currentIndex].undo();
      set(draft => {
        draft.historyIndex = currentIndex - 1;
        draft.curComponentId = null;
        draft.curComponent = null;
      });
    }
  },
  redo: () => {
    const currentIndex = get().historyIndex;
    const history = get().history;
    if (currentIndex < history.length - 1) {
      history[currentIndex + 1].execute();
      set(draft => {
        draft.historyIndex = currentIndex + 1;
        draft.curComponentId = null;
        draft.curComponent = null;
      });
    }
  },
  jumpToHistoryState: (targetIndex: number) => {
    const { history, historyIndex: currentIndex } = get();
    if (targetIndex < -1 || targetIndex >= history.length || targetIndex === currentIndex) {
      if (targetIndex === -1 && currentIndex === -1) return;
      if (targetIndex !== -1 && (targetIndex < 0 || targetIndex >= history.length)) { console.warn("Target history index out of bounds."); return; }
      if (targetIndex === currentIndex) { console.warn("Already at the target history index."); return; }
    }
    set(draft => { draft.curComponentId = null; draft.curComponent = null; });
    if (targetIndex < currentIndex) {
      for (let i = currentIndex; i > targetIndex; i--) { if (history[i]) history[i].undo(); }
    } else {
      for (let i = currentIndex + 1; i <= targetIndex; i++) { if (history[i]) history[i].execute(); }
    }
    set(draft => { draft.historyIndex = targetIndex; });
  },

  addComponent: (componentData, parentId, targetIndex) => { // 添加 targetIndex 参数
    const command = new AddComponentCommand(set, componentData, parentId, targetIndex);
    get().executeCommand(command);
    return command.getAddedComponent();
  },
  deleteComponent: (componentId) => {
    const command = new DeleteComponentCommand(set, /*get,*/ componentId); // 移除了 get
    get().executeCommand(command);
  },
  moveComponent: (componentIdToMove, targetParentId, targetIndex) => {
    const command = new MoveComponentCommand(set, /*get,*/ componentIdToMove, targetParentId, targetIndex); // 移除了 get
    get().executeCommand(command);
  },
  updateComponentProps: (componentId, props) => {
    const command = new UpdateComponentPropsCommand(set, get, componentId, props);
    get().executeCommand(command);
  },
  updateComponentStyles: (componentId, styles, replace) => {
    const command = new UpdateComponentStylesCommand(set, get, componentId, styles, replace);
    get().executeCommand(command);
  },
  setComponents: (newComponents) => {
    const command = new SetComponentsCommand(set, get, newComponents);
    get().executeCommand(command);
  },
  setMode: (newMode) => {
    set(draft => { draft.mode = newMode; });
  },
  setCurComponentId: (componentId) => {
    set(draft => {
      draft.curComponentId = componentId;
      draft.curComponent = getComponentById(componentId, draft.components);
    });
  },
});


export const useComponetsStore = create<FullStore>()(
  devtools(
    persist(
      immer(storeCreator),
      {
        name: 'components-store-command-pattern-v3',
        partialize: (state) => ({
          components: state.components,
          mode: state.mode,
        }),
      }
    )
  )
);