import { Typography } from 'antd';
import { CommonComponentProps } from '../../interface';

const { Text: AntdText } = Typography;

interface TextProps extends CommonComponentProps {
  strong?: boolean;
  underline?: boolean;
  italic?: boolean;
}

const Text = ({
  id,
  text,
  styles,
  strong = false,
  underline = false,
  italic = false,
}: TextProps) => {

  // 设置默认样式
  const defaultStyles = {
    fontSize: '16px',
    color: '#333',
    padding: '8px 12px',
    minWidth: '80px',
    minHeight: '20px',
    display: 'inline-block',
  };

  return (
    <AntdText
      data-component-id={id}
      style={{
        ...defaultStyles,
        ...styles, // 合并用户设置的样式
        textDecoration: underline ? 'underline' : 'none',
        fontStyle: italic ? 'italic' : 'normal',
      }}
      strong={strong}
    >
      {text}
    </AntdText>
  );
};

export default Text;