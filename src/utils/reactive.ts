import { Reactive } from "../types/__init__";

export function resolveReactive<T>(r: Reactive<T>): T {
    return typeof r === "function" ? (r as () => T)() : r;
}

export function bind<T>(
    element: HTMLElement,
    property: keyof HTMLElement | keyof CSSStyleDeclaration | string,
    value: Reactive<T>,
    effect: (fn: () => void) => void
) {
    const update = () => {
        const val = typeof value === "function" ? (value as () => T)() : value;

        if (property === "textContent" || property === "innerHTML") {
            (element as any)[property] = val;
        } else if (property in element.style) {
            (element.style as any)[property] = val;
        } else {
            element.setAttribute(String(property), String(val));
        }
    };

    if (typeof value === "function") {
        effect(update);
    } else {
        update();
    }
}
