
# WebSocket Service for Hono

This WebSocket service is designed to seamlessly integrate with the Hono framework, providing a scalable and flexible solution for managing WebSocket connections in your Cloudflare Worker applications. It supports namespaces, middleware, and easy management of socket events.

## Features

- **Namespace Support**: Organize your sockets into namespaces for targeted communication and event handling.
- **Middleware Integration**: Apply middleware for preprocessing on WebSocket connections, allowing for authentication, logging, etc.
- **Flexible Event Handling**: Easily manage and respond to different WebSocket events.
- **TypeScript Support**: Fully typed for excellent developer experience and reliability.

## Prerequisites

<!--- Deno (latest version recommended)-->
- Hono (latest version recommended)

## Installation

This WebSocket service is designed as part of a Hono application. Ensure you have Hono by running "npm create cloudflare@latest my-hono-app -- --framework=hono" in your project. You can include this service directly into your project by running "npm i hono-ws-manager" command.

## Usage

### Step 1: Initialize Your Hono Application

```typescript
import { Hono } from 'hono';
const app = new Hono();
```



### Step 2: Define Tyeps

```typescript
type NamespacesPaths = '/my-namespace';

interface ClientToServerEvents {
	userEvent: (body?: { helloToServer?: string }) => void;
}
interface ServerToClientEvents {
	EventToEmit: (data: { foo: string }) => void
}
interface SocketData {
	username: string;
}
```


### Step 3: Import and Initialize the WebSocket Service

```typescript
import { WS } from 'hono-ws-manager';
const ws = new WS<NamespacesPaths, ClientToServerEvents, ServerToClientEvents, SocketData>({ honoApp: app });
```






### Step 4: Define Namespaces and Middleware

```typescript
ws.of('/my-namespace').use((socket, next) => {
	socket.data = { username: 'user' };
	console.log(socket.id); // e8275779-941c-4ee5-8273-8c58438bc70f
	console.log(socket.namespace.path); // /users
	next();
});
```

### Step 5: Setup WebSocket Route

```typescript
ws.of('/my-namespace').on('connection', socket => {
	socket.emit('EventToEmit', { foo: "bar" });

	socket.on('userEvent', body => {
		console.log(body);
	});


	console.log(ws.getNamespace('/my-namespace')?.getSocket(socket.id)); // logs socket class

});
```

### Step 6: Export the Hono App

```typescript
export default app
```

## Contributing

Contributions are welcome! Please feel free to submit pull requests, open issues, or suggest improvements.

## License

[MIT License](./LICENSE) - Feel free to use and modify the code for your personal or commercial projects.
