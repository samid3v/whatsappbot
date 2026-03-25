declare module 'qrcode-terminal' {
    function generate(code: string, opts?: { small?: boolean }): void;
    export = { generate };
}
