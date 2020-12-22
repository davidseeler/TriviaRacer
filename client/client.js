// Socket used to communicate with server
let socket = io();

// Player variables
let username = "";
let party = "";
let timer = "";

/*-----------------------Server Communication-----------------------*/

// Retrieve username from server
socket.on("playerInfo", function(data){
    username = data;
    $("#nameInput").val(data);
});

// Display an error message if name change request fails
socket.on("unavailableName", function(data){
    unavailableNameErr(data);
});

// Fetch current game state
socket.on("fetchExistingLobbies", function(data){
    let lobbies = data;
    for (let lobby in lobbies){
        createLobby(lobby, lobbies[lobby]['players'][0], 
        lobbies[lobby]['players'].length, lobbies[lobby]['category']);
        if (lobbies[lobby]['players'].length == 4){
            lockLobby(lobby);
        }    
    }  
});

// Broadcasts from server to all clients
socket.on("broadcast", function(data){
    switch (data.type){
        case "updatePlayerCount":
            $("#playerCount").html(data.count);
            break;
        case "addToChat":
            addToChat(data);
            break;
        case "createLobby":
            createLobby(data.lobbyID, data.name, data.size, data.category);
            break;
        case "updateLobbies":
            updateLobbyCount(data.lobbyID, data.size);
            break;
        case "changeCategory":
            updateLobbyCategory(data.lobbyID, data.category);
            break;
        case "deleteLobby":
            deleteLobby(data);
            break;
        case "playerHop":
            playerHop(data.lobbyID, data.size, data.host);
            break;
        case "lobbyFull":
            lockLobby(data.lobbyID);
            break;
        case "startGame":
            if (data.party.includes(username)){
                startGame(data);
            }
            break;
        case "disconnection":
            $("#lobbyRow" + data.lobbyID).remove();
    }
});

// Broadcasts from server to all members in party
socket.on("partyMessage", function(data){
    switch (data.type){
        case "playerReady":
            playerReadyUp(data.player);
            break;
        case "setGameStage":
            playGame();
            break;
        case "scoreToWinChange":
            updateScoreToWin(data.value);
            break;
        case "colorChange":
            colorUpdate(data);
            break;
        case "displayQuestion":
            if (data.time == 3 ? startCountDown(data) : displayQuestion(data));
            break;
        case "playerAnswer":
            playerAnswer(data);
            break;
        case "allPlayersAnswered":
            stopTheClock();
            break;
        case "movePlayers":
            movePlayers(data);
            break;
        case "gameover":
            gameover(data);
            break;
        case "disconnection":
            if (data.disconnected != username){
                disconnection(data.disconnected);
            }
    }
});

/*--------------------------Home page functions----------------------------*/

// Sends entered chat message to server
document.getElementById("chatForm").onsubmit = function(e){
    e.preventDefault();
    socket.emit("sendMsg", $("#chatMessage").val());
    $("#chatMessage").val("");
}

// Posts messages from server and other clients to chat
function addToChat(data){
    if (data.nameChange){
        updateName(data);
    }
    if (data.system){
        data.msg = "<span class='systemMsg'>SYSTEM: </span>" + data.msg;
    }
    $("#chatContent").append("<div>" + data.msg + "</div>");
    let y = document.getElementById("chatContent").scrollHeight; 
    document.getElementById("chatContent").scrollTo(0, y);
}

// Send name change request to server
function sendName(){
    // Display an error message if desired name is greater than 9 characters
    if ($("#nameInput").val().length > 9){
        $("#nameTaken").html("Name must be less than 10 characters.")
        $("#nameInput").attr("style", "border: 1px solid red");
        $("#nameTaken").attr("style", "display: block");
        $("#nameInput").click(function(){
            $("#nameInput").val("");
            $("#nameInput").attr("style", "border: none");
            $("#nameTaken").attr("style", "display: none");
        });
    }
    // Wait for server response
    else{
        $("#nameSpinner").show();
        let desiredName = $("#nameInput").val();
        setTimeout(function(){
            socket.emit("updateName", desiredName);
        }, 500);
    }
}

