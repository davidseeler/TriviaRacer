// Server setup
let express = require('express');
let app = express();
let serv = require('http').Server(app);
 
app.get('/',function(req, res) {
	res.sendFile(__dirname + '/client/index.html');
});
app.use('/client',express.static(__dirname + '/client'));
 
serv.listen(process.env.PORT || 2000);
console.log("Server started.");
 

// Global variables
let SOCKET_LIST = {};
let connCount = 0;
let lobbyCount = 0;
let lobbies = {};
let hosts = {};
var io = require('socket.io')(serv,{});

// On new connection, instantiate player
io.sockets.on('connection', function(socket){
	connCount++;
	socket.id = Math.random();
	socket.x = 0;
	socket.y = 20;
	socket.number = "Player" + Math.floor(Math.random() * 1000);
	SOCKET_LIST[socket.id] = socket;
	updateConnCount();
	fetchExistingLobbies(socket);

	socket.emit("playerInfo", socket.number);

	// On disconnnection
	socket.on('disconnect',function(){
		delete SOCKET_LIST[socket.id];
		connCount--;
		updateConnCount();
	});
	
	// On player changes name
	socket.on("updateName", function(data){
		socket.number = data;
	});

	// On player creating a new lobby
	socket.on("createLobby", function(data){
		lobbies[lobbyCount] = {};
		lobbies[lobbyCount]['players'] = [data];
		lobbies[lobbyCount]['category'] = 'General Knowledge';
		broadcast({
			type: "createLobby",
			lobbyID: lobbyCount,
			name: data,
			size: 1,
			category: lobbies[lobbyCount]['category']
		});
		hosts[data] = lobbyCount;
		lobbyCount++;
	});

	// On player joining a lobby
	socket.on("joinLobby", function(data){
		console.log(lobbies);
		sizeOfLobby = lobbies[data.lobbyID]['players'].length;
		if (sizeOfLobby < 5){
			let isHost = false;
			if (checkIfHost(data.name)){
				isHost = true;
				broadcast({
					type: "deleteLobby",
					name: data.name,
					lobbyID: hosts[data.name]
				});
				delete lobbies[hosts[data.name]];
				delete hosts[data.name];
			}
			removeIfInLobby(data.name);
			lobbies[data.lobbyID]['players'][sizeOfLobby] = data.name;
			sizeOfLobby++;
			broadcast({
				type: "updateLobbies",
				lobbyID: data.lobbyID,
				size: sizeOfLobby,
				host: isHost
			});
		}
		console.log(lobbies);
	});

	// On host changing category of lobby
	socket.on("changeCategory", function(data){
		lobbies[data.lobbyID]['category'] = data.category;
		broadcast({
			type: "changeCategory",
			lobbyID: data.lobbyID,
			category: data.category
		});
	});

	socket.on("startGame", function(data){
		socket.emit("startGame", {
			lobbyID: hosts[data]
		});
	});
});
 
// 40 FPS execution
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

// Message to be sent to all clients
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

fetchExistingLobbies = function(socket){
	socket.emit("fetchExistingLobbies", lobbies);
}

checkIfHost = function(name){
	if (hosts[name] != null){
		return true;
	}
	return false;
}

removeIfInLobby = function(name){
	for (let lobby in lobbies){
		if ((lobbies[lobby]['players']).includes(name)){
			for (let i = 0; i < (lobbies[lobby]['players']).length; i++){
				if ((lobbies[lobby]['players'][i]) == name){
					delete lobbies[lobby]['players'][i];
					lobbies[lobby]['players'].length -= 1;
					broadcast({
						type: "playerHop",
						lobbyID: lobby,
						name: name,
						size: lobbies[lobby]['players'].length
					});
				}
			}
		}
	}
}