import WS from "../index";
import { DefaultEventMap, EventsMap, ServerNamespacesPath, WsHandler } from "../Types/Types";
import NamespaceMiddleware from "./Middleware";
import Socket from "./Socket";
import type { Server } from "bun";

// The NameSpace class represents a WebSocket namespace, holding a set of sockets.
export default class NameSpace<Path extends ServerNamespacesPath = ServerNamespacesPath, ListenEvents extends EventsMap = DefaultEventMap, EmitEvents extends EventsMap = ListenEvents, SocketData = any> {
    readonly path: ServerNamespacesPath<Path>;
    // A set of sockets belonging to this namespace.
    public readonly sockets: Set<Map<string, Socket<ListenEvents, EmitEvents, SocketData, ServerNamespacesPath<Path>, NameSpace<ServerNamespacesPath<Path>, ListenEvents, EmitEvents, SocketData>>>> = new Set<Map<string, Socket<ListenEvents, EmitEvents, SocketData, ServerNamespacesPath<Path>, NameSpace<ServerNamespacesPath<Path>, ListenEvents, EmitEvents, SocketData>>>>();

    // Constructor initializes a namespace with a specific path.
    constructor(path: ServerNamespacesPath<Path>) {
        this.path = path;
        // Register the new namespace with the WS class.
        WS.onNewNamespace(this);
    }

    // Middleware stack for the namespace, allowing pre-connection logic to be applied.
    private readonly namespaceMiddlewares: NamespaceMiddleware = new NamespaceMiddleware();

    // Adds a middleware function to the namespace.
    public use: (callback: (socket: Socket<ListenEvents, EmitEvents, SocketData, ServerNamespacesPath<Path>, NameSpace<ServerNamespacesPath<Path>, ListenEvents, EmitEvents, SocketData>>, next: (error?: Error, code?: number) => void) => void) => void = (callback) => {
        this['namespaceMiddlewares'].use(callback);
    };

    // Registers an event handler for the namespace.
    public on: (handler: WsHandler, callback: (socket: Socket<ListenEvents, EmitEvents, SocketData, ServerNamespacesPath<Path>, NameSpace<ServerNamespacesPath<Path>, ListenEvents, EmitEvents, SocketData>>) => void) => void = (handler: WsHandler, callback: (socket: Socket<ListenEvents, EmitEvents, SocketData, ServerNamespacesPath<Path>, NameSpace<ServerNamespacesPath<Path>, ListenEvents, EmitEvents, SocketData>>) => void) => {
        if (handler == 'connection') {
            // Setup connection handling for the namespace.
            if (WS.honoApp) {
                WS.honoApp.get(this.path, c => {
                    if (WS.BunServer) {
                        const success = WS.BunServer.upgrade(c.req.raw, { data: { namespace: this, namespaceMiddlewares: this.namespaceMiddlewares, callback } });
                        if (!success) {
                            return new Response('Expected Upgrade: websocket', { status: 426 });
                        }
                        return new Response(null, {
                            status: 101
                        });
                    }
                    else {
                        const upgradeHeader = c.req.header('Upgrade');
                        if (!upgradeHeader || upgradeHeader !== 'websocket') {
                            return new Response('Expected Upgrade: websocket', { status: 426 });
                        }

                        const webSocketPair = new WebSocketPair();
                        const [client, server] = Object.values<WebSocket>(webSocketPair);

                        server.accept();

                        WS.WsEventEmitter.emit('newSocketConnected', server, { namespace: this, namespaceMiddlewares: this.namespaceMiddlewares, callback })

                        return new Response(null, {
                            status: 101,
                            webSocket: client,
                        });
                    }
                });

            }
            else {
                WS.WsEventEmitter.addListener(`upgradeBunServerForNamespace:${this.path}`, ({ req, BunServer }: { req: Request, BunServer: Server }) => {
                    console.log(new URL(req.url).pathname, 'new URL(req.url).pathname');
                    console.log('log1');
                    const success = BunServer.upgrade<{ namespace: NameSpace, namespaceMiddlewares: NamespaceMiddleware, callback: (socket: Socket | any) => void }>(req, { data: { namespace: this, namespaceMiddlewares: this.namespaceMiddlewares, callback } });
                    console.log('log2');
                    WS.WsEventEmitter.emit(`upgradeBunServerForNamespace:${this.path}=>Status`, { success });
                });
                WS.WsEventEmitter.addListener(`handleNewWebSocketRequestToNamespace:${this.path}`, server => {
                    WS.WsEventEmitter.emit('newSocketConnected', server, { namespace: this, namespaceMiddlewares: this.namespaceMiddlewares, callback })
                });
            }
        }
    };

    // Retrieves a socket by its ID from the namespace.
    getSocket(socketID: string) {
        for (const item of this.sockets) {
            if (item.get(socketID)) {
                return item.get(socketID);
            }
        }
    }
}