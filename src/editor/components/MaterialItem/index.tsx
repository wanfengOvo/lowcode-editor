import { useDrag } from "react-dnd";
import { useComponentConfigStore } from "../../stores/component-config";

export interface MaterialItemProps {
    name: string
    desc: string
}

export function MaterialItem(props: MaterialItemProps) {
    const { componentConfig } = useComponentConfigStore();
    const {
        name,
        desc
    } = props;

    const [_, drag] = useDrag({
        type: name,
        item: {
            type: name
        }
    });

    const icon = componentConfig[name]?.icon;

    return <div
        ref={drag}
        className='
            border
            border-gray-200
            rounded
            p-2
            cursor-move
            bg-white
            hover:border-blue-500
            hover:shadow
            transition-colors
            duration-200
            text-sm
            text-gray-700
            flex
            items-center
            gap-2
            h-10
            px-3
        '
    >
        {icon && <span className="text-base">{icon}</span>}
        {desc}
    </div>
}