
import { Component } from '../stores/components';
import { ComponentConfig } from '../stores/component-config';

/**
 * 将属性值格式化为适合 JSX 的字符串
 * @param value 属性值
 * @returns 格式化后的字符串，例如 "stringValue", {123}, {true}, {{"key":"value"}}, etc.
 */
function formatPropValueForJSX(value: any): string {
    if (typeof value === 'string') {
        // 对于字符串，使用 JSON.stringify 来正确处理引号和转义符
        return `{${JSON.stringify(value)}}`;
    }
    if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
        return `{${value}}`;
    }
    if (typeof value === 'object') {
        // 对于对象或数组，也使用 JSON.stringify
        try {
            // 使用 2 个空格缩进，让生成的代码更易读
            return `{${JSON.stringify(value, null, 2)}}`;
        } catch (e) {
            console.error("Error stringifying prop value:", value, e);
            return `"{/* Error serializing object prop */}"`;
        }
    }
    if (typeof value === 'undefined') {
        return `{undefined}`;
    }
    // 其他类型（如 function）在此简单场景下难以序列化，可以忽略或添加注释
    return `"{/* Unsupported prop type */}"`;
}

/**
 * 递归生成 React JSX 代码片段
 * @param component 当前组件节点 (来自 JSON)
 * @param componentConfigs 组件配置映射
 * @param usedComponents Set 用于收集所有用到的组件名，以便生成 import
 * @param indent 当前缩进级别（可选，用于美化输出）
 * @returns 生成的 JSX 代码字符串
 */
function generateReactCodeRecursive(
    component: Component,
    componentConfigs: Record<string, ComponentConfig>,
    usedComponents: Set<string>,
    indent: number = 0 // 用于基础缩进，但最好用 Prettier 格式化
): string {
    const config = componentConfigs[component.name];
    const indentString = ' '.repeat(indent * 2); // 2 spaces per indent level

    if (!config || !config.prod) {
        console.warn(`Component config or prod component not found for: ${component.name}`);
        return `${indentString}{/* Component definition not found for ${component.name} */}\n`;
    }

    // 将组件名添加到 Set 中
    usedComponents.add(component.name);

    const ComponentTag = component.name; // JSX 标签名直接用组件名

    // 构建 Props 字符串
    let propsString = ` key={${JSON.stringify(component.id)}}`; // 添加唯一的 key
    let childrenContent = ''
    // 添加普通 props
    if (component.props) {
        for (const propName in component.props) {
            if (Object.prototype.hasOwnProperty.call(component.props, propName) && propName !== 'children') {
                const propValue = component.props[propName];
                // 特殊处理Button的text属性
                if (component.name === 'Button' && propName === 'text') {
                    childrenContent = propValue
                } else if (typeof propValue !== 'function') {
                    propsString += ` ${propName}=${typeof propValue === 'string' ? `"${propValue}"` : formatPropValueForJSX(propValue)
                        }`;
                } else {
                    propsString += ` ${propName}="{/* Function prop ${propName} not supported */}"`;
                }
            }
        }
    }

    // 添加 style prop
    if (component.styles && Object.keys(component.styles).length > 0) {
        propsString += ` style={${formatPropValueForJSX(component.styles)}}`;
    }

    // 处理子组件
    let childrenCode = '';
    if (component.children && component.children.length > 0) {
        childrenCode = component.children
            .map(child => generateReactCodeRecursive(child, componentConfigs, usedComponents, indent + 1))
            .join(''); // 递归生成子组件代码
    }

    // 生成最终的 JSX 字符串
    if (childrenCode || childrenContent) {
        // 有子组件，使用开闭标签
        const content = childrenContent ? `${indentString}  ${childrenContent}\n` : childrenCode;
        return `${indentString}<${ComponentTag}${propsString}>\n${content}${indentString}</${ComponentTag}>\n`;
    } else {
        // 没有子组件，使用自闭合标签
        return `${indentString}<${ComponentTag}${propsString} />\n`;
    }
}



// utils/codeGenerator.ts (继续)

/**
 * 生成完整的 React 文件内容
 * @param rootComponent 根组件节点 (通常是 'Page')
 * @param componentConfigs 所有组件的配置
 * @param componentImportPath 组件库的导入路径 (例如 './components' 或 '@my-lib/components')
 * @returns 完整的 React 文件代码字符串
 */
export function generateFullReactFile(
    rootComponent: Component,
    componentConfigs: Record<string, ComponentConfig>,
    componentImportPath: string = './components' // 提供一个默认值或让用户配置
): string {
    const usedComponents = new Set<string>();

    // 递归生成核心 JSX 内容，并收集用到的组件
    const coreJsx = generateReactCodeRecursive(rootComponent, componentConfigs, usedComponents);

    // 生成 Import 语句
    // 过滤掉 Page 组件，因为它通常是根节点，不从库导入
    const componentsToImport = Array.from(usedComponents).filter(name => name !== 'Page');
    let importStatement = '';
    if (componentsToImport.length > 0) {
        importStatement = `import { ${componentsToImport.join(', ')} } from '${componentImportPath}';`;
    }

    // 组装完整文件
    const fileContent = `
import React from 'react';
${importStatement}

const GeneratedPage = () => {
    return (
        <>
            ${coreJsx.trim()} 
        </>
    );
};

export default GeneratedPage;
`;
    try {
        
        return fileContent; // 暂时返回未格式化的代码
    } catch (error) {
        console.warn("Prettier formatting failed. Returning raw code.", error);
        return fileContent; // 格式化失败则返回原始代码
    }
}