// Update all player changed names
function updateName(data){
    if (data.isHost){
        $("#host" + data.lobbyID).html(data.newName);
    }
    if (username == data.oldName){
        username = data.newName;
        $("#nameSpinner").hide();
        $("#nameChanged").show();
        $("#nameChanged").show("slow").delay(1250).hide("slow");
    }
}

// Displays an error message when a name request fails
function unavailableNameErr(data){
    $("#nameSpinner").hide();
    $("#nameTaken").html("'" + data + "' is unavailable.")
    $("#nameInput").attr("style", "border: 1px solid red");
    $("#nameTaken").attr("style", "display: block");
    $("#nameInput").click(function(){
        $("#nameInput").val("");
        $("#nameInput").attr("style", "border: none");
        $("#nameTaken").attr("style", "display: none");
    });
}

// Displays "ready" over a player who answers
function playerAnswer(data){
    if (Array.isArray(data.playerIndex)){
        for (let index in data.playerIndex){
            $("#readyTag" + (data.playerIndex[index] + 1)).attr("style", "opacity: 100%");
        }
    }
    else{
        $("#readyTag" + (data.playerIndex + 1)).attr("style", "opacity: 100%");
    }
}

// Create New Lobby button handler - sends request to server
function createLobbyMsg(){
    socket.emit("createLobby", username);
}

// Creates a new lobby on approval from server
function createLobby(lobbyID, nameFromServer, size, category){
    let table = $("#lobbyTable");
    let joinButton = "<button value='" + lobbyID + "' onclick='joinLobby(value)' id='joinButton" + lobbyID + "'>Join</button>";
    let categoryOptions = "<select id='category" + lobbyID + "' onchange='changeCategory(" + lobbyID + ")'>" + "<option value='9' selected>General Knowledge</option>" +
    "<option value='11'>Film</option>" + "<option value='12'>Music</option>" + "<option value='14'>Television</option>" +
    "<option value='15'>Video Games</option>" + "<option value='17'>Science & Nature</option>" + "<option value='18'>Computers</option>" +
    "<option value='19'>Mathematics</option>" + "<option value='21'>Sports</option>" + "<option value='22'>Geography</option>" +
    "<option value='23'>History</option>" + "<option value='24'>Politics</option>" + "<option value='25'>Art</option>" +
    "<option value='26'>Celebrities</option>" + "<option value='27'>Animals</option>" + "<option value='28'>Vehicles</option>" + 
    "<option value='31'>Anime & Manga</option>" + "<option value='32'>Cartoon & Animations</option>" + "</select>";
    let newLobby = $("<tr id='lobbyRow" + lobbyID + "'><td><span id='host" + lobbyID + "'>" + nameFromServer + "</span></td><td id='lobbyCount" + lobbyID + "' value='" + size + "'>" + size + "/4</td><td id='categorySelect'>" + 
    "" + categoryOptions + "</td><td>" + joinButton + "</td></tr>");
    table.append(newLobby);
    $("#category" + lobbyID).val(category);
    if (nameFromServer != username){
        $("#category" + lobbyID).attr("disabled", true);
    }
    else{
        $("#createLobbyButton").attr("disabled", true);
        $("#joinButton" + lobbyID).attr("disabled", true);
        $("#startButton").removeAttr("disabled");
    }
}

// Request to change lobby category 
function changeCategory(id){
    socket.emit("changeCategory", {
        lobbyID: id,
        category: $("#category" + id).val()
    });
}

// Changes lobby category on server approval
function updateLobbyCategory(lobbyID, category){
    $("#category" + lobbyID).val(category);
}

// Request to join lobby
function joinLobby(value){
    socket.emit("joinLobby", {
        lobbyID: value,
        name: username
    });
    // Disable host privileges
    $("#joinButton" + value).attr("disabled", true);
    $("#startButton").attr("disabled", true);
};

