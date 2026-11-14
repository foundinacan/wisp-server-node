// @ts-ignore - wisp-js ships runtime entrypoints without TypeScript declarations.
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";
import http from "node:http";
import { Socket } from "node:net";

const port = Number(process.env.PORT) || 3000;

// Keep the proxy limited to normal web traffic and block private-network access.
wisp.options.port_whitelist = [80, 443];
wisp.options.allow_private_ips = false;
wisp.options.allow_loopback_ips = false;
wisp.options.allow_direct_ip = false;
logging.set_level(logging.DEBUG);

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

httpServer.on("upgrade", async (req, socket, head) => {
    const pathname = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`).pathname;

    if (pathname !== "/wisp/") {
        socket.write("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
        socket.destroy();
        console.warn(`[wisp] Rejected WebSocket upgrade for unexpected path: ${pathname}`);
        return;
    }

    console.log(`[wisp] WebSocket upgrade from ${req.headers.origin || "unknown origin"}`);

    try {
        await wisp.routeRequest(req, socket as Socket, head);
    } catch (error) {
        console.error("[wisp] WebSocket handler failed:", error);
        socket.destroy();
    }
});

httpServer.on("error", (error) => {
    console.error("[wisp] HTTP server error:", error);
    process.exitCode = 1;
});

httpServer.listen(port, "0.0.0.0", () => {
    console.log(`[wisp] Listening on 0.0.0.0:${port}`);
});
