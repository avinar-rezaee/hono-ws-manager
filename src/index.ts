// Imports necessary modules and types from Hono, as well as utility functions.
import { v4 as uuidV4 } from "uuid";
import type { Hono, HonoRequest } from 'hono';
import NameSpace from './classes/Namespace';
import { DefaultEventMap, EventsMap, ServerNamespacesPath } from './Types/Types';
import Socket from './classes/Socket';
import NamespaceMiddleware from './classes/Middleware';


// The WS class encapsulates WebSocket functionality, including namespace and socket management.
export default class WS<ServerNameSpacesPaths extends string = string, ListenEvents extends EventsMap = DefaultEventMap, EmitEvents extends EventsMap = EventsMap, SocketData = any> {
  // Holds a default namespace for WebSocket connections.
  public readonly defaultNamespace: NameSpace<ServerNamespacesPath<ServerNameSpacesPaths>, ListenEvents, EmitEvents, SocketData> = new NameSpace('/ws');
  // Static reference to the Hono app for managing routes and middleware.
  static honoApp: Hono;
  // Sets for tracking all socket connections and namespaces.
  public readonly Sockets: Set<Map<string, Socket<ListenEvents, EmitEvents, SocketData, ServerNamespacesPath<ServerNameSpacesPaths>, NameSpace<ServerNamespacesPath<ServerNameSpacesPaths>, ListenEvents, EmitEvents, SocketData>>>>;
  public readonly Namespaces: Set<Map<string, NameSpace<ServerNamespacesPath<ServerNameSpacesPaths>, ListenEvents, EmitEvents, SocketData>>>;
  // Static sets for global access to sockets and namespaces.
  public static readonly sockets: Set<Map<string, Socket>> = new Set<Map<string, Socket>>();
  public static readonly namespaces: Set<Map<string, NameSpace>> = new Set<Map<string, NameSpace>>();

  // Method for handling namespace-specific operations, returning a namespace instance.
  of: (namespace: ServerNamespacesPath<ServerNameSpacesPaths>) => NameSpace<ServerNamespacesPath<ServerNameSpacesPaths>, ListenEvents, EmitEvents, SocketData>

  // Initializes WebSocket functionality with a given Hono app.
  constructor({ honoApp: honoAppConstructor }: { honoApp: Hono }) {
    WS.honoApp = honoAppConstructor;
    this.Sockets = <any>WS.sockets;
    this.Namespaces = <any>WS.namespaces;

    // Method for obtaining a namespace by path or creating a new one if it doesn't exist.
    this.of = (namespace) => {
      const hasNamespace = <any>WS.getNamespace(namespace);
      if (hasNamespace) return hasNamespace;
      const newNamespace = new NameSpace<ServerNamespacesPath<ServerNameSpacesPaths>, ListenEvents, EmitEvents, SocketData>(namespace);
      return newNamespace;
    }
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
    for (const item of WS.namespaces) {
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
  private static onSocketJoin(socket: Socket) {
    this.sockets.add(new Map().set(socket.id, socket));
    this.namespaces.forEach(item => {
      const clientNamespace = item.get(socket.namespace.path);
      if (clientNamespace) {
        clientNamespace.sockets.add(new Map().set(socket.id, socket));
      }
    });
  }

  // Sets up a WebSocket connection, applying middleware and executing the callback when a connection is established.
  public static setupWsConnection(request: HonoRequest, callback: (socket: Socket | any) => void, { namespace }: { namespace: NameSpace }, namespaceMiddlewares: NamespaceMiddleware) {
    const upgradeHeader = request.header('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values<WebSocket>(webSocketPair);

    server.accept();

    const id = uuidV4();
    const socket = new Socket({ server, id, namespace, data: null });

    // Join the socket to the namespace and apply middleware.
    this.onSocketJoin(socket);
    namespaceMiddlewares.execute(socket, () => callback(socket));

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }
}