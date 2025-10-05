import { Reactive } from "../types/__init__";

export function resolveReactive<T>(r: Reactive<T> | undefined): T | undefined {
    if (r === undefined) return undefined;
    return typeof r === "function" ? (r as () => T)() : r;
}