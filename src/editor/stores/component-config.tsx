import { create } from 'zustand';
import ContainerDev from '../materials/Container/dev';
import ContainerProd from '../materials/Container/prod';
import ButtonDev from '../materials/Button/dev';
import ButtonProd from '../materials/Button/prod';
import PageDev from '../materials/Page/dev';
import PageProd from '../materials/Page/prod';
import ModalProd from '../materials/Modal/prod';
import ModalDev from '../materials/Modal/dev';
import TableDev from '../materials/Table/dev';
import TableProd from '../materials/Table/prod';
import TableColumnDev from '../materials/TableColumn/dev';
import TableColumnProd from '../materials/TableColumn/prod';
import FormDev from '../materials/Form/dev';
import FormProd from '../materials/Form/prod';
import FormItemDev from '../materials/FormItem/dev';
import FormItemProd from '../materials/FormItem/prod';
import TextDev from '../materials/Text/dev';
import TextProd from '../materials/Text/prod';

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
}

interface State {
    componentConfig: { [key: string]: ComponentConfig };
    history: { [key: string]: ComponentConfig }[];
    historyIndex: number;
}

interface Action {
    registerComponent: (name: string, componentConfig: ComponentConfig) => void;
    undo: () => void;
    redo: () => void;
    saveHistory: () => void;
}

export const useComponentConfigStore = create<State & Action>((set, get) => {
    const initialComponentConfig = {
        Container: {
            name: 'Container',
            defaultProps: {},
            desc: '容器',
            dev: ContainerDev,
            prod: ContainerProd
        },
        Text: {
            name: 'Text',
            defaultProps: {
                text: '文本内容',
                strong: false,
                underline: false
            },
            setter: [
                {
                    name: 'text',
                    label: '文本内容',
                    type: 'input'
                },
                {
                    name: 'strong',
                    label: '加粗',
                    type: 'switch'
                },
                {
                    name: 'underline',
                    label: '下划线',
                    type: 'switch'
                }
            ],
            stylesSetter: [
                {
                    name: 'fontSize',
                    label: '字体大小',
                    type: 'inputNumber'
                }
            ],
            desc: '文本组件',
            dev: TextDev,
            prod: TextProd
        },
        Button: {
            name: 'Button',
            defaultProps: {
                type: 'primary',
                text: '按钮'
            },
            setter: [
                {
                    name: 'type',
                    label: '按钮类型',
                    type: 'select',
                    options: [
                        { label: '主按钮', value: 'primary' },
                        { label: '次按钮', value: 'default' },
                    ],
                },
                {
                    name: 'text',
                    label: '文本',
                    type: 'input',
                },
            ],
            stylesSetter: [
                {
                    name: 'width',
                    label: '宽度',
                    type: 'inputNumber',
                },
                {
                    name: 'height',
                    label: '高度',
                    type: 'inputNumber',
                }
            ],
            events: [
                {
                    name: 'onClick',
                    label: '点击事件',
                },
                {
                    name: 'onDoubleClick',
                    label: '双击事件'
                },
            ],
            desc: '按钮',
            dev: ButtonDev,
            prod: ButtonProd
        },
        Modal: {
            name: 'Modal',
            defaultProps: {
                title: '弹窗'
            },
            setter: [
                {
                    name: 'title',
                    label: '标题',
                    type: 'input'
                }
            ],
            stylesSetter: [],
            events: [
                {
                    name: 'onOk',
                    label: '确认事件',
                },
                {
                    name: 'onCancel',
                    label: '取消事件'
                },
            ],
            methods: [
                {
                    name: 'open',
                    label: '打开弹窗',
                },
                {
                    name: 'close',
                    label: '关闭弹窗'
                }
            ],
            desc: '弹窗',
            dev: ModalDev,
            prod: ModalProd
        },
        Page: {
            name: 'Page',
            defaultProps: {},
            desc: '页面',
            dev: PageDev,
            prod: PageProd
        },
        Table: {
            name: 'Table',
            defaultProps: {},
            desc: '表格',
            setter: [
                {
                    name: 'url',
                    label: 'url',
                    type: 'input',
                },
            ],
            dev: TableDev,
            prod: TableProd
        },
        TableColumn: {
            name: 'TableColumn',
            desc: '表格列',
            defaultProps: {
                dataIndex: `col_${new Date().getTime()}`,
                title: '列名'
            },
            setter: [
                {
                    name: 'type',
                    label: '类型',
                    type: 'select',
                    options: [
                        {
                            label: '文本',
                            value: 'text',
                        },
                        {
                            label: '日期',
                            value: 'date',
                        },
                    ],
                },
                {
                    name: 'title',
                    label: '标题',
                    type: 'input',
                },
                {
                    name: 'dataIndex',
                    label: '字段',
                    type: 'input',
                },
            ],
            dev: TableColumnDev,
            prod: TableColumnProd,
        },
        Form: {
            name: 'Form',
            defaultProps: {},
            desc: '表单',
            setter: [
                {
                    name: 'title',
                    label: '标题',
                    type: 'input',
                },
            ],
            events: [
                {
                    name: 'onFinish',
                    label: '提交事件',
                }
            ],
            methods: [
                {
                    name: 'submit',
                    label: '提交',
                }
            ],
            dev: FormDev,
            prod: FormProd
        },
        FormItem: {
            name: 'FormItem',
            desc: '表单项',
            defaultProps: {
                name: new Date().getTime(),
                label: '姓名'
            },
            dev: FormItemDev,
            prod: FormItemProd,
            setter: [
                {
                    name: 'type',
                    label: '类型',
                    type: 'select',
                    options: [
                        {
                            label: '文本',
                            value: 'input',
                        },
                        {
                            label: '日期',
                            value: 'date',
                        },
                    ],
                },
                {
                    name: 'label',
                    label: '标题',
                    type: 'input',
                },
                {
                    name: 'name',
                    label: '字段',
                    type: 'input',
                },
                {
                    name: 'rules',
                    label: '校验',
                    type: 'select',
                    options: [
                        {
                            label: '必填',
                            value: 'required',
                        },
                    ],
                }
            ]
        }
    };

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

        undo: () => {
            const { history, historyIndex } = get();
            if (historyIndex > 0) {
                set({
                    componentConfig: JSON.parse(JSON.stringify(history[historyIndex - 1])),
                    historyIndex: historyIndex - 1
                });
            }
        },

        redo: () => {
            const { history, historyIndex } = get();
            if (historyIndex < history.length - 1) {
                set({
                    componentConfig: JSON.parse(JSON.stringify(history[historyIndex + 1])),
                    historyIndex: historyIndex + 1
                });
            }
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