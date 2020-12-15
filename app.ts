// Setup
const express = require('express');
const { get } = require('http');
const app = express();
const serv = require('http').Server(app);
const io = require('socket.io')(serv,{});
const node_fetch = require('node-fetch');

// HTTP request handler
app.get('/',function(req, res) {
	res.sendFile(__dirname + '/client/index.html');
});
app.use('/client',express.static(__dirname + '/client'));
 
// Start listening for connections
serv.listen(process.env.PORT || 2000);
console.log("Server started.");

// Global variables
const SOCKET_LIST:any = {};
const activeGames:any = {};
const lobbies:any = {};
const hosts:any = {};
const names:string[] = [];

// Socket communication
io.sockets.on('connection', function(socket){
	socket.id = Math.random();
	socket.username = generateName();
	SOCKET_LIST[socket.id] = socket;
	fetchExistingLobbies(socket);

	// Inform client
	socket.emit("playerInfo", socket.username);

	// Post the new connection in the chat
	broadcast({
		type: "addToChat",
		msg: "" + socket.username + " connected.",
		system: true
	});

	// Update client player count
	broadcast({
		type: "updatePlayerCount",
		count: Object.keys(SOCKET_LIST).length
	});

	// On disconnnection
	socket.on('disconnect',function(){
		removePlayerData(socket.username);
		delete SOCKET_LIST[socket.id];

		// Post the disconnection in the chat
		broadcast({
			type: "addToChat",
			msg: "" + socket.username + " disconnected." ,
			system: true
		});

		// Update client player count
		broadcast({
			type: "updatePlayerCount",
			count: Object.keys(SOCKET_LIST).length
		});
	});

	socket.on("sendMsg", function(data){
		broadcast({
			type: "addToChat",
			msg: "" + socket.username + ": " + data,
			system: false
		});
	});
	
	// On player changes name
	socket.on("updateName", function(data){
		if (!names.includes(data)){
			let previousName = socket.username;
			let isHost = false;
			let partyID = "";
			socket.username = data;
			names[names.indexOf(previousName)] = data;

			// Check if player is in a lobby
			for (let lobby in lobbies){
				if (lobbies[lobby]['players'].includes(previousName)){
					isHost = false;
					partyID = lobby;
					let playerIndex = lobbies[lobby]['players'].indexOf(previousName);
					lobbies[lobby]['players'][lobbies[lobby]['players'].indexOf(previousName)] = data;

					// Check if host
					if (playerIndex == 0){
						isHost = true;
						hosts[data] = hosts[previousName];
						delete hosts[previousName];
					}
				}
			}
			broadcast({
				type: "addToChat",
				oldName: previousName,
				newName: data,
				isHost: isHost,
				lobbyID: partyID,
				nameChange: true,
				msg: "" + previousName +" now goes by '" + data + "'.",
				system: true
			});
		}
		else{
			socket.emit("nameTaken", data);
		}
	});

	socket.on("quit", function(data){
		removePlayerData(data);
	});

	// On player creating a new lobby
	socket.on("createLobby", () => {
		removeIfInLobby(socket.username);
		
		lobbies[Object.keys(lobbies).length] = {
			players: socket.username,
			category: '9',
		};

		broadcast({
			type: "createLobby",
			lobbyID: Object.keys(lobbies).length - 1,
			name: socket.username,
			size: 1,
			category: lobbies[Object.keys(lobbies).length - 1]['category']
		});
		hosts[socket.username] = Object.keys(lobbies).length - 1;
	});

	// On player joining a lobby
	socket.on("joinLobby", function(data){

		// Check target lobby current capacity
		let sizeOfLobby = lobbies[data.lobbyID]['players'].length;
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
		let wait = getData(category);
		wait.then(function(result){
			activeGames[lobbyID]['questions'] = result;
			broadcast({
				type: "startGame",
				lobbyID: hosts[data],
				party: party
			});
			shuffleAnswers(lobbyID);
		});

		// Delete lobby
		readyUpEmpties(lobbyID);
		dissolveHostLobby(data); 
	});

	socket.on("readyUp", () => {
		let gameID = getGameID(socket.username);
		activeGames[gameID]['ready'].push(socket.username);
		partyMessage({
			type: "playerReady",
			player: activeGames[gameID]['players'].indexOf(socket.username)
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

	socket.on("changeColor", function(data){
		let gameID = getGameID(socket.username);
		partyMessage({
			type: "colorChange",
			car: data[0],
			color: data[1]
		}, gameID);
	});

	socket.on("playGame", function(data){
		let gameID = getGameID(data);
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
		// Last person to ready up sends the update
		if (data == activeGames[gameID]['ready'][3]){
			let winner = checkForWinner(gameID);
			// Check if someone has already crossed the finish-line or if rounds are up
			if (winner[0] || round == 19){
				partyMessage({
					type: "gameOver",
					winner: winner[1],
					score: activeGames[gameID]['score'],
					numberOfRounds: round
				}, gameID);
				delete activeGames[gameID];
			}
			else if (round != 19){
				if (activeGames[gameID]['ready'].length == 4){
					if (round == 0){
                        clock = 3;
                    }
                    else{
                        clock = 10;
                    }
					partyMessage({
						type: "displayQuestion",
						question: activeGames[gameID]['questions']['results'][round],
						time: clock
					}, gameID);
					resetReadyPlayers(gameID);
				}
			}
		}
	});
			
	socket.on("answer", function(data){	
		let gameID = getGameID(data[0]);
		let round = activeGames[gameID]['round'];
		let correctAnswer = activeGames[gameID]['questions']['results'][round]['correct_answer'];
		let response = activeGames[gameID]['questions']['results'][round]['shuffledAnswers'][data[1]];

		if (response == correctAnswer){
			activeGames[gameID]['score'][getPlayerScoreIndex(data[0])][1]++;
		}
	});

	socket.on("checkAnswers", function(data){
		let gameID = getGameID(data);
		let round = activeGames[gameID]['round'];
		if (data == activeGames[gameID]['players'][0]){
			partyMessage({
				type: "movePlayers",
				score: activeGames[gameID]['score'],
				correct: activeGames[gameID]['questions']['results'][round]['correct_answer'],
				scoreToWin: activeGames[gameID]['scoreToWin']
			}, gameID);
			activeGames[gameID]['round']++;
		}
	});

});

// Message to be sent to all clients
function broadcast(msg){
	for(let i in SOCKET_LIST){
		let socket = SOCKET_LIST[i];
		socket.emit("broadcast", msg);
	}
}

// Message to be sent to players in specified party
function partyMessage(msg, gameID){
	for(let socket in activeGames[gameID]['sockets']){
		if (activeGames[gameID]['sockets'][socket] != "Empty"){
			activeGames[gameID]['sockets'][socket].emit("partyMessage", msg);
		}
	}
}

function generateName(){
	let name = "Player" + Math.floor(Math.random() * 1000)
	while (names.includes(name)){
		name = "Player" + Math.floor(Math.random() * 1000);
	}
	names.push(name);
	return name;
}

// Update users who just connected
function fetchExistingLobbies(socket){
	socket.emit("fetchExistingLobbies", lobbies);
}

// Remove disconnected player's data
function removePlayerData(name){
	for (let lobby in lobbies){
		if (lobbies[lobby]['players'].includes(name)){
			delete lobbies[lobby];
			broadcast({
				type: "disconnection",
				lobbyID: lobby
			});
			break;
		}
	}
	for (let game in activeGames){
		if (activeGames[game]['players'].includes(name)){
			let winner = checkForWinner(game);
			partyMessage({
				type: "disconnection",
				disconnected: name
			}, game);
			delete activeGames[game];
			break;
		}
	}
	if (hosts[name] != null){
		delete hosts[name];
	}
	if (names.indexOf(name) != null){
		names.splice(names.indexOf(name), 1);
	}
}

// Check if player is a host, remove his/her lobby
function dissolveHostLobby(name){
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
function removeIfInLobby(name){
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
function decrementLobby(lobby, indexToRemove){
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
    return node_fetch("https://opentdb.com/api.php?amount=21&" + category + "&type=multiple")
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
function shuffleAnswers(gameID){
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

function resetReadyPlayers(gameID){
	delete activeGames[gameID]['ready'];
	activeGames[gameID]['ready'] = [];
	readyUpEmpties(gameID);
}

function createScoreArrays(gameID){
	for (let i = 0; i < 4; i++){
		activeGames[gameID]['score'][i] = [activeGames[gameID]['players'][i], 0];
	}
}

function getPlayerScoreIndex(player){
	let gameID = getGameID(player);
	for (let i = 0; i < 4; i++){
		if (player == activeGames[gameID]['score'][i][0]){
			return i;
		}
	}
}

function checkForWinner(gameID){
	for (let i = 0; i < 4; i++){
		if (activeGames[gameID]['score'][i][1] == activeGames[gameID]['scoreToWin']){
			return [true, activeGames[gameID]['score'][i][0]];
		}
	}
	return [false, ""];
}