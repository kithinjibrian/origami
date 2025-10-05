export class FontWeight {
    constructor(
        public index: number,
        public value: number
    ) { }

    static w100: FontWeight = new FontWeight(1, 100);
    static w200: FontWeight = new FontWeight(2, 200);
    static w300: FontWeight = new FontWeight(3, 300);
    static w400: FontWeight = new FontWeight(4, 400);
    static w500: FontWeight = new FontWeight(5, 500);
    static w600: FontWeight = new FontWeight(6, 600);
    static w700: FontWeight = new FontWeight(7, 700);
    static w800: FontWeight = new FontWeight(8, 800);
    static w900: FontWeight = new FontWeight(9, 900);

    static normal: FontWeight = FontWeight.w400;
    static bold: FontWeight = FontWeight.w700;

    toString(): string {
        return this.value.toString();
    }
}
