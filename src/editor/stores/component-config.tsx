import { create } from 'zustand';
import React from 'react';
import { componentConfigs } from '../config/componentConfigs';

import ButtonIcon from '../../assets/icons/button.svg'
import {
    ContainerOutlined,
    FontSizeOutlined,
    AppstoreOutlined,
    TableOutlined,
    FormOutlined,
    FileTextOutlined,
    ColumnHeightOutlined
} from '@ant-design/icons';

export interface ComponentSetter {
    name: string;
    label: string;
    type: string;
    [key: string]: any;
}

export interface ComponentEvent {
    name: string;
    label: string;
}

export interface ComponentMethod {
    name: string;
    label: string;
}

export interface ComponentConfig {
    name: string;
    defaultProps: Record<string, any>;
    desc: string;
    setter?: ComponentSetter[];
    stylesSetter?: ComponentSetter[];
    events?: ComponentEvent[];
    methods?: ComponentMethod[];
    dev: any;
    prod: any;
    icon?: React.ReactNode;
}

interface State {
    componentConfig: { [key: string]: ComponentConfig };
    history: { [key: string]: ComponentConfig }[];
    historyIndex: number;
}

interface Action {
    registerComponent: (name: string, componentConfig: ComponentConfig) => void;
    saveHistory: () => void;
}



const iconMap = {
    Container: <ContainerOutlined className="text-blue-500" />,
    Text: <FontSizeOutlined className="text-blue-500" />,
    Button: <img src={ButtonIcon} alt="Button Icon" className="text-blue-500" />,
    Modal: <AppstoreOutlined className="text-blue-500" />,
    Table: <TableOutlined className="text-blue-500" />,
    TableColumn: <ColumnHeightOutlined className="text-blue-500" />,
    Form: <FormOutlined className="text-blue-500" />,
    FormItem: <FileTextOutlined className="text-blue-500" />,
};


export const useComponentConfigStore = create<State & Action>((set, get) => {
    const initialComponentConfig = Object.entries(componentConfigs).reduce((acc, [key, config]) => {
        const icon = iconMap[key as keyof typeof iconMap] || config.icon;
    
        acc[key] = {
            ...config,
            icon: icon,
        };
    
        return acc;
    }, {} as Record<string, ComponentConfig>);

    // 初始化时保存初始状态到历史记录
    const initialHistory = [JSON.parse(JSON.stringify(initialComponentConfig))];

    return {
        componentConfig: initialComponentConfig,
        history: initialHistory,
        historyIndex: 0,

        saveHistory: () => {
            const { componentConfig, history, historyIndex } = get();
            const newHistory = history.slice(0, historyIndex + 1);
            newHistory.push(JSON.parse(JSON.stringify(componentConfig)));
            set({
                history: newHistory,
                historyIndex: newHistory.length - 1
            });
        },

        registerComponent: (name, componentConfig) => {
            set((state) => ({
                ...state,
                componentConfig: {
                    ...state.componentConfig,
                    [name]: componentConfig
                }
            }));
            // 注册组件后保存历史记录
            get().saveHistory();
        }
    };
});