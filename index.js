const http = require("http");
const path = require("path");
const fs = require("fs/promises");
const events = require("events");

const WebSocket = require("ws");

const messages = [];

const emitter = new events.EventEmitter();

emitter.setMaxListeners(100);

const parseBody = (request) => new Promise((resolve, reject) => {
    const body = [];

    request.on('error', (err) => {
        reject(err);
    }).on('data', (chunk) => {
        body.push(chunk);
    }).on('end', () => {
        const obj = JSON.parse(Buffer.concat(body).toString());

        resolve(obj);
    });
})

const requestListener = async (req, res) => {

    switch (req.url) {
        case '/api/longPulling/messages':
            res.setHeader('Content-Type', 'application/json');

            if (req.method === 'GET') {
                const message = await new Promise((resolve, reject) => {
                    emitter.once('newLongPullingMessage', (message) => {
                        resolve(message)
                    })
                })
    
                res.write(JSON.stringify(message));
            }
    
            if (req.method === 'POST') {
                const message = await parseBody(req);
                messages.push(message);

                emitter.emit('newLongPullingMessage', message);
            }
    
            return res.end();
        case '/api/eventSource/messages':
            if (req.method === 'GET') {
                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Connection', 'keep-alive');
                res.setHeader('Cache-Control', 'no-cache');

                emitter.on('newEventSourceMessage', (message) => {
                    console.log(message);
                    res.write('id: ' + 3123 + '\n');
                    res.write("data: new server event " + message + '\n\n');
                    // res.write(`data: ${JSON.stringify(message)}\n\n`)
                })
            }
    
            if (req.method === 'POST') {
                res.setHeader('Content-Type', 'application/json');
                const message = await parseBody(req);
                emitter.emit('newEventSourceMessage', message);

                return res.end();
            }
    
        case '/api/messages':
            if (req.method === 'GET') res.write(JSON.stringify(messages));
    
            return res.end();
        default:
            res.writeHead(200, {
                'Content-Type': 'text/html',
                // 'X-Powered-By': 'top secret'
            });
            const indexHTML = await fs.readFile(path.join(__dirname + '/index.html'));
          
        
            res.write(indexHTML);
            res.end();
    }

}

const httpServer = http.createServer(requestListener);

const wss = new WebSocket.Server({
    server: httpServer,
})

wss.on('connection', ws => {
    ws.on('message', event => {
        const text = event.toString();
        
        messages.push(text);
        for (const client of wss.clients) client.send(text)
    })
})


httpServer.listen(3000, () => {
    console.log('started')
})