import WSbun from "./index";
import { DefaultEventMap, EventNames, EventParams, EventsMap, ServerNamespacesPath, ReservedSocketEmitEvents, NotReservedSocketEmitEvents, NotReservedSocketListenEvents, SocketDefaultEvent, EventCallback } from "../../Types/Types";
import NameSpace from "./Namespace";
import { EventEmitter } from 'node:events';

// The Socket class represents an individual WebSocket connection.
export default class Socket<ListenEvents extends EventsMap = DefaultEventMap, EmitEvents extends EventsMap = ListenEvents, SocketData extends any = any, NamespacePath extends ServerNamespacesPath = ServerNamespacesPath, Namespace extends NameSpace<ServerNamespacesPath<NamespacePath | string>, ListenEvents, EmitEvents, SocketData> = NameSpace<ServerNamespacesPath<NamespacePath | string>, ListenEvents, EmitEvents, SocketData>> {
    private ws: typeof WSbun.ws; // The WebSocket server instance.
    readonly id: string; // Unique identifier for the socket.
    readonly namespace: Namespace; // The namespace this socket belongs to.
    public data: SocketData; // Generic data associated with this socket, can be used to store state or context.
    public eventEmitter: EventEmitter;
    // Constructor to initialize the socket with necessary parameters.
    constructor({ id, ws, namespace, data, eventEmitter }: { ws: typeof WSbun.ws, id: string, namespace: Namespace, data: SocketData, eventEmitter: EventEmitter }) {
        this['ws'] = ws;
        this.id = id;
        this.namespace = namespace;
        this.data = data;
        this.eventEmitter = eventEmitter;

        this.eventEmitter.addListener('connectionClosed', (code: number, reason: string) => {
            this.disconnect(new Error(reason), code);
        })

    }

    // Method to register an event listener for a specific WebSocket message event.
    on<Event extends NotReservedSocketListenEvents<EventNames<ListenEvents & SocketDefaultEvent>>>(handler: Event | NotReservedSocketListenEvents<EventNames<ListenEvents & SocketDefaultEvent>>, eventCallback: EventCallback<Event, ListenEvents & SocketDefaultEvent>) {
        if (handler == 'disconnected') {
            this.eventEmitter.addListener('connectionClosed', (code: any, reason: any) => {
                eventCallback()
            })

        }
        this.eventEmitter.addListener(`newIncomingMessageToNamespace${this.ws.data.socket.namespace.path}`, (ws: typeof WSbun["ws"], message: string | Buffer) => {
            if (typeof message === 'string') {
                const payload = JSON.parse(message);
                if (payload.MessageEvent === handler) {
                    eventCallback(payload.data ?? {});
                }
            }
        })
    }


    // Method to emit a message event to the client through this socket.
    emit<Event extends NotReservedSocketEmitEvents<EventNames<EmitEvents>>>(handler: Event, ...data: EventParams<EmitEvents, Event>) {
        this['ws'].send(JSON.stringify({ MessageEvent: handler, data: data.length == 1 ? data[0] : data }));
    }

    // Disconnects the socket, optionally passing an error if the disconnection was due to an error.
    disconnect(e?: Error, code: number = 1000) {
        // this.ws.close(1000, e?.message); // Use WebSocket standard code 1000 for normal closure.
        this['ws'].close(code, e?.message);
        // Remove the socket from the global socket set and its namespace's socket set.
        for (const item of WSbun.sockets) {
            if (item.get(this.id)) {
                WSbun.sockets.delete(item);
            }
        }
        const socketNamespace = WSbun.getNamespace(this.namespace.path);
        if (socketNamespace) {
            for (const item of socketNamespace.sockets) {
                if (item.get(this.id)) {
                    socketNamespace.sockets.delete(item);
                }
            }
        }
    }
}