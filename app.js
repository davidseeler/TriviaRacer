// Setup
const express = require('express');
const { get } = require('http');
const app = express();
const serv = require('http').Server(app);
const fetch = require('node-fetch');
 
// HTTP request handler
app.get('/',function(req, res) {
	res.sendFile(__dirname + '/client/index.html');
});
app.use('/client',express.static(__dirname + '/client'));
 
// Start listening for connections
serv.listen(process.env.PORT || 2000);
console.log("Server started.");

// Global variables
let SOCKET_LIST = {};
let activeGames = {};
let lobbies = {};
let hosts = {};
let lobbyCount = 0;
let connCount = 0;
let io = require('socket.io')(serv,{});

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

	// Inform client of their information
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
		removeIfInLobby(data);
		lobbies[lobbyCount] = {};
		lobbies[lobbyCount]['players'] = [data];
		lobbies[lobbyCount]['category'] = '9';
		broadcast({
			type: "createLobby",
			lobbyID: lobbyCount,
			name: data,
			size: 1,
			category: lobbies[lobbyCount]['category']
		});
		hosts[data] = lobbyCount;
		lobbyCount++;
		//console.log(lobbies);
	});

	// On player joining a lobby
	socket.on("joinLobby", function(data){

		// Check target lobby current capacity
		sizeOfLobby = lobbies[data.lobbyID]['players'].length;
		if (sizeOfLobby < 4){

			// Check if host or already in another lobby
			dissolveHostLobby(data.name);
			removeIfInLobby(data.name);

			// Add player to target lobby
			lobbies[data.lobbyID]['players'][sizeOfLobby] = data.name;
			sizeOfLobby++;

			// Broadcast the hop to all other players
			broadcast({
				type: "updateLobbies",
				lobbyID: data.lobbyID,
				size: sizeOfLobby
			});

			// Lock the lobby if it is full
			if (sizeOfLobby == 4){
				broadcast({
					type: "lobbyFull",
					lobbyID: data.lobbyID
				});
			}
		}
		//console.log(lobbies);
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
		let lobbyID = hosts[data];
		let party = [];
		for (let i = 0; i < 4; i++){
			if (lobbies[lobbyID]['players'][i] == null){
				party[i] = "Empty";
			}
			else{
				party[i] = lobbies[lobbyID]['players'][i];
			}
		}

		// Move players to active game session
		activeGames[lobbyID] = {};
		activeGames[lobbyID]['players'] = party;
		activeGames[lobbyID]['sockets'] = getPlayerSockets(party);
		activeGames[lobbyID]['ready'] = [];
		activeGames[lobbyID]['round'] = 0;
		activeGames[lobbyID]['questions'] = {};
		activeGames[lobbyID]['score'] = [];
		activeGames[lobbyID]['scoreToWin'] = 5;
		createScoreArrays(lobbyID);

		// Retrieve JSON from API and send to clients
		let category = "category=" + lobbies[lobbyID]['category'];
		let wait = getData(category, lobbyID);
		wait.then(function(result){
			activeGames[lobbyID]['questions'] = result;
			broadcast({
				type: "startGame",
				lobbyID: hosts[data],
				party: party,
			});
			shuffleAnswers(lobbyID);
		});

		// Delete lobby
		readyUpEmpties(lobbyID);
		dissolveHostLobby(data); 
	});

	socket.on("readyUp", function(data){
		let gameID = getGameID(data);
		activeGames[gameID]['ready'].push(data);
		partyMessage({
			type: "playerReady",
			player: activeGames[gameID]['players'].indexOf(data)
		}, gameID);
		if (activeGames[gameID]['ready'].length == 4){
			partyMessage({
				type: "setGameStage"
			}, gameID);
		}
	});

	socket.on("scoreToWinChange", function(data){
		let gameID = getGameID(data[0]);
		activeGames[gameID]['scoreToWin'] = data[1];
		partyMessage({
			type: "scoreToWinChange",
			value: data[1]
		}, gameID);
	});

	socket.on("playGame", function(data){
		let gameID = getGameID(data);
		let round = activeGames[gameID]['round'];

		resetReadyPlayers(gameID);
		
		if (data == activeGames[gameID]['players'][0]){
			partyMessage({
				type: "clientConfirmation"
			}, gameID);
		}
	});

	socket.on("playerReady", function(data){
		let gameID = getGameID(data);
		let round = activeGames[gameID]['round'];
		let clock = 0;
		activeGames[gameID]['ready'].push(data);
		// Last person to ready up sends the update to control overflow
		if (data == activeGames[gameID]['ready'][3]){
			let winner = checkForWinner(gameID);
			if (winner[0]){
				console.log("winner winner chicken dinner");
				partyMessage({
					type: "gameOver",
					winner: winner[1],
					score: activeGames[gameID]['score']
				}, gameID);
			}
			else if (round != 19){
				if (activeGames[gameID]['ready'].length == 4){
					if (round == 0 ? clock = 3 : clock = 10);
					partyMessage({
						type: "displayQuestion",
						question: activeGames[gameID]['questions']['results'][round],
						time: clock
					}, gameID);
					resetReadyPlayers(gameID);
				}
			}
			else{
				// game end	
			}
		}
	});
			
	socket.on("answer", function(data){	
		let gameID = getGameID(data[0]);
		let round = activeGames[gameID]['round'];
		let correctAnswer = activeGames[gameID]['questions']['results'][round]['correct_answer'];
		let response = activeGames[gameID]['questions']['results'][round]['shuffledAnswers'][data[1]];

		if (response == correctAnswer){
			console.log("correct");
			activeGames[gameID]['score'][getPlayerScoreIndex(data[0])][1]++;
		}
		else{
			console.log("incorrect");
		}
	});

	socket.on("checkAnswers", function(data){
		let gameID = getGameID(data);
		let round = activeGames[gameID]['round'];
		console.log("checking answers...");
		if (data == activeGames[gameID]['players'][0]){
			partyMessage({
				type: "movePlayers",
				score: activeGames[gameID]['score'],
				correct: activeGames[gameID]['questions']['results'][round]['correct_answer'],
				scoreToWin: activeGames[gameID]['scoreToWin']
			}, gameID);
		}
		activeGames[gameID]['round']++;
	});

});

