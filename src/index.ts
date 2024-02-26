// Imports necessary modules and types from Hono, as well as utility functions.
import { v4 as uuidV4 } from "uuid";
import type { Hono } from 'hono';
import NameSpace from './classes/Namespace';
import { DefaultEventMap, EventsMap, ServerNamespacesPath } from './Types/Types';
import Socket from './classes/Socket';
import NamespaceMiddleware from './classes/Middleware';
import { Server, WebSocketHandler } from 'bun';
import { EventEmitter } from 'node:events';

// The WS class encapsulates WebSocket functionality, including namespace and socket management.
export default class WS<ServerNameSpacesPaths extends string = string, ListenEvents extends EventsMap = DefaultEventMap, EmitEvents extends EventsMap = EventsMap, SocketData = any> {
  // Holds a default namespace for WebSocket connections.
  public readonly defaultNamespace: NameSpace<ServerNamespacesPath<ServerNameSpacesPaths>, ListenEvents, EmitEvents, SocketData> = new NameSpace('/ws');
  // Static reference to the Hono app for managing routes and middleware.
  static honoApp?: Hono;
  static BunServer?: Server;

  public static readonly WsEventEmitter = new EventEmitter();

  // Sets for tracking all socket connections and namespaces.
  public readonly Sockets: Set<Map<string, Socket<ListenEvents, EmitEvents, SocketData, ServerNamespacesPath<ServerNameSpacesPaths>, NameSpace<ServerNamespacesPath<ServerNameSpacesPaths>, ListenEvents, EmitEvents, SocketData>>>>;
  public readonly Namespaces: Set<Map<string, NameSpace<ServerNamespacesPath<ServerNameSpacesPaths>, ListenEvents, EmitEvents, SocketData>>>;
  // Static sets for global access to sockets and namespaces.
  public static readonly sockets: Set<Map<string, Socket>> = new Set<Map<string, Socket>>();
  public static readonly namespaces: Set<Map<string, NameSpace>> = new Set<Map<string, NameSpace>>();

  // Method for handling namespace-specific operations, returning a namespace instance.
  of: (namespace: ServerNamespacesPath<ServerNameSpacesPaths>) => NameSpace<ServerNamespacesPath<ServerNameSpacesPaths>, ListenEvents, EmitEvents, SocketData>

  // public static readonly ws: ServerWebSocket<{ socket: Socket, namespace: NameSpace, namespaceMiddlewares: NamespaceMiddleware, callback: (socket: Socket | any) => void }>

  public websocket: WebSocketHandler<{ socket: Socket, namespace: NameSpace, namespaceMiddlewares: NamespaceMiddleware, callback: (socket: Socket | any) => void }>
  public static websocket: WebSocketHandler<{ socket: Socket, namespace: NameSpace, namespaceMiddlewares: NamespaceMiddleware, callback: (socket: Socket | any) => void }> = {
    open(ws) {
      const { namespace, namespaceMiddlewares, callback } = ws.data
      const id = uuidV4();
      const eventEmitter = new EventEmitter();
      const socket = new Socket({ WS: ws, id, namespace, data: null, eventEmitter });
      ws.data.socket = socket;
      // Join the socket to the namespace and apply middleware.
      WS.onSocketJoin(socket);
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
  constructor(initializationData?: { honoApp: Hono, BunServer: Server }) {
    WS.honoApp = initializationData?.honoApp;
    WS.BunServer = initializationData?.BunServer;
    this.Sockets = <any>WS.sockets;
    this.Namespaces = <any>WS.namespaces;
    // Method for obtaining a namespace by path or creating a new one if it doesn't exist.
    this.of = (namespace) => {
      const hasNamespace = <any>WS.getNamespace(namespace);
      if (hasNamespace) return hasNamespace;
      const newNamespace = new NameSpace<ServerNamespacesPath<ServerNameSpacesPaths>, ListenEvents, EmitEvents, SocketData>(namespace);
      return newNamespace;
    }
    this.websocket = WS.websocket;

    WS.WsEventEmitter.addListener('newSocketConnected', (ws: WebSocket, data: { namespace: NameSpace, namespaceMiddlewares: NamespaceMiddleware, callback: (socket: Socket | any) => void }) => {
      const { namespace, namespaceMiddlewares, callback } = data
      const id = uuidV4();
      const eventEmitter = new EventEmitter();
      const socket = new Socket({ wsCloudflare: ws, id, namespace, data: null, eventEmitter });

      // Join the socket to the namespace and apply middleware.
      WS.onSocketJoin(socket);
      namespaceMiddlewares.execute(socket, () => callback(socket));
    });
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
  public static onSocketJoin(socket: Socket) {
    this.sockets.add(new Map().set(socket.id, socket));
    this.namespaces.forEach(item => {
      const clientNamespace = item.get(socket.namespace.path);
      if (clientNamespace) {
        clientNamespace.sockets.add(new Map().set(socket.id, socket));
      }
    });
  }

  private upgradeBunServer: ({ req, BunServer }: { req: Request, BunServer: Server }) => Promise<{ success: boolean }> = ({ req, BunServer }) => new Promise((resolve, reject) => {
    const url = new URL(req.url);
    WS.WsEventEmitter.emit(`upgradeBunServerForNamespace:${url.pathname}`, { req, BunServer });
    WS.WsEventEmitter.addListener(`upgradeBunServerForNamespace:${url.pathname}=>Status`, (status) => resolve(status));
  })

  public async handleWsRequest({ req, BunServer }: { req: Request, BunServer?: Server }): Promise<Response> {
    const url = new URL(req.url)
    const namespace = WS.getNamespace(url.pathname);
    if (namespace) {
      if (BunServer) {
        const success = await this.upgradeBunServer({ req, BunServer });
        if (!success) {
          return new Response('Expected Upgrade: websocket', { status: 426 });
        }
        return new Response(null, {
          status: 101
        });
      }
      else {
        const upgradeHeader = req.headers.get('Upgrade');
        if (!upgradeHeader || upgradeHeader !== 'websocket') {
          return new Response('Expected Upgrade: websocket', { status: 426 });
        }

        const webSocketPair = new WebSocketPair();
        const [client, server] = Object.values<WebSocket>(webSocketPair);

        server.accept();

        WS.WsEventEmitter.emit(`handleNewWebSocketRequestToNamespace:${namespace.path}`, server);

        return new Response(null, {
          status: 101,
          webSocket: client,
        });
      }
    }
    return new Response('Namespace Not Found', { status: 404 });


  }
}
