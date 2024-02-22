import WS from "..";
import { DefaultEventMap, EventNames, EventParams, EventsMap, ServerNamespacesPath } from "../Types/Types";
import NameSpace from "./Namespace";

// The Socket class represents an individual WebSocket connection.
export default class Socket<ListenEvents extends DefaultEventMap = DefaultEventMap, EmitEvents extends EventsMap = EventsMap, SocketData extends any = any, NamespacePath extends ServerNamespacesPath = ServerNamespacesPath, Namespace extends NameSpace<ServerNamespacesPath<NamespacePath | string>, ListenEvents, EmitEvents, SocketData> = NameSpace> {
    readonly WsServer: WebSocket; // The WebSocket server instance.
    readonly id: string; // Unique identifier for the socket.
    readonly namespace: Namespace; // The namespace this socket belongs to.
    public data: SocketData; // Generic data associated with this socket, can be used to store state or context.

    // Constructor to initialize the socket with necessary parameters.
    constructor({ id, server, namespace, data }: { server: WebSocket, id: string, namespace: Namespace, data: SocketData }) {
        this.WsServer = server;
        this.id = id;
        this.namespace = namespace;
        this.data = data;

        // Register an event listener for the 'close' event to handle socket disconnection.
        this.WsServer.addEventListener('close', () => {
            this.disconnect();
        });
    }

    // Method to register an event listener for a specific WebSocket message event.
    on(handler: keyof ListenEvents, eventCallback: ListenEvents[keyof ListenEvents]) {
        this.WsServer.addEventListener('message', event => {
            if (typeof event.data === 'string') {
                const payload = JSON.parse(event.data);
                if (payload.MessageEvent === handler) {
                    eventCallback(payload.data ?? {});
                }
            }
        });
    }

    // Method to emit a message event to the client through this socket.
    emit<Event extends EventNames<EmitEvents>>(handler: Event, ...data: EventParams<EmitEvents, Event>) {
        this.WsServer.send(JSON.stringify({ MessageEvent: handler, data }));
    }

    // Disconnects the socket, optionally passing an error if the disconnection was due to an error.
    disconnect(e?: Error) {
        this.WsServer.close(1000, e?.message); // Use WebSocket standard code 1000 for normal closure.

        // Remove the socket from the global socket set and its namespace's socket set.
        for (const item of WS.sockets) {
            if (item.get(this.id)) {
                WS.sockets.delete(item);
            }
        }
        const socketNamespace = WS.getNamespace(this.namespace.path);
        if (socketNamespace) {
            for (const item of socketNamespace.sockets) {
                if (item.get(this.id)) {
                    socketNamespace.sockets.delete(item);
                }
            }
        }
    }
}