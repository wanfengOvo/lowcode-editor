import { useMemo } from "react";
import { useComponentConfigStore } from "../../stores/component-config";
import { MaterialItem } from "../MaterialItem";

export function Material() {
    const { componentConfig } = useComponentConfigStore();

    const components = useMemo(() => {
        return Object.values(componentConfig).filter(item => item.name !== 'Page');
    }, [componentConfig]);

    return <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-lg">
        {components.map((item, index) => (
            <MaterialItem name={item.name} desc={item.desc} key={item.name + index} />
        ))}
    </div>
}