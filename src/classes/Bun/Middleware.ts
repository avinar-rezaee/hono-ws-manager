import { DefaultEventMap, EventsMap, ServerNamespacesPath } from "../../Types/Types";
import NameSpace from "./Namespace";
import Socket from "./Socket";

// A middleware system for WebSocket connections within a namespace.
export default class NamespaceMiddleware<ListenEvents extends EventsMap = DefaultEventMap, EmitEvents extends EventsMap = ListenEvents, SocketData extends any = any> {
    public middlewares: Set<(...args: [socket: Socket<ListenEvents, EmitEvents, SocketData, ServerNamespacesPath, NameSpace<ServerNamespacesPath<any>, ListenEvents, EmitEvents, SocketData>>, next: (error?: Error, code?: number) => void]) => void>; // A set to store middleware functions.

    constructor() {
        this.middlewares = new Set();
    }

    // Adds a new middleware function to the set.
    use(fn: (...args: [socket: Socket<ListenEvents, EmitEvents, SocketData, ServerNamespacesPath, NameSpace<ServerNamespacesPath<any>, ListenEvents, EmitEvents, SocketData>>, next: (error?: Error, code?: number) => void]) => void) {
        this.middlewares.add(fn);
    }

    // Executes all middleware functions in sequence for a given socket.
    execute(socket: Socket<ListenEvents, EmitEvents, SocketData, ServerNamespacesPath, NameSpace<ServerNamespacesPath<any>, ListenEvents, EmitEvents, SocketData>>, finalCallback: () => void) {
        const middleware = this.middlewares.values();

        // Function to execute the next middleware in the queue.
        const dispatch = (middlewareFunction: (...args: [socket: Socket<ListenEvents, EmitEvents, SocketData, ServerNamespacesPath, NameSpace<ServerNamespacesPath<any>, ListenEvents | any, EmitEvents | any, SocketData | any>>, next: (error?: Error, code?: number) => void]) => void) => {
            const nextMiddleware = middleware.next().value;
            if (!nextMiddleware && !middlewareFunction) return finalCallback(); // If all middleware have been executed, call the final callback.
            middlewareFunction(socket, (error?: Error, code: number = 1000) => {
                if (error instanceof Error) {
                    socket.disconnect(error, code);
                }
                dispatch(nextMiddleware)
            });
        };
        dispatch(middleware.next().value);
        // Start executing from the first middleware.


    }
}