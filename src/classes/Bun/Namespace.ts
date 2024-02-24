import WSbun from "./index";
import { DefaultEventMap, EventsMap, ServerNamespacesPath, WsHandler } from "../../Types/Types";
import NamespaceMiddleware from "./Middleware";
import Socket from "./Socket";
import { Server } from "bun";

// The NameSpace class represents a WebSocket namespace, holding a set of sockets.
export default class NameSpace<Path extends ServerNamespacesPath = ServerNamespacesPath, ListenEvents extends EventsMap = DefaultEventMap, EmitEvents extends EventsMap = ListenEvents, SocketData = any> {
    readonly path: ServerNamespacesPath<Path>;
    // A set of sockets belonging to this namespace.
    public readonly sockets: Set<Map<string, Socket<ListenEvents, EmitEvents, SocketData, ServerNamespacesPath<Path>, NameSpace<ServerNamespacesPath<Path>, ListenEvents, EmitEvents, SocketData>>>> = new Set<Map<string, Socket<ListenEvents, EmitEvents, SocketData, ServerNamespacesPath<Path>, NameSpace<ServerNamespacesPath<Path>, ListenEvents, EmitEvents, SocketData>>>>();

    // Constructor initializes a namespace with a specific path.
    constructor(path: ServerNamespacesPath<Path>) {
        this.path = path;
        // Register the new namespace with the WS class.
        WSbun.onNewNamespace(this);
    }

    // Middleware stack for the namespace, allowing pre-connection logic to be applied.
    private static readonly namespaceMiddlewares: NamespaceMiddleware = new NamespaceMiddleware();

    // Adds a middleware function to the namespace.
    public use: (callback: (socket: Socket<ListenEvents, EmitEvents, SocketData, ServerNamespacesPath<Path>, NameSpace<ServerNamespacesPath<Path>, ListenEvents, EmitEvents, SocketData>>, next: (error?: Error, code?: number) => void) => void) => void = (callback) => {
        NameSpace['namespaceMiddlewares'].use(callback);
    };

    // Registers an event handler for the namespace.
    public on: (bunServer: Server, handler: WsHandler, callback: (socket: Socket<ListenEvents, EmitEvents, SocketData, ServerNamespacesPath<Path>, NameSpace<ServerNamespacesPath<Path>, ListenEvents, EmitEvents, SocketData>>) => void) => void = (bunServer: Server, handler: WsHandler, callback: (socket: Socket<ListenEvents, EmitEvents, SocketData, ServerNamespacesPath<Path>, NameSpace<ServerNamespacesPath<Path>, ListenEvents, EmitEvents, SocketData>>) => void) => {
        if (handler == 'connection') {
            // Setup connection handling for the namespace.
            WSbun.honoApp.get(this.path, c => WSbun.setupWsConnectionBun(bunServer, c.req, callback, { namespace: this }, NameSpace['namespaceMiddlewares']));
        }
        return;
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