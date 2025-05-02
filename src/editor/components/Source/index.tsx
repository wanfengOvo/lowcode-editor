import { useState, useMemo } from 'react';
import MonacoEditor, { OnMount } from '@monaco-editor/react';
import { useComponetsStore } from '../../stores/components';
import { componentConfigs } from '../../config/componentConfigs';
import { generateFullReactFile } from '../../utils/codeGenerator';
import { Button, Modal } from 'antd';

export function Source() {
  const { components } = useComponetsStore();
  const [generatedCode, setGeneratedCode] = useState<string>('// Generating code...');
  const [modalVisible, setModalVisible] = useState(false);

  const rootComponent = useMemo(() => {
    if (Array.isArray(components) && components.length > 0) {
      return components[0];
    }
    if (components && typeof components === 'object' && !Array.isArray(components)) {
      return components;
    }
    return null;
  }, [components]);

  const handleGenerateCode = () => {
    if (rootComponent) {
      const code = generateFullReactFile(rootComponent, componentConfigs, '../../marterials');
      setGeneratedCode(code);
      setModalVisible(true);
    }
  };

  const handleEditorMount: OnMount = (editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      editor.getAction('editor.action.formatDocument')?.run();
    });
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px' }}>
        <Button
          type="primary"
          onClick={handleGenerateCode}

        >
          生成React代码
        </Button>
      </div>
      <div style={{ flex: 1 }}>
        <MonacoEditor
          height={'100%'}
          language="json"
          path="components.json"
          options={{
            readOnly: false,
            fontSize: 14,
            scrollBeyondLastLine: false,
            minimap: { enabled: false },
            scrollbar: {
              verticalScrollbarSize: 6,
              horizontalScrollbarSize: 6,
            },
            tabSize: 2,
            insertSpaces: true,
            automaticLayout: true,
            wordWrap: 'on',
            'semanticHighlighting.enabled': true,
          }}
          value={JSON.stringify(components, null, 2)}
          onMount={handleEditorMount}
        />
      </div>

      <Modal
        title="生成的React代码"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width="80%"
        footer={null}
        style={{ top: 20 }}
        destroyOnClose
      >
        <div style={{ height: '70vh' }}>
          <MonacoEditor
            height="100%"
            language="javascript"
            path="generated-page.jsx"
            options={{
              readOnly: true,
              fontSize: 14,
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              scrollbar: {
                verticalScrollbarSize: 6,
                horizontalScrollbarSize: 6,
              },
              tabSize: 2,
              insertSpaces: true,
              automaticLayout: true,
              wordWrap: 'on',
              'semanticHighlighting.enabled': true,
            }}
            value={generatedCode}
            onMount={handleEditorMount}
          />
        </div>
      </Modal>
    </div>
  );
}