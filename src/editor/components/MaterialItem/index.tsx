
import { useDrag } from "react-dnd";

export interface MaterialItemProps {
    name: string
    desc: string
}

export function MaterialItem(props: MaterialItemProps) {

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
            justify-center
            h-10
        '
    >
        {desc}
    </div>
}