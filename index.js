const http = require("http");
const path = require("path");
const fs = require("fs/promises");
const events = require("events");

const WebSocket = require("ws");

const messages = [];

const getMessagesListeners = []; // all get req listeners for broadcasting;
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
        case '/api/pulling/messages':
            res.setHeader('Content-Type', 'application/json');

            if (req.method === 'GET') {
                const message = await new Promise((resolve, reject) => {
                    emitter.once('newMessage', (message) => {
                        resolve(message)
                    })
                    getMessagesListeners.push(resolve);
                })
    
                res.write(JSON.stringify(message));
            }
    
            if (req.method === 'POST') {
                const message = await parseBody(req);
                messages.push(message);

                emitter.emit('newMessage', message);
            }
    
            return res.end();
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