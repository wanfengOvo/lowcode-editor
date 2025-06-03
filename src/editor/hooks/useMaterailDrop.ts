// useMaterailDrop.ts
import { useDrop, DropTargetMonitor } from "react-dnd";
import { useComponentConfigStore } from "../stores/component-config";
import {
  getComponentById,
  useComponetsStore,
  // generateId, // generateId 不在此文件直接调用，由 AddComponentCommand 内部处理
} from "../stores/components";
import type { Component, FullStore } from "../stores/components"; // 导入 Component 和 FullStore 类型
import { message } from 'antd';

export interface ItemType {
  type: string;        // 物料类型, e.g., 'Button', 'Textarea'
  dragType?: 'move' | 'add'; // 拖拽类型
  id?: number;         // 对于 'move' 操作, 这是被移动组件的 ID.
}

/**
 * 自定义 Hook 用于处理物料的拖放逻辑.
 * @param accept - 一个字符串数组，指定此放置目标可以接受的拖拽类型 (item.type).
 * @param parentIdToDropIn - 组件将被放入的目标父容器的 ID。如果为 undefined，则表示放入根级别。
 * @param targetIndexInParent - (可选) 组件在目标父容器的 children 数组中的目标索引。
 */
export function useMaterailDrop(
  accept: string[],
  parentIdToDropIn: number | undefined, // 修改为 number | undefined 以支持根级别
  targetIndexInParent?: number // 可选的目标索引
) {
  // 从 store 中获取 actions 和 state
  const {
    addComponent,
    moveComponent, // 使用新的 moveComponent action
    components,
  } = useComponetsStore() as FullStore; // 断言为 FullStore 以确保所有 actions 可用

  const { componentConfig } = useComponentConfigStore();

  const [{ canDrop, isOverCurrent }, drop] = useDrop(
    () => ({
      accept,
      // drop 函数在可放置的拖拽源被放置到当前目标上时触发
      drop: (item: ItemType, monitor: DropTargetMonitor<ItemType, void>) => {
        // isOverCurrent 确保只在当前精确的放置目标上触发 drop
        // monitor.didDrop() 检查是否有子级的放置目标已经处理了此次拖放
        // 如果没有悬停在当前目标上，或者已经有子目标处理了，则不执行操作
        if (!monitor.isOver({ shallow: true }) || monitor.didDrop()) {
          return;
        }

        if (item.dragType === 'move') {
          // --- 处理组件移动操作 ---
          if (typeof item.id !== 'number') {
            console.error("移动操作错误：被拖拽的物料缺少有效的组件 ID。", item);
            message.error("移动组件失败：物料信息不完整。");
            return;
          }

          // 检查是否尝试将组件拖放到自身 (如果 parentIdToDropIn 正是 item.id)
          if (item.id === parentIdToDropIn) {
            console.warn("无法将组件拖放到其自身内部。");
            // message.warn("不能将组件拖放到自身内部"); // 可选的用户提示
            return;
          }

          moveComponent(item.id, parentIdToDropIn, targetIndexInParent);
          
          const movedComp = getComponentById(item.id, components); // 获取组件名称用于消息
          message.success(`组件 "${movedComp?.name || 'ID:' + item.id}" 已安排移动`);

        } else {
          // --- 处理从物料面板添加新组件的操作 ---
          const config = componentConfig[item.type];
          if (!config) {
            console.error(`未找到物料类型 "${item.type}" 的配置信息。`);
            message.error(`添加组件失败：未找到 ${item.type} 的配置。`);
            return;
          }

          // 准备新组件的数据。ID 将由 AddComponentCommand 内部生成（如果未提供）。
          const newComponentData: Partial<Component> & Pick<Component, 'name'> = {
            name: item.type,
            desc: config.desc,
            // 确保 props 和 styles 是深拷贝，以防默认配置对象被意外修改
            props: config.defaultProps ? JSON.parse(JSON.stringify(config.defaultProps)) : {},
            
          };
          addComponent(newComponentData, parentIdToDropIn /*, targetIndexInParent */);
          message.success(`组件 "${item.type}" 已添加`);
        }
      },
      // collect 函数用于从 monitor 收集拖拽状态信息
      collect: (monitor) => ({
        canDrop: monitor.canDrop(), // 当前拖拽源是否可以被放置到此目标上
        isOverCurrent: monitor.isOver({ shallow: true }), // 是否精确悬停在当前目标上
      }),
    }),
    [accept, parentIdToDropIn, targetIndexInParent, components, componentConfig, addComponent, moveComponent]
  );

  // 返回 drop ref（附加到DOM元素上）和收集到的状态
  return { canDrop, drop, isOverCurrent };
}