// Handle player joining or leaving a lobby
function playerHop(lobbyID, size, host){
    $("#lobbyCount" + lobbyID).html(size + "/4");
    if (username != host){
        $("#joinButton" + lobbyID).removeAttr("disabled");
    }
}

// Updates lobby count
function updateLobbyCount(lobbyID, size){
    $("#lobbyCount" + lobbyID).val(size);
    $("#lobbyCount" + lobbyID).html(size + "/4");
}

// Disable join for a full lobby
function lockLobby(lobbyID){
    $("#joinButton" + lobbyID).attr("disabled", true);
}

// Request to start game
function startGameMsg(){
    socket.emit("startGame", username);
}

// Move players in a lobby to game state
function startGame(data){
    party = data.party;
    assignPlayers(data.party);

    // Load Game Page HTML
    loadGamePage();
}

// Delete lobby when game is started or host joins another lobby
function deleteLobby(data){
    $("#lobbyRow" + data.lobbyID).remove();
    $("#createLobbyButton").removeAttr("disabled");
}

/*--------------------------Game page functions----------------------------*/

const gamePageElements = ["gamePage", "ctx", "readyUpWindow", "backButton", "answerBox", "racetrack"];
const homePageElements = ["homePage"];

// Hide home page and reveal game page
function loadGamePage(){
    $("#homePage").attr("style", "display: none");

    for (let element in gamePageElements){
        $("#" + gamePageElements[element]).attr("style", "display: block");
    }

    lockAnswers(true);
}

// Assign player roles and permissions
assignPlayers = function(party){
    for (let i = 0; i < 4; i++){
        $("#player" + (i + 1)).html(party[i]);
        $("#colorTD" + (i + 1)).html("<select id='color" + (i + 1) + "' onchange='changeColor(" + (i + 1) + ")' disabled>\
        <option value='white'>white</option><option value='red'>red</option><option value='blue'>blue</option>\
        <option value='yellow'>yellow</option><option value='green'>green</option>\
        <option value='orange'>orange<option value='navy'>navy</option><option value='purple'>purple<option value='neon'>neon</option>\
        <option value='stripes'>stripes<option value='police'>police</option></select>");
    }

    // Assign ready up permissions
    switch(username){
        case party[0]: 
            $("#p1ReadyUp, #scoreToWin, #increment, #decrement, #color1").removeAttr("disabled");
            $("#p1ReadyUp").addClass("rightReadyUp");
            break;
        case party[1]:
            $("#p2ReadyUp, #color2").removeAttr("disabled");
            break;
        case party[2]:
            $("#p3ReadyUp, #color3").removeAttr("disabled");
            break;
        case party[3]:
            $("#p4ReadyUp, #color4").removeAttr("disabled");
    }

    // Set individual lanes for each player
    assignLanes();
}

// Ready up empty players and assign lanes
function assignLanes(){
    for (let i = 0; i < 4; i++){
        if (party[i] == "Empty"){
            $("#p" + (i + 1) + "ReadyUp").prop("checked", true);
        }
        else{
            if (i == 0){
                $("#car0").attr("src", "images/redCar.png");
                $("#color1").val("red");
            }
            else if (i == 1){
                $("#car1").attr("src", "images/blueCar.png");
                $("#color2").val("blue");
            }
            else if (i == 2){
                $("#car2").attr("src", "images/yellowCar.png");
                $("#color3").val("yellow");
            }
            else{
                $("#car3").attr("src", "images/greenCar.png");
                $("#color4").val("green");
            }
        }
        $("#player" + (i + 1) + "Tag").html(party[i]);
    }
}

// Handler for host increasing score to win
increment = function(){
    if ($("#scoreToWin").val() < 10){
        $("#scoreToWin").get(0).value++;
        socket.emit("scoreToWinChange", [username, $("#scoreToWin").val()]);
    }
}

// Handler for host decreasing score to win
decrement = function(){
    if ($("#scoreToWin").val() > 1){
        $("#scoreToWin").get(0).value--;
        socket.emit("scoreToWinChange", [username, $("#scoreToWin").val()]);
    }
}

