import { CSSProperties, PropsWithChildren } from "react";

export interface CommonComponentProps extends PropsWithChildren{
    id: number;
    name: string;
    styles?: CSSProperties;
    type?: string;  // 添加type属性
    text?: string;  // 添加text属性
    [key: string]: any
}

export enum ComponentTypes {
    Button = 'Button',
    Table = 'Table',
    Input = 'Input'
}

// 添加组件基础配置接口
export interface ComponentConfig {
    name: string;
    props: Record<string, any>;
    children?: ComponentConfig[];
}