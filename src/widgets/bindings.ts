import { Widget } from "./framework";

export function run_app(widget: Widget, container: HTMLElement) {
    const rootElement = widget.render();
    container.appendChild(rootElement);
}