// Imports necessary modules and types from Hono, as well as utility functions.
import { v4 as uuidV4 } from "uuid";
import type { Hono, HonoRequest } from 'hono';
import NameSpace from '../Bun/Namespace';
import { DefaultEventMap, EventsMap, NotReservedSocketEmitEvents, ServerNamespacesPath } from '../../Types/Types';
import Socket from '../Bun/Socket';
import NamespaceMiddleware from '../Bun/Middleware';
import { Server, ServerWebSocket, WebSocketHandler } from 'bun';
// const workerURL = new URL("worker.ts", import.meta.url).href;
import { EventEmitter } from 'node:events';
// export const eventEmitter = new EventEmitter();

// The WS class encapsulates WebSocket functionality, including namespace and socket management.
export default class WSbun<ServerNameSpacesPaths extends string = string, ListenEvents extends EventsMap = DefaultEventMap, EmitEvents extends EventsMap = EventsMap, SocketData = any> {
  // Holds a default namespace for WebSocket connections.
  public readonly defaultNamespace: NameSpace<ServerNamespacesPath<ServerNameSpacesPaths>, ListenEvents, EmitEvents, SocketData> = new NameSpace('/ws');
  // Static reference to the Hono app for managing routes and middleware.
  static honoApp: Hono;
  // static bunServer: Server;
  // Sets for tracking all socket connections and namespaces.
  public readonly Sockets: Set<Map<string, Socket<ListenEvents, EmitEvents, SocketData, ServerNamespacesPath<ServerNameSpacesPaths>, NameSpace<ServerNamespacesPath<ServerNameSpacesPaths>, ListenEvents, EmitEvents, SocketData>>>>;
  public readonly Namespaces: Set<Map<string, NameSpace<ServerNamespacesPath<ServerNameSpacesPaths>, ListenEvents, EmitEvents, SocketData>>>;
  // Static sets for global access to sockets and namespaces.
  public static readonly sockets: Set<Map<string, Socket>> = new Set<Map<string, Socket>>();
  public static readonly namespaces: Set<Map<string, NameSpace>> = new Set<Map<string, NameSpace>>();

  // Method for handling namespace-specific operations, returning a namespace instance.
  of: (namespace: ServerNamespacesPath<ServerNameSpacesPaths>) => NameSpace<ServerNamespacesPath<ServerNameSpacesPaths>, ListenEvents, EmitEvents, SocketData>

  public static readonly ws: ServerWebSocket<{ socket: Socket, namespace: NameSpace, namespaceMiddlewares: NamespaceMiddleware, callback: (socket: Socket | any) => void }>

  public websocket: WebSocketHandler<{ socket: Socket, namespace: NameSpace, namespaceMiddlewares: NamespaceMiddleware, callback: (socket: Socket | any) => void }>
  public static websocket: WebSocketHandler<{ socket: Socket, namespace: NameSpace, namespaceMiddlewares: NamespaceMiddleware, callback: (socket: Socket | any) => void }> = {
    open(ws) {
      console.log('socket opened')
      ws.send(JSON.stringify({ data: { foo: 'bar' } }))
      const { namespace, namespaceMiddlewares, callback } = ws.data
      const id = uuidV4();
      const eventEmitter = new EventEmitter();
      const socket = new Socket({ ws, id, namespace, data: null, eventEmitter });
      ws.data.socket = socket;
      // Join the socket to the namespace and apply middleware.
      WSbun.onSocketJoin(socket);
      namespaceMiddlewares.execute(socket, () => callback(socket));
    },
    close(ws, code, reason) {
      ws.data.socket.eventEmitter.emit('connectionClosed', code, reason);
    },
    message(ws, message) {
      ws.data.socket.eventEmitter.emit(`newIncomingMessageToNamespace${ws.data.socket.namespace.path}`, ws, message);
    },

  }


  // Initializes WebSocket functionality with a given Hono app.
  constructor({ honoApp: honoAppConstructor }: { honoApp: Hono }) {
    WSbun.honoApp = honoAppConstructor;
    // WSbun.bunServer = bunServerConstructor;
    this.Sockets = <any>WSbun.sockets;
    this.Namespaces = <any>WSbun.namespaces;
    // Method for obtaining a namespace by path or creating a new one if it doesn't exist.
    this.of = (namespace) => {
      const hasNamespace = <any>WSbun.getNamespace(namespace);
      if (hasNamespace) return hasNamespace;
      const newNamespace = new NameSpace<ServerNamespacesPath<ServerNameSpacesPaths>, ListenEvents, EmitEvents, SocketData>(namespace);
      return newNamespace;
    }
    this.websocket = WSbun.websocket;
  }

  // Retrieves a namespace by its path from the instance's namespace set.
  public getNamespace(namespace: ServerNamespacesPath<ServerNameSpacesPaths>) {
    for (const item of this.Namespaces) {
      if (item.get(namespace)) {
        return item.get(namespace);
      }
    }
  }

  // Static method to retrieve a namespace by its path from the global namespace set.
  public static getNamespace(namespace: ServerNamespacesPath) {
    for (const item of WSbun.namespaces) {
      if (item.keys().next().value == namespace) {
        return item.get(namespace);
      }
    }
  }

  // Static method for registering a new namespace in the global namespace set.
  public static onNewNamespace(namespace: NameSpace) {
    this.namespaces.add(new Map().set(namespace.path, namespace));
  }

  // Registers a socket in the global socket set and links it to its namespace.
  public static onSocketJoin(socket: Socket) {
    this.sockets.add(new Map().set(socket.id, socket));
    this.namespaces.forEach(item => {
      const clientNamespace = item.get(socket.namespace.path);
      if (clientNamespace) {
        clientNamespace.sockets.add(new Map().set(socket.id, socket));
      }
    });
  }

  public static setupWsConnectionBun(bunServer: Server, request: HonoRequest, callback: (socket: Socket | any) => void, { namespace }: { namespace: NameSpace }, namespaceMiddlewares: NamespaceMiddleware) {

    const success = bunServer.upgrade(request.raw, { data: { namespace, namespaceMiddlewares, callback } });
    if (!success) {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }
    return new Response(null, {
      status: 101
    });


  }

}
