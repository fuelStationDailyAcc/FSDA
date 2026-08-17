import dns from "node:dns";

// Node on Windows often uses 127.0.0.1:53 for SRV lookups, which fails with
// querySrv ECONNREFUSED for mongodb+srv://. Public DNS resolves Atlas correctly.
const servers = dns.getServers();
const onlyLoopback =
    servers.length === 1 && (servers[0] === "127.0.0.1" || servers[0] === "::1");

if (onlyLoopback) {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
}
