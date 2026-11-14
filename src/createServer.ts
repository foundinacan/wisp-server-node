import wisp from "./ConnectionHandler.js";
import http from "node:http";
import { LOG_LEVEL } from "./Types.js";
import { Socket } from "node:net";

const port = Number(process.env.PORT) || 3000;

const httpServer = http.createServer((req, res) => {
    const pathname = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`).pathname;

    if (req.method === "GET" && (pathname === "/" || pathname === "/health")) {
        res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
        res.end("Wisp server is running");
        return;
    }

    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
});

httpServer.on("upgrade", (req, socket, head) => {
    const pathname = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`).pathname;

    // This service is dedicated to Wisp. The trailing slash is required by the
    // wisp-server-node router to distinguish Wisp from legacy wsproxy requests.
    if (pathname !== "/wisp/") {
        socket.write("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
        socket.destroy();
        console.warn(`[wisp] Rejected WebSocket upgrade for unexpected path: ${pathname}`);
        return;
    }

    console.log(`[wisp] WebSocket upgrade received from ${req.headers.origin || "unknown origin"}`);

    wisp.routeRequest(req, socket as Socket, head, {
        logLevel: LOG_LEVEL.INFO,
        pingInterval: 30
    }).catch((error: unknown) => {
        console.error("[wisp] Failed to handle WebSocket upgrade:", error);
        socket.destroy();
    });
});

httpServer.on("error", (error) => {
    console.error("[wisp] HTTP server error:", error);
    process.exitCode = 1;
});

httpServer.listen(port, "0.0.0.0", () => {
    console.log(`[wisp] HTTP server listening on 0.0.0.0:${port}`);
});
