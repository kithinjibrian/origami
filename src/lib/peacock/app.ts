import { Reactive } from "../../types/types";

import {
    BuildContext,
    ImmutableWidget,
    InheritedWidget,
    Widget,
} from "../../widgets/__init__";

import {
    ThemeSettings,
    ThemeData,
    ThemeMode,
    ColorScheme,
    Navigate,
    Router,
} from "./__init__";

interface ThemeParams {
    theme: ThemeData
}

export class Theme extends InheritedWidget {
    theme: ThemeData;

    constructor(
        child: Widget,
        {
            theme
        }: ThemeParams) {
        super(child);

        this.theme = theme;
    }

    static of(context: BuildContext): ThemeData {
        let result = context.dependOnInheritedWidgetOfExactTypeRequired(Theme);
        return result.theme;
    }

    updateShouldNotify(old_widget: InheritedWidget): boolean {
        return true;
    }
}

interface PeacockAppParams<
    P extends string,
    E extends string,
    Payloads extends Partial<Record<E, unknown>> = Record<E, never>
> {
    title: Reactive<string>;
    theme?: ThemeSettings;
    themeMode?: ThemeMode;
    app: Widget;
}

export class PeacockApp<
    P extends string,
    E extends string,
    Payloads extends Partial<Record<E, unknown>> = Record<E, never>
> extends ImmutableWidget {
    title: Reactive<string>;
    app: Widget;
    theme: ThemeSettings;
    themeMode: ThemeMode;

    constructor({
        title,
        app,
        theme,
        themeMode,
    }: PeacockAppParams<P, E, Payloads>) {
        super();

        this.title = title;

        this.app = app;
        this.themeMode = themeMode ?? ThemeMode.light;
        this.theme = theme ?? new ThemeSettings({
            light: new ThemeData({
                colorScheme: ColorScheme.fromSeed("#3f51b5")
            }),
            dark: new ThemeData({
                colorScheme: ColorScheme.fromSeed("#212121")
            })
        });
    }

    build(context: BuildContext): Widget {
        let activeTheme: ThemeData;

        if (this.themeMode === ThemeMode.system) {
            const prefersDark = window.matchMedia &&
                window.matchMedia('(prefers-color-scheme: dark)').matches;
            activeTheme = prefersDark ? this.theme.dark : this.theme.light;
        } else {
            activeTheme = this.themeMode === ThemeMode.light
                ? this.theme.light
                : this.theme.dark;
        }

        return new Theme(
            this.app,
            {
                theme: activeTheme
            }
        );
    }
}