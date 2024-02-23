import WS from "../index";
import { DefaultEventMap, EventsMap, ServerNamespacesPath, WsHandler } from "../Types/Types";
import NamespaceMiddleware from "./Middleware";
import Socket from "./Socket";

// The NameSpace class represents a WebSocket namespace, holding a set of sockets.
export default class NameSpace<Path extends ServerNamespacesPath = ServerNamespacesPath, ListenEvents extends DefaultEventMap = DefaultEventMap, EmitEvents extends EventsMap = EventsMap, SocketData = any> {
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
    private readonly namespaceMiddlewares: NamespaceMiddleware<ListenEvents, EmitEvents, SocketData> = new NamespaceMiddleware();

    // Adds a middleware function to the namespace.
    public use: (callback: (socket: Socket<ListenEvents, EmitEvents, SocketData, ServerNamespacesPath<Path>, NameSpace<ServerNamespacesPath<Path>, ListenEvents, EmitEvents, SocketData>>, next: (error?: Error) => void) => void) => void = (callback) => {
        this.namespaceMiddlewares.use(callback);
    };

    // Registers an event handler for the namespace.
    public on: (handler: WsHandler, callback: (socket: Socket<ListenEvents, EmitEvents, SocketData, ServerNamespacesPath<Path>, NameSpace<ServerNamespacesPath<Path>, ListenEvents, EmitEvents, SocketData>>) => void) => void = (handler: WsHandler, callback: (socket: Socket<ListenEvents, EmitEvents, SocketData, ServerNamespacesPath<Path>, NameSpace<ServerNamespacesPath<Path>, ListenEvents, EmitEvents, SocketData>>) => void) => {
        if (handler == 'connection') {
            // Setup connection handling for the namespace.
            WS.honoApp.get(this.path, c => WS.setupWsConnection(c.req, callback, { namespace: this }, this.namespaceMiddlewares));
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