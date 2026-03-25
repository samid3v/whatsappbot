export declare class MessageHandler {
    private initialized;
    initialize(): Promise<void>;
    private onConnected;
    private onDisconnected;
    private handleMessage;
    private getCommandContext;
    isReady(): boolean;
}
export declare const messageHandler: MessageHandler;
export default messageHandler;
//# sourceMappingURL=message.d.ts.map