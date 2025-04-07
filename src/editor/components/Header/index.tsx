import { Button, Space, Modal, Input, message } from 'antd';
import { useComponetsStore } from '../../stores/components';
import { useState } from 'react';

export function Header() {
  const { 
    mode, 
    setMode, 
    setCurComponentId, 
    undo, 
    redo, 
    history, 
    historyIndex,
    setComponents 
  } = useComponetsStore();
  
  const [jsonModalVisible, setJsonModalVisible] = useState(false);
  const [jsonInput, setJsonInput] = useState('');

  const handleImportJson = () => {
    try {
      const parsedComponents = JSON.parse(jsonInput);
      if (!Array.isArray(parsedComponents)) {
        throw new Error('JSON数据必须是组件数组');
      }
      setComponents(parsedComponents);
      setJsonModalVisible(false);
      setJsonInput('');
      message.success('导入成功');
    } catch (e) {
      message.error(`导入失败: ${e.message}`);
    }
  };

  return (
    <div className='w-[100%] h-[100%]'>
      <div className='h-[50px] flex justify-between items-center px-[20px]'>
        <div>低代码编辑器</div>
        <Space>
          {mode === 'edit' && (
            <>
              <Button
                onClick={undo}
                disabled={historyIndex <= 0}
              >
                撤销
              </Button>
              <Button
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
              >
                重做
              </Button>
              <Button onClick={() => setJsonModalVisible(true)}>
                导入JSON
              </Button>
              <Button
                onClick={() => {
                  setMode('preview');
                  setCurComponentId(null);
                }}
                type='primary'
              >
                预览
              </Button>
            </>
          )}
          {mode === 'preview' && (
            <Button
              onClick={() => { setMode('edit') }}
              type='primary'
            >
              退出预览
            </Button>
          )}
        </Space>
      </div>

      <Modal
        title="导入JSON数据"
        open={jsonModalVisible}
        onOk={handleImportJson}
        onCancel={() => setJsonModalVisible(false)}
        okText="导入"
        cancelText="取消"
      >
        <Input.TextArea
          rows={10}
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder="请输入JSON格式的组件数据"
        />
      </Modal>
    </div>
  )
}