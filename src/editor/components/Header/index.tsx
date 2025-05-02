import { useState } from 'react';
import { Button, Space, Modal, Input, message, Dropdown, Timeline, Tooltip } from 'antd'; // Import Tooltip
import { useComponetsStore } from '../../stores/components';
import { ClockCircleOutlined } from '@ant-design/icons';

export function Header() {
  const {
    mode,
    setMode,
    setCurComponentId,
    undo,
    redo,
    history,
    historyIndex,
    setComponents,
    jumpToHistory,
    components,
    copyComponentToClipboard,
    pasteComponent,
    curComponentId,
    copyComponent
  } = useComponetsStore();

  const [jsonModalVisible, setJsonModalVisible] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [exportModalVisible, setExportModalVisible] = useState(false);


  const handleClearCanvas = () => {
    setComponents([{
      id: 1,
      name: 'Page',
      props: { style: { width: '100%', minHeight: '80vh', backgroundColor: '#ffffff' } },
      desc: '页面根节点',
      children: [],
    }]);
    message.success('画布已清空，保留Page组件');
  };
  const handleImportJson = () => {
    try {
      const parsedComponents = JSON.parse(jsonInput);
      if (!Array.isArray(parsedComponents) || parsedComponents.length === 0 || !parsedComponents[0]?.id) {
        throw new Error('JSON 格式无效。必须是一个包含组件对象的数组，且至少包含一个根组件。');
      }
      setComponents(parsedComponents);
      setJsonModalVisible(false);
      setJsonInput('');
      message.success('导入成功！');
    } catch (e: any) {
      message.error(`导入失败: ${e.message}`);
    }
  };

  // Function to handle opening the export modal
  const showExportModal = () => {
    setExportModalVisible(true);
  };

  // Function to copy JSON to clipboard
  const handleCopyJson = () => {
    const jsonString = JSON.stringify(components, null, 2); // Pretty print
    navigator.clipboard.writeText(jsonString)
      .then(() => {
        message.success('当前组件 JSON 已复制到剪贴板！');
        setExportModalVisible(false);
      })
      .catch(err => {
        message.error('复制失败: ' + err);
      });
  };


  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString(undefined, {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    });
  };

  const renderHistoryTimeline = () => (
    <div style={{
      maxHeight: '400px',
      overflowY: 'auto',
      padding: '12px 8px',
      backgroundColor: 'white',
      boxShadow: '0 3px 6px -4px rgba(0,0,0,.12), 0 6px 16px 0 rgba(0,0,0,.08), 0 9px 28px 8px rgba(0,0,0,.05)',
      borderRadius: '4px',
      minWidth: '280px'
    }}>
      {history.length > 0 ? (
        <Timeline mode="left">
          {/* Map over history entries */}
          {history.map((entry, index) => (
            <Timeline.Item
              key={`${entry.timestamp}-${index}`}
              color={index === historyIndex ? 'blue' : 'gray'}
              dot={index === historyIndex ? <ClockCircleOutlined style={{ fontSize: '16px', color: 'blue' }} /> : undefined}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>

                <div style={{ flexGrow: 1, marginRight: '8px' }}>
                  <Button
                    type="link"
                    size="small"
                    style={{ padding: '0', height: 'auto', lineHeight: 'normal', textAlign: 'left' }}
                    onClick={() => jumpToHistory(index)}
                    disabled={index === historyIndex}
                  >
                    {entry.description || (index === 0 ? 'Initial State' : `Step ${index}`)}
                  </Button>
                  {entry.type === 'patch' && (
                    <Tooltip title={`${entry.forwardPatch.length} operation(s)`} placement="bottomLeft">
                      <span style={{ fontSize: '10px', color: '#aaa', marginLeft: '4px', cursor: 'default' }}>
                        ({entry.forwardPatch.length} ops)
                      </span>
                    </Tooltip>
                  )}
                </div>
                <div style={{ fontSize: '11px', color: '#888', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {formatTimestamp(entry.timestamp)}
                </div>
              </div>
            </Timeline.Item>
          ))}
        </Timeline>
      ) : (
        <div style={{ textAlign: 'center', color: '#aaa', padding: '10px' }}>暂无历史记录</div>
      )}
    </div>
  );

  return (
    <div className='w-[100%] h-[100%] border-b border-gray-200'>
      <div className='h-[50px] flex justify-between items-center px-[20px]'>
        <div className='font-semibold text-lg'>低代码编辑器</div>
        <Space size="middle">
          {mode === 'edit' && (
            <>
              <Button onClick={handleClearCanvas} danger>清空画布</Button>
              <Button onClick={undo} disabled={historyIndex <= 0}>撤销</Button>
              <Button onClick={redo} disabled={historyIndex >= history.length - 1}>重做</Button>
              <Dropdown
                menu={{ items: [{ key: 'timeline', label: renderHistoryTimeline() }] }}
                trigger={['click']}
                disabled={history.length <= 1}
              >
                <Button>历史记录 ({historyIndex + 1}/{history.length})</Button>
              </Dropdown>
              <Button onClick={() => copyComponentToClipboard(curComponentId || 0)} disabled={!curComponentId}>复制</Button>
              <Button onClick={() => pasteComponent(curComponentId ?? 0)} disabled={!copyComponent}>粘贴</Button>
              <Button onClick={() => setJsonModalVisible(true)}>导入JSON</Button>
              <Button onClick={showExportModal}>导出JSON</Button> {/* Add Export Button */}
              <Button onClick={() => { setMode('preview'); setCurComponentId(null); }} type='primary'>预览</Button>
            </>
          )}
          {mode === 'preview' && (
            <Button onClick={() => { setMode('edit') }} type='primary'>退出预览</Button>
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
        destroyOnClose
      >
        <Input.TextArea
          rows={15}
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder="请粘贴JSON格式的组件数据（必须是以 Page 组件为根的数组结构）"
        />
      </Modal>

      <Modal
        title="导出当前组件JSON"
        open={exportModalVisible}
        onCancel={() => setExportModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setExportModalVisible(false)}>
            取消
          </Button>,
          <Button key="copy" type="primary" onClick={handleCopyJson}>
            复制到剪贴板
          </Button>,
        ]}
        destroyOnClose
        width={600}
      >
        <Input.TextArea
          rows={15}
          value={JSON.stringify(components, null, 2)}
          readOnly // Make it read-only
          placeholder="当前组件结构JSON"
          style={{ fontFamily: 'monospace' }}
        />
      </Modal>
    </div>
  )
}