// Message to be sent to all clients
broadcast = function(msg){
	for(let i in SOCKET_LIST){
		let socket = SOCKET_LIST[i];
		socket.emit("broadcast", msg);
	}
}

// Message to be sent to players in specified party
partyMessage = function(msg, gameID){
	for(let socket in activeGames[gameID]['sockets']){
		if (activeGames[gameID]['sockets'][socket] != "Empty"){
			activeGames[gameID]['sockets'][socket].emit("partyMessage", msg);
		}
	}
}

updateConnCount = function(){
	for(let i in SOCKET_LIST){
		let socket = SOCKET_LIST[i];
		socket.emit('count', connCount);
	}
}

// Update users who just connected
fetchExistingLobbies = function(socket){
	socket.emit("fetchExistingLobbies", lobbies);
}

// Check if player is a host, remove his/her lobby
dissolveHostLobby = function(name){
	if (hosts[name] != null){
		broadcast({
			type: "deleteLobby",
			name: name,
			lobbyID: hosts[name]
		});
		delete lobbies[hosts[name]];
		delete hosts[name];	
	}
}

// Check and remove if player is already in a lobby
removeIfInLobby = function(name){
	for (let lobby in lobbies){
		if ((lobbies[lobby]['players']).includes(name)){
			for (let i = 0; i < (lobbies[lobby]['players']).length; i++){
				if ((lobbies[lobby]['players'][i]) == name){
					lobbies[lobby]['players'] = decrementLobby(lobbies[lobby]['players'], i);
					broadcast({
						type: "playerHop",
						lobbyID: lobby,
						size: lobbies[lobby]['players'].length,
						host: getHostOfLobby(lobby)
					});
				}
			}
		}
	}
}

// Adjust lobby array for the decrement
decrementLobby = function(lobby, indexToRemove){
	if (lobby.length == 2){
		lobby = [lobby[0]];
	}
	else if (lobby.length == 3){
		if (indexToRemove == 1){
			lobby = [lobby[0], lobby[2]];
		}
		if (indexToRemove == 2){
			lobby = [lobby[0], lobby[1]];
		}
	}
	else if (lobby.length == 4){
		if (indexToRemove == 1){
			lobby = [lobby[0], lobby[2], lobby[3]];
		}
		else if (indexToRemove == 2){
			lobby = [lobby[0], lobby[1], lobby[3]];
		}
		else if (indexToRemove == 3){
			lobby = [lobby[0], lobby[1], lobby[2]];
		}
	}
	return lobby;
}

// Call Open Trivia Database API to retrieve question data
function getData(category){
    return fetch("https://opentdb.com/api.php?amount=20&" + category + "&difficulty=easy&type=multiple")
		.then(res => res.json());
}

// Return host of specificed lobby
function getHostOfLobby(lobby){
	for (let host in hosts){
		if (hosts[host] == lobby){
			return host;
		}
	}
}

function getGameID(name){
	for (let game in activeGames){
		if (activeGames[game]['players'].includes(name)){
			return game;
		}
	}
}

function readyUpEmpties(gameID){
	for (let i = 0; i < 4; i++){
		if (activeGames[gameID]['players'][i] == "Empty"){
			activeGames[gameID]['ready'].push("Empty");
		}
	}
}

function getPlayerSockets(party){
	let sockets = [];
	for (let player in party){
		if (party[player] == "Empty"){
			sockets.push("Empty");
		}
		else{
			for(let i in SOCKET_LIST){
				let socket = SOCKET_LIST[i];
				if (socket.number == party[player]){
					sockets.push(socket);
				}
			}
		}
	}
	return sockets;
}

// Shuffle answer choices for all questions
shuffleAnswers = function(gameID){
	for (let question in activeGames[gameID]['questions']['results']){
		let arr = activeGames[gameID]['questions']['results'][question]['incorrect_answers'];
		arr[3] = activeGames[gameID]['questions']['results'][question]['correct_answer'];
		for (let i = arr.length - 1; i > 0; i--) {
			let j = Math.floor(Math.random() * (i + 1));
			let temp = arr[i];
			arr[i] = arr[j];
			arr[j] = temp;
		}
		activeGames[gameID]['questions']['results'][question]['shuffledAnswers'] = arr;
	}
}

resetReadyPlayers = function(gameID){
	delete activeGames[gameID]['ready'];
	activeGames[gameID]['ready'] = [];
	readyUpEmpties(gameID);
}

checkAnswers = function(data){
	console.log("checking answers...");
}

createScoreArrays = function(gameID){
	for (let i = 0; i < 4; i++){
		activeGames[gameID]['score'][i] = [activeGames[gameID]['players'][i], 0];
	}
}

getPlayerScoreIndex = function(player){
	let gameID = getGameID(player);
	for (let i = 0; i < 4; i++){
		if (player == activeGames[gameID]['score'][i][0]){
			return i;
		}
	}
}

checkForWinner = function(gameID){
	for (let i = 0; i < 4; i++){
		if (activeGames[gameID]['score'][0][i] == activeGames[gameID]['scoreToWin']){
			return [true, activeGames[gameID]['players'][i]];
		}
	}
	return [false, ""];
}