import MonacoEditor, { OnMount } from '@monaco-editor/react';
import { Modal, message } from 'antd'; // 引入 message
import { useComponetsStore } from '../../stores/components';
import { useState, useRef } from 'react';

export function Source() {
  const { components } = useComponetsStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');

  // 首字母大写
  const capitalize = (str: string): string => {
    if (typeof str !== 'string') return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  // 生成 React 代码
  const generateReactCode = (components: any[]) => {
    const importStatements = new Set<string>();
    const stateVars: string[] = [];
    const refVars: string[] = [];
    const eventHandlers: string[] = [];

    // 收集所有组件名称用于生成 import 语句
    const traverseComponents = (comps: any[]) => {
      comps.forEach((comp) => {
        importStatements.add(comp.name);
        if (comp.children) traverseComponents(comp.children);
      });
    };
    traverseComponents(components);

    // 生成导入语句
    const imports = Array.from(importStatements)
      .map((name) => {
        if (['Button', 'Input', 'Form', 'Table', 'Modal'].includes(name)) {
          return `import { ${name} } from 'antd';`;
        }
        return `import ${name} from './components/${name}/prod';`;
      })
      .join('\n');

    // 生成状态变量
    components.forEach((comp) => {
      if (comp.props?.value) {
        stateVars.push(
          `const [${comp.props.name}, set${capitalize(comp.props.name)}] = useState('${comp.props.value}');`
        );
      }
    });

    // 生成 Ref 变量
    components.forEach((comp) => {
      refVars.push(
        `const ${comp.id}_ref = useRef<${comp.name}>(null);`
      );
    });

    // 生成事件处理函数
    const generateEventHandler = (comp: any, eventName: string) => {
      const handlerName = `handle${capitalize(comp.id)}${capitalize(eventName)}`;
      const eventConfig = comp.props?.[eventName];

      if (eventConfig?.actions) {
        const actionCodes = eventConfig.actions
          .map((action: any) => {
            if (action.type === 'componentMethod') {
              return `${action.config.componentId}_ref.current?.${action.config.method}();`;
            } else if (action.type === 'domOperation') {
              return `${action.targetComponentId}_ref.current?.${action.operation};`;
            } else if (action.type === 'showMessage') {
              return `message.${action.config.type}('${action.config.text}');`; // 使用 message.success
            }
            return '';
          })
          .filter(Boolean)
          .join('\n      ');

        eventHandlers.push(`
    const ${handlerName} = () => {
      ${actionCodes}
    };
  `);
      }

      return handlerName;
    };

    // 生成 JSX 元素
    const generateJsx = (comps: any[]): string => {
      return comps
        .map((comp) => {
          const props: string[] = [];

          // 处理普通 props
          Object.entries(comp.props || {}).forEach(([key, value]) => {
            if (key.startsWith('on')) {
              const handlerName = generateEventHandler(comp, key);
              props.push(`${key}={${handlerName}}`);
            } else if (value && typeof value === 'object' && 'type' in value && 'value' in value) {
              props.push(`${key}={${value.value}}`);
            } else if (typeof value === 'string' || typeof value === 'number') {
              props.push(`${key}="${value}"`);
            }
          });

          // 处理样式
          if (comp.styles) {
            props.push(`style={${JSON.stringify(comp.styles)}}`);
          }

          // 处理 Ref
          props.push(`ref={${comp.id}_ref}`);

          const children = comp.children ? generateJsx(comp.children) : '';
          return children
            ? `<${comp.name} ${props.join(' ')}>\n      ${children}\n    </${comp.name}>`
            : `<${comp.name} ${props.join(' ')} />`;
        })
        .join('\n    ');
    };

    const jsx = generateJsx(components);
    const stateCode = stateVars.join('\n  ');
    const refCode = refVars.join('\n  ');
    const eventCode = eventHandlers.join('\n  ');

    return `
import React, { useState, useRef } from 'react';
import { message } from 'antd'; // 引入 message
${imports}

const GeneratedComponent = () => {
  ${stateCode}
  ${refCode}
  ${eventCode}

  return (
    <>
      ${jsx}
    </>
  );
};

export default GeneratedComponent;
    `;
  };

  const showModal = () => {
    const reactCode = generateReactCode(components);
    setGeneratedCode(reactCode);
    setIsModalOpen(true);
  };

  const handleEditorMount: OnMount = (editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyJ, () => {
      editor.getAction('editor.action.formatDocument')?.run();
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <button onClick={showModal} style={{ margin: '10px' }}>
        生成 React 代码
      </button>

      {/* 模态窗口 */}
      <Modal
        title="生成的 React 代码"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width="80%"
        style={{ top: 20 }}
      >
        <div
          style={{
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            backgroundColor: '#f5f5f5',
            whiteSpace: 'pre-wrap',
            fontFamily: 'monospace',
            overflow: 'auto',
            wordBreak: 'break-all',
            height: '70vh',
          }}
        >
          {generatedCode}
        </div>
      </Modal>

      {/* 原有的 JSON 编辑器区域 */}
      <div
        style={{
          flex: 1,
          margin: '10px',
          overflow: 'hidden',
        }}
      >
        <MonacoEditor
          height={'100%'}
          path="components.json"
          language="json"
          onMount={handleEditorMount}
          value={JSON.stringify(components, null, 2)}
          options={{
            fontSize: 14,
            scrollBeyondLastLine: false,
            minimap: { enabled: false },
            scrollbar: {
              verticalScrollbarSize: 6,
              horizontalScrollbarSize: 6,
            },
          }}
        />
      </div>
    </div>
  );
}