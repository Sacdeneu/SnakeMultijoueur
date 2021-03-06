

const { initGame, gameLoop, getUpdatedVelocity,  } = require('./game');
const { FRAME_RATE } = require('./constants');
const { makeid } = require('./utils')

let port = process.env.PORT || 80
const state = {};
const clientRooms = {};
const path = require('path');
const fullPath = path.join(__dirname, "frontend/index.html");
const content = require('fs').readFileSync(fullPath, 'utf8');

const httpServer = require('http').createServer((req, res) => {
  // serve the index.html file
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Content-Length', Buffer.byteLength(content));
  res.end(content);
});

const io = require('socket.io')(httpServer);


io.on('connection', client => {
    startGameInterval(client, state);

    client.on('keydown', handleKeydown);
    client.on('newGame', handleNewGame); 
    client.on('joinGame', handleJoinGame); 

    function handleJoinGame(gameCode){
        const room = io.sockets.adapter.rooms[gameCode];

        let allUsers;
        if(room){
            allUsers = room.sockets;
        }

        let numClients = 0;
        if (allUsers) {
            numClients = Object.keys(allUsers).length;
        }

        if(numClients === 0){
            client.emit('unknownGame');
            return;
        } else if (numClients > 1) {
            client.emit('tooManyPlayers');
            return;
        }

        clientRooms[client.id] = gameCode;

        client.join(gameCode);
        client.number = 2;
        client.emit('init', 2);
        startGameInterval(gameCode);

    }

    function handleNewGame(){
        let roomName = makeid(5);
        clientRooms[client.id] = roomName;
        client.emit('gameCode', roomName);

        state[roomName] = initGame();

        client.join(roomName);
        client.number = 1;
        client.emit('init', 1);
    }

    function handleKeydown(keyCode){
        const roomName =  clientRooms[client.id];

        if(!roomName){
            return;
        }

        try{
            keyCode = parseInt(keyCode);
        }catch(e){
            console.error(e);
            return;
        }

        const vel = getUpdatedVelocity(keyCode);

        if(vel){
            state[roomName].players[client.number - 1].vel = vel;
        }
    }
});

function startGameInterval(roomName){
    const intervalId = setInterval(() => {
        const winner = gameLoop(state[roomName]);

        if(!winner){
            emitGameState(roomName, state[roomName]);
        } else {
            emitGameOver(roomName, winner);
            state[roomName] = null;
            clearInterval(intervalId);
        }

    }, 1000 / FRAME_RATE);
}

function emitGameState(roomName, state){
    io.sockets.in(roomName)
    .emit('gameState', JSON.stringify(state));
}

function emitGameOver(roomName, winner){
    io.sockets.in(roomName)
    .emit('gameOver', JSON.stringify({ winner }));
}

httpServer.listen(port, () => {
    console.log('go to http://localhost:3000');
});
  