// Update score to win on host changing it
function updateScoreToWin(quantity){
    $("#scoreToWin").val(quantity);
}

// Change color of car and notify server
function changeColor(id){
    $("#car" + (id - 1)).attr("src", "images/" + $("#color" + id).val() + "Car.png");
    socket.emit("changeColor", [id, $("#color" + id).val()]);
}

// Handle party members changing car color
function colorUpdate(data){
    $("#car" + (data.car - 1)).attr("src", "images/" + data.color + "Car.png");
    $("#color" + (data.car)).val(data.color);
}

// Notify server player is ready (starts when all 4 are checked)
function readyUp(){
    socket.emit("initialReadyUp", username);
}

// Display ready checks for players that have "ready upped"
function playerReadyUp(playerNumber){
    $("#p" + (playerNumber + 1) + "ReadyUp").prop("checked", true);
    $("#p" + (playerNumber + 1) + "ReadyUp").attr("disabled", true);
}

// Start the countdown and game when all players have "ready upped"
function playGame(){
    $("#readyUpWindow").attr("style", "display: none");
    socket.emit("playGame", username);
}

const circles = document.querySelectorAll('.circle')
let activeLight = 0;
$("#stoplight").hide();

// Controls stoplight changing colors on countdown
function changeLight(){
    circles[activeLight].className = 'circle';
    activeLight++;
  
    if(activeLight > 2) {
        activeLight = 0;
    }
  
    const currentLight = circles[activeLight]
    currentLight.classList.add(currentLight.getAttribute('color'));
}

// Initiate race countdown
function startCountDown(data){
    $("#carList, #finishLine, #playerList").attr("style",  "filter: blur(4px)");
    $("#countdowntimer").attr("style", "display: block");
    $("#stoplight").show(1200);
    let downloadTimer = setInterval(function(){
        $("#countdowntimer").html(data.time);
        data.time--;
        if (data.time < 2){
            changeLight();
        }
        if(data.time <= -1){
            clearInterval(downloadTimer);
            $("#countdowntimer").hide();
            $("#stoplight").hide("fast");
            displayQuestion(data);  
        }
    },1200);
}

// Display the question retrieved from server
function displayQuestion(data){
    lockAnswers(false);
    $("#carList, #finishLine, #playerList").attr("style",  "filter: blur(4px)");
    $("#question").html(data.question['question']);
    $("#question").attr("style", "display: block");
    setAnswerChoices(data);
    startTimer(10);
}

// Set the (shuffled) answer choices
function setAnswerChoices(data){
    for (let i = 0; i < 4; i++){
        document.getElementById("answer" + i).innerHTML = data['question']["shuffledAnswers"][i];
    }
};  

// Initiate 10 second question timer
function startTimer(time){
    $("#stopwatch").attr("style", "display: block");
    timer = setInterval(function(){
        $("#stopwatch").html(time);
        time--;
        if (time <= 2){
            $("#stopwatch").addClass("blink_me");
        }
        if(time <= -2){
            $("#stopwatch").removeClass("blink_me");
            clearInterval(timer);
            $("#stopwatch").attr("style", "display: none");
            $("#stopwatch").html(10);
            if (!($("#answer1").attr("disabled"))){
                socket.emit("playerAnswer", 9);
                lockAnswers(true);
            }
            socket.emit("checkAnswers", username);
        }
    },1000);
};

// Event handler for player choosing answer - sends to server
function answerMsg(value){
    socket.emit("playerAnswer", value);
    $("readyTag1").attr("style", "opacity: 100%");
    lockAnswers(true);
}

// Disable answer buttons after picking an answer and in between rounds
function lockAnswers(bool){
    if (bool){
        for (let i = 0; i < 4; i++){
            $("#answer" + i).attr("disabled", true);
        }
    }
    else{
        for (let i = 0; i < 4; i++){
            $("#answer" + i).removeAttr("disabled");
        }
    }
}

