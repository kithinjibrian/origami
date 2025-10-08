import { Color } from "../../../painting/color";

export class Colors {
    // Base
    static transparent: Color = Color.fromHex("#00000000");
    static black: Color = Color.fromHex("#FF000000");
    static white: Color = Color.fromHex("#FFFFFFFF");

    // Red
    static red = {
        50: Color.fromHex("#FFEBEE"),
        100: Color.fromHex("#FFCDD2"),
        200: Color.fromHex("#EF9A9A"),
        300: Color.fromHex("#E57373"),
        400: Color.fromHex("#EF5350"),
        500: Color.fromHex("#F44336"),
        600: Color.fromHex("#E53935"),
        700: Color.fromHex("#D32F2F"),
        800: Color.fromHex("#C62828"),
        900: Color.fromHex("#B71C1C"),
        A100: Color.fromHex("#FF8A80"),
        A200: Color.fromHex("#FF5252"),
        A400: Color.fromHex("#FF1744"),
        A700: Color.fromHex("#D50000"),
    };

    // Pink
    static pink = {
        50: Color.fromHex("#FCE4EC"),
        100: Color.fromHex("#F8BBD0"),
        200: Color.fromHex("#F48FB1"),
        300: Color.fromHex("#F06292"),
        400: Color.fromHex("#EC407A"),
        500: Color.fromHex("#E91E63"),
        600: Color.fromHex("#D81B60"),
        700: Color.fromHex("#C2185B"),
        800: Color.fromHex("#AD1457"),
        900: Color.fromHex("#880E4F"),
        A100: Color.fromHex("#FF80AB"),
        A200: Color.fromHex("#FF4081"),
        A400: Color.fromHex("#F50057"),
        A700: Color.fromHex("#C51162"),
    };

    // Grey
    static grey = {
        50: Color.fromHex("#FAFAFA"),
        100: Color.fromHex("#F5F5F5"),
        200: Color.fromHex("#EEEEEE"),
        300: Color.fromHex("#E0E0E0"),
        400: Color.fromHex("#BDBDBD"),
        500: Color.fromHex("#9E9E9E"),
        600: Color.fromHex("#757575"),
        700: Color.fromHex("#616161"),
        800: Color.fromHex("#424242"),
        900: Color.fromHex("#212121"),
    };
}