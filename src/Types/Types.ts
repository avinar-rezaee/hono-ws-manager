// Defines types for handling WebSocket events and paths for server namespaces.
export type WsHandler = 'connection';
export type ServerNamespacesPath<T extends string = string> = T & string | "/ws";

// EventsMap interfaces define the structure for event handlers and default events.
export interface SocketDefaultEvent {
    ['disconnected']: () => void;
}
export interface EventsMap {
    [event: string]: any;
}

export interface DefaultEventMap {
    [event: string]: (...args: any[]) => void;
}
// Utility types for deriving event names and parameters from event maps.
export type EventNames<Map extends EventsMap> = keyof Map & (string | symbol);
export type EventParams<Map extends EventsMap, Event extends EventNames<Map>> = Parameters<Map[Event]>;
export type EventCallback<Event extends EventNames<Map>, Map extends EventsMap> = Map[Event];

export type ReservedSocketEmitEvents = "disconnected";
export type NotReservedSocketEmitEvents<Event> = Event extends ReservedSocketEmitEvents ? never : Event;


export type ReservedSocketListenEvents = "disconnect";
export type NotReservedSocketListenEvents<Event> = Event extends ReservedSocketListenEvents ? never : Event;