// Clears the timer when all players have answered and/or timer expires
function stopTheClock(){
    clearInterval(timer);
    $("#stopwatch").removeClass("blink_me");
    $("#stopwatch").attr("style", "display: none");
    $("#stopwatch").html(10);
    lockAnswers(true);
    socket.emit("checkAnswers", username);
}        

// Highlights correct answer when timer expires
function revealAnswer(data){
    for (let i = 0; i < 4; i++){
        if ($("#answer" + [i]).text() == data){
            $("#answer" + [i]).addClass("highlight");
            return i;
        }
    }
}

// Move cars for players who answered correctly, start next round
function movePlayers(data){
    for (let i = 1; i < 5; i++){
        $("#readyTag" + i).attr("style", "opacity: 0%");        
    }

    $("#question").attr("style", "dispay: none");
    $("#carList, #finishLine, #playerList").attr("style",  "filter: blur(0)");
    let sizeFactor = (document.getElementById("carList").clientHeight) / parseInt(data.scoreToWin);

    let answerIndex = revealAnswer(data.correct);
    setTimeout(function(){
        for (let i = 0; i < 4; i++){
            $("#car" + i).animate({
                marginBottom: "" + (sizeFactor * data.score[i][1]) + "%"
            });
        }
    }, 1000);

    setTimeout(function(){
        socket.emit("nextQuestion");
        $("#answer" + answerIndex).removeClass("highlight");
    }, 2000, username);   
}

// Display animations and results when player wins or 50 question limit exceeded
function gameover(data){
    setResults(data);
    if (username == data.winner){
        winnerAnimation(data);
    }
    else{
        loserAnimation(data);
    }
}

// Sort the scores and set the placings
function setResults(data){
    data.score = (data.score).sort(function(a,b) {
        return b[1] - a[1]
    });

    $("#firstPlace").html(data.score[0][0]);
    $("#secondPlace").html(data.score[1][0]);
    $("#thirdPlace").html(data.score[2][0]);

    $("#firstPlaceScore").html(data.score[0][1]);
    $("#secondPlaceScore").html(data.score[1][1]);
    $("#thirdPlaceScore").html(data.score[2][1]);
    $(".scoreBase").html("/" + data.numberOfRounds);
}

// Display winner animation to winner
function winnerAnimation(data){
    $(".pyro").attr("style", "display: block");
    $("#winner").attr("style", "display: block");
    setTimeout(function(){
        $("#resultsWindow").attr("style", "display: block");
        $("#resultsWindow").animate({
            marginTop: "65%"
        }, 1000);
    }, 3000);
}

// Display loser animation to all other players (currently just results window)
function loserAnimation(data){
    setTimeout(function(){
        $("#resultsWindow").attr("style", "display: block");
        $("#resultsWindow").animate({
            marginTop: "65%"
        }, 1000);

    }, 3000);
}     

// Load the home page and hide game page when players disconnect or leave after game
function loadHomePage(data){
    // Hide Game Page Elements
    for (let element in gamePageElements){
        $("#" + gamePageElements[element]).attr("style", "display: none");
    }

    // Reveal Home Page Elements
    $("#homePage").attr("style", "display: block");

    if (data == "quit"){
        socket.emit("quit", username);
    }

    resetGameState();
}

// Reset the original state of the game after players have left
resetGameState = function(){
    for (let i = 0; i < 4; i++){
        $("#car" + i).attr("style", "margin-bottom: 0");
        $("#car" + i).attr("src", "images/whiteCar.png");
        $("#answer" + i).html("&#" + (65 + i) + ";");
        $("#p" + (i + 1) + "ReadyUp").prop("checked", false);
    }
    $("#resultsWindow, #winner, .pyro").attr("style", "display: none");
    $("#startButton").attr("disabled", true);
    $("#scoreToWin").val(5);
    $("#countdowntimer").html("Game Starting");
    $("#countdowntimer").hide();
    $("#stoplight").hide("fast");
} 

// Load home page and display disconnection alert when player in party disconnects
disconnection = function(player){
    loadHomePage();
    $("#modal-text").html("" + player + " left the game.");
    $("#myModal").modal();
}