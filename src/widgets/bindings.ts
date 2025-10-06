import { BuildContext, Widget } from "./framework";

export function run_app(widget: Widget, container: HTMLElement) {
    const rootContext = new BuildContext(widget);

    const rootElement = widget.render(rootContext);

    container.appendChild(rootElement);
}