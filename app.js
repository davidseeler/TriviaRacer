var express = require('express');
var app = express();
var serv = require('http').Server(app);
 
app.get('/',function(req, res) {
	res.sendFile(__dirname + '/client/index.html');
});
app.use('/client',express.static(__dirname + '/client'));
 
serv.listen(process.env.PORT || 2000);
console.log("Server started.");
 
var SOCKET_LIST = {};

let connCount = 0;
let lobbyCount = 0;
let lobbies = {};
var io = require('socket.io')(serv,{});
io.sockets.on('connection', function(socket){
	connCount++;
	socket.id = Math.random();
	socket.x = 0;
	socket.y = 20;
	socket.number = "Player";
	SOCKET_LIST[socket.id] = socket;
	updateConnCount();

	socket.on('disconnect',function(){
		delete SOCKET_LIST[socket.id];
		connCount--;
		updateConnCount();
	});
	
	socket.on("updateName", function(data){
		socket.number = data;
	});

	socket.on("createLobby", function(data){
		lobbies[lobbyCount] = [data];
		broadcast({
			type: "createLobby",
			lobbyID: lobbyCount,
			name: data,
		});
		lobbyCount++;
	});

	socket.on("joinLobby", function(data){
		sizeOfLobby = lobbies[data.lobbyID].length;
		if (sizeOfLobby < 5){
			lobbies[data.lobbyID][sizeOfLobby] = data.name;
			sizeOfLobby++;
			broadcast({
				type: "updateLobbies",
				lobbyID: data.lobbyID,
				size: sizeOfLobby
			});
		}
		console.log(lobbies);
	});
});
 
setInterval(function(){
	var pack = [];
	for(var i in SOCKET_LIST){
		var socket = SOCKET_LIST[i];
		pack.push({
			x:socket.x,
			y:socket.y,
			number:socket.number
		});		
	}
	for(var i in SOCKET_LIST){
		var socket = SOCKET_LIST[i];
		socket.emit('newPositions', pack);
	}
},1000/25);

broadcast = function(msg){
	for(var i in SOCKET_LIST){
		var socket = SOCKET_LIST[i];
		socket.emit('broadcast', msg);
	}
}

updateConnCount = function(){
	for(var i in SOCKET_LIST){
		var socket = SOCKET_LIST[i];
		socket.emit('count', connCount);
	}
}