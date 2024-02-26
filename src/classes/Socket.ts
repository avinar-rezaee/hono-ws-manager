import WS from "../index";
import { DefaultEventMap, EventNames, EventParams, EventsMap, ServerNamespacesPath, NotReservedSocketEmitEvents, NotReservedSocketListenEvents, SocketDefaultEvent, EventCallback, BunWebSocket } from "../Types/Types";
import NameSpace from "./Namespace";
import { EventEmitter } from 'node:events';;



// The Socket class represents an individual WebSocket connection.
export default class Socket<ListenEvents extends EventsMap = DefaultEventMap, EmitEvents extends EventsMap = ListenEvents, SocketData extends any = any, NamespacePath extends ServerNamespacesPath = ServerNamespacesPath, Namespace extends NameSpace<ServerNamespacesPath<NamespacePath | string>, ListenEvents, EmitEvents, SocketData> = NameSpace<ServerNamespacesPath<NamespacePath | string>, ListenEvents, EmitEvents, SocketData>> {
    private ws: { Bun?: BunWebSocket, cloudflare?: WebSocket }; // The WebSocket server instance.
    readonly id: string; // Unique identifier for the socket.
    readonly namespace: Namespace; // The namespace this socket belongs to.
    public data: SocketData; // Generic data associated with this socket, can be used to store state or context.
    public eventEmitter: EventEmitter;
    // Constructor to initialize the socket with necessary parameters.
    constructor({ id, WS, wsCloudflare, namespace, data, eventEmitter }: { WS?: BunWebSocket, wsCloudflare?: WebSocket, id: string, namespace: Namespace, data: SocketData, eventEmitter: EventEmitter }) {
        this['ws'] = {
            Bun: WS,
            cloudflare: wsCloudflare
        };
        this.id = id;
        this.namespace = namespace;
        this.data = data;
        this.eventEmitter = eventEmitter;


        if (this.ws.Bun) {
            this.eventEmitter.addListener('connectionClosed', (code: number, reason: string) => {
                this.disconnect(new Error(reason), code);
            });
        }
        else if (this.ws.cloudflare) {
            this.ws.cloudflare.addEventListener('close', (event) => {
                this.disconnect(new Error(event.reason), event.code);
            });
        }


    }

    // Method to register an event listener for a specific WebSocket message event.
    on<Event extends NotReservedSocketListenEvents<EventNames<ListenEvents & SocketDefaultEvent>>>(handler: Event | NotReservedSocketListenEvents<EventNames<ListenEvents & SocketDefaultEvent>>, eventCallback: EventCallback<Event, ListenEvents & SocketDefaultEvent>) {
        if (this.ws.Bun) {
            if (handler == 'disconnected') {
                this.eventEmitter.addListener('connectionClosed', (code: number, reason: string) => {
                    eventCallback();
                });
            }

            this.eventEmitter.addListener(`newIncomingMessageToNamespace${this.namespace.path}`, (ws: BunWebSocket, message: string | Buffer) => {
                if (typeof message === 'string') {
                    const payload = JSON.parse(message);
                    if (payload.MessageEvent === handler) {
                        eventCallback(payload.data ?? {});
                    }
                }
            })
        }
        else if (this.ws.cloudflare) {
            if (handler == 'disconnected') {
                this.ws.cloudflare.addEventListener('close', () => {
                    eventCallback();
                });
            }
            this.ws.cloudflare.addEventListener('message', event => {
                if (typeof event.data === 'string') {
                    const payload = JSON.parse(event.data);
                    if (payload.MessageEvent === handler) {
                        eventCallback(payload.data ?? {});
                    }
                }
            });
        }





    }


    // Method to emit a message event to the client through this socket.
    emit<Event extends NotReservedSocketEmitEvents<EventNames<EmitEvents>>>(handler: Event, ...data: EventParams<EmitEvents, Event>) {
        if (this.ws.Bun) {
            this['ws'].Bun.send(JSON.stringify({ MessageEvent: handler, data: data.length == 1 ? data[0] : data }));
        }
        else if (this.ws.cloudflare) {
            this['ws'].cloudflare.send(JSON.stringify({ MessageEvent: handler, data: data.length == 1 ? data[0] : data }));
        }
    }

    // Disconnects the socket, optionally passing an error if the disconnection was due to an error.
    disconnect(e?: Error, code: number = 1000) {
        // Use WebSocket standard code 1000 for normal closure.
        if (this.ws.Bun) {
            this['ws'].Bun.close(code, e?.message);
        }
        else if (this.ws.cloudflare) {
            this['ws'].cloudflare.close(code, e?.message);
        }
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