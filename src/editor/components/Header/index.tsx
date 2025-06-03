import { Button, Space, Modal, Input, message, Timeline, Tooltip } from 'antd';
import { ClockCircleOutlined, CheckCircleOutlined, UndoOutlined, HistoryOutlined } from '@ant-design/icons'; // HistoryOutlined
import { useComponetsStore,generateId } from '../../stores/components';
import type { Command, FullStore } from '../../stores/components'; 
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
    setComponents,
    jumpToHistoryState, 
  } = useComponetsStore() as FullStore; 

  const [jsonModalVisible, setJsonModalVisible] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [historyModalVisible, setHistoryModalVisible] = useState(false);

  const handleClearCanvas = () => {
    setComponents([{
      id: generateId(), // 确保 ID 是唯一的
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
      if (!Array.isArray(parsedComponents)) {
        throw new Error('JSON数据必须是组件数组');
      }
      setComponents(parsedComponents);
      setJsonModalVisible(false);
      setJsonInput('');
      message.success('导入成功');
    } catch (e: any) {
      message.error(`导入失败: ${e.message}`);
    }
  };

  const handleTimelineItemClick = (index: number) => {
    if (jumpToHistoryState) {
      jumpToHistoryState(index);
      setHistoryModalVisible(false); // 跳转后关闭 Modal
    }
  };

  const timelineItems = history.map((cmd: Command, index: number) => {
    const isCurrent = index === historyIndex;
    const commandDescription = cmd.description || `操作 ${index + 1}`;
    let itemIcon = <ClockCircleOutlined />;
    let itemColor: string | undefined = 'blue';

    if (isCurrent) {
      itemIcon = <CheckCircleOutlined style={{ fontSize: '16px' }} />;
      itemColor = 'green';
    } else if (index < historyIndex) {
      itemIcon = <CheckCircleOutlined style={{ fontSize: '16px', color: '#555' }}/>; // 过去已执行的
      itemColor = 'gray';
    } else {
      itemIcon = <ClockCircleOutlined style={{ fontSize: '16px' }} />; // 未来可重做的
      itemColor = 'blue';
    }

    return {
      dot: itemIcon,
      color: itemColor,
      children: (
        <Button
          type="text" // 改为 text 类型，更像列表项
          style={{ textAlign: 'left', paddingLeft: 0, color: isCurrent ? '#1677ff' : undefined }} // 当前项高亮
          onClick={() => handleTimelineItemClick(index)}
          disabled={isCurrent} // 当前状态不可点击以“跳转到自身”
          title={isCurrent ? "当前状态" : `跳转到: ${commandDescription}`}
        >
          {`${index + 1}. ${commandDescription}`}
          {isCurrent && <span style={{ fontWeight: 'bold' }}> (当前)</span>}
        </Button>
      ),
    };
  });

  const canUndo = historyIndex >= 0;
  const canRedo = historyIndex < history.length - 1;

  return (
    <div className='w-full h-full'>
      <div className='h-[50px] flex justify-between items-center px-[20px] border-b'>
        <div className='font-semibold text-lg'>低代码编辑器</div>
        <Space>
          {mode === 'edit' && (
            <>
              <Button onClick={handleClearCanvas} danger>清空</Button> {/* 简化文字 */}
              <Tooltip title="撤销 (Ctrl+Z)">
                <Button icon={<UndoOutlined />} onClick={undo} disabled={!canUndo} />
              </Tooltip>
              <Tooltip title="重做 (Ctrl+Y)">
                <Button icon={<UndoOutlined style={{ transform: 'scaleX(-1)' }} />} onClick={redo} disabled={!canRedo} />
              </Tooltip>
              <Tooltip title="操作历史">
                <Button icon={<HistoryOutlined />} onClick={() => setHistoryModalVisible(true)} disabled={history.length === 0} />
              </Tooltip>
              <Button onClick={() => setJsonModalVisible(true)}>导入JSON</Button>
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
            <Button onClick={() => { setMode('edit'); }} type='primary'>退出预览</Button>
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

      <Modal
        title="操作历史记录"
        open={historyModalVisible}
        onCancel={() => setHistoryModalVisible(false)}
        footer={null}
        width={400} // 可以适当调整宽度
        styles={{ // 使用 styles prop
    body: { // 对应之前的 bodyStyle
      maxHeight: '60vh',
      overflowY: 'auto'
    }
  }}
      >
        {history.length > 0 ? (
          <Timeline mode="left" items={timelineItems} />
        ) : (
          <p>暂无操作历史。</p>
        )}
      </Modal>
    </div>
  );
}



