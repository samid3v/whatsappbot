import http from 'http';

export function startHealthServer(port: number = 3000) {
    const server = http.createServer((req, res) => {
        if (req.url === '/health' || req.url === '/') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'online',
                uptime: process.uptime(),
                timestamp: new Date().toISOString()
            }));
        } else {
            res.writeHead(404);
            res.end('Not Found');
        }
    });

    server.listen(port, () => {
        console.log(`🏥 Health server running on port ${port}`);
    });

    return server;
}
