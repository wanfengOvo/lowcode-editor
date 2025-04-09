// Text.tsx
import { Typography } from 'antd';
import { CommonComponentProps } from '../../interface';
import { useDrag } from 'react-dnd';
import { useMemo } from 'react';

const { Text: AntdText } = Typography;

interface TextProps extends CommonComponentProps {
  strong?: boolean;
  underline?: boolean;
  italic?: boolean; // 保持 italic prop
}

const Text = ({
  id,
  text,
  styles,
  strong = false,
  underline = false,
  italic = false, // 接收 italic prop
}: TextProps) => {
  const [_, drag] = useDrag({
    type: 'Text',
    item: {
      type: 'Text',
      dragType: 'move',
      id: id,
    },
  });

  // 使用 useMemo 缓存样式，避免不必要的重新渲染
  const textStyle = useMemo(() => {
    return {
      ...styles,
      fontWeight: strong ? 'bold' : 'normal', // 应用加粗样式
      textDecoration: underline ? 'underline' : 'none', // 应用下划线样式
      fontStyle: italic ? 'italic' : 'normal', // 应用斜体样式
    };
  }, [styles, strong, underline, italic]);

  // 设置默认样式
  const defaultStyles = {
    fontSize: '16px',
    color: '#333',
    padding: '8px 12px',
    border: '1px dashed #ccc',
    minWidth: '80px',
    minHeight: '20px',
    display: 'inline-block',
  };

  return (
    <AntdText
      ref={drag}
      data-component-id={id}
      style={{ ...defaultStyles, ...textStyle }} 
    >
      {text}
    </AntdText>
  );
};

export default Text;