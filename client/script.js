let socket = io();
let name = "Player";
let playerNum = "";
let party = "";
let timeRemaining = 0;

socket.on("playerInfo", function(data){
    name = data;
    $("#nameInput").val(data);
});

socket.on('count', function(data){
    $("#playerCount").html(data);
});

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

socket.on("broadcast", function(data){
    if (data.type == "createLobby"){
        createLobby(data.lobbyID, data.name, data.size, data.category);
    }
    if (data.type == "updateLobbies"){
        updateLobbyCount(data.lobbyID, data.size);
    }
    if (data.type == "changeCategory"){
        updateLobbyCategory(data.lobbyID, data.category);
    }
    if (data.type == "deleteLobby"){
        $("#lobbyRow" + data.lobbyID).remove();
        $("#createLobbyButton").removeAttr("disabled");
    }
    if (data.type == "playerHop"){
        playerHop(data.lobbyID, data.size, data.host);
    }
    if (data.type == "lobbyFull"){
        lockLobby(data.lobbyID);
    }
    if (data.type == "startGame"){
        if (data.party.includes(name)){
            startGame(data);
        }
    }
});

socket.on("partyMessage", function(data){
    if (data.type == "playerReady"){
        playerReadyUp(data.player);
    }
    if (data.type == "setGameStage"){
        $("#readyUpWindow").attr("style", "display: none");
        socket.emit("playGame", name);
    }
    if (data.type == "scoreToWinChange"){
        updateScoreToWin(data.value);
    }
    if (data.type == "clientConfirmation"){
        socket.emit("playerReady", name);
    }
    if (data.type == "displayQuestion"){
        if (data.time == 3 ? startCountDown(data) : displayQuestion(data));
        lockAnswers(false);
    }
    if (data.type == "movePlayers"){
        movePlayers(data);
    }
    if (data.type == "gameOver"){
        console.log(data);
        if (name == data.winner){
            winnerAnimation(data);
        }
        else{
            loserAnimation(data);
        }
        console.log("weeener");
    }
});

sendName = function(){
    name = $("#nameInput").val();
    socket.emit("updateName", name);
}

createLobbyMsg = function(){
    socket.emit("createLobby", name);
}

createLobby = function(lobbyID, nameFromServer, size, category){
    let table = $("#lobbyTable");
    let joinButton = "<button value='" + lobbyID + "' onclick='joinLobby(value)' id='joinButton" + lobbyID + "'>Join</button>";
    let categoryOptions = "<select id='category" + lobbyID + "' onchange='changeCategory(" + lobbyID + ")'>" + "<option value='9' selected>General Knowledge</option>" +
    "<option value='11'>Film</option>" + "<option value='12'>Music</option>" + "<option value='14'>Television</option>" +
    "<option value='15'>Video Games</option>" + "<option value='17'>Science & Nature</option>" + "<option value='18'>Computers</option>" +
    "<option value='19'>Mathematics</option>" + "<option value='21'>Sports</option>" + "<option value='22'>Geography</option>" +
    "<option value='23'>History</option>" + "<option value='24'>Politics</option>" + "<option value='25'>Art</option>" +
    "<option value='26'>Celebrities</option>" + "<option value='27'>Animals</option>" + "<option value='28'>Vehicles</option>" + 
    "<option value='31'>Anime & Manga</option>" + "<option value='32'>Cartoon & Animations</option>" + "</select>";
    let newLobby = $("<tr id='lobbyRow" + lobbyID + "'><td><span>" + nameFromServer + "</span></td><td id='lobbyCount" + lobbyID + "' value='" + size + "'>" + size + "/4</td><td id='categorySelect'>" + 
    "" + categoryOptions + "</td><td>" + joinButton + "</td></tr>");
    table.append(newLobby);
    $("#category" + lobbyID).val(category);
    if (nameFromServer != name){
        $("#category" + lobbyID).attr("disabled", true);
    }
    else{
        $("#createLobbyButton").attr("disabled", true);
        $("#joinButton" + lobbyID).attr("disabled", true);
        $("#startButton").removeAttr("disabled");
    }
}

joinLobby = function(value){
    socket.emit("joinLobby", {
        lobbyID: value,
        name: name
    });
    $("#joinButton" + value).attr("disabled", true);
    $("#startButton").attr("disabled", true);
};

updateLobbyCount = function(lobbyID, size){
    $("#lobbyCount" + lobbyID).val(size);
    $("#lobbyCount" + lobbyID).html(size + "/4");
}

updateLobbyCategory = function(lobbyID, category){
    $("#category" + lobbyID).val(category);
}

changeCategory = function(id){
    socket.emit("changeCategory", {
        lobbyID: id,
        category: $("#category" + id).val()
    });
}

playerHop = function(lobbyID, size, host){
    $("#lobbyCount" + lobbyID).html(size + "/4");
    if (name != host){
        $("#joinButton" + lobbyID).removeAttr("disabled");
    }
}

lockLobby = function(lobbyID){
    $("#joinButton" + lobbyID).attr("disabled", true);
}

startGameMsg = function(){
    socket.emit("startGame", name);
}

startGame = function(data){
    party = data.party;
    assignPlayers(data.party);

    // Load Game Page HTML
    loadGamePage();
}

assignPlayers = function(party){
    $("#player1").html("<div>" + party[0] + "<input type='checkbox' id='p1ReadyUp' onclick='readyUp()' disabled></div>");
    $("#player2").html("<div>" + party[1] + "<input type='checkbox' id='p2ReadyUp' onclick='readyUp()' disabled></div>");
    $("#player3").html("<div>" + party[2] + "<input type='checkbox' id='p3ReadyUp' onclick='readyUp()' disabled></div>");
    $("#player4").html("<div>" + party[3] + "<input type='checkbox' id='p4ReadyUp' onclick='readyUp()' disabled></div>");

    // Assign ready up permissions
    switch(name){
        case party[0]: 
            $("#p1ReadyUp, #roundQuantity, #increment, #decrement").removeAttr("disabled");
            break;
        case party[1]:
            $("#p2ReadyUp").removeAttr("disabled");
            break;
        case party[2]:
            $("#p3ReadyUp").removeAttr("disabled");
            break;
        case party[3]:
            $("#p4ReadyUp").removeAttr("disabled");
    }

    // Ready up empty players and assign columns
    for (let i = 0; i < 4; i++){
        if (party[i] == "Empty"){
            $("#p" + (i + 1) + "ReadyUp").attr("checked", true);
        }
        $("#player" + (i + 1) + "Tag").html(party[i]);
    }
}

readyUp = function(){
    socket.emit("readyUp", name);
}

playerReadyUp = function(playerNumber){
    $("#p" + (playerNumber + 1) + "ReadyUp").attr("checked", true);
    $("#p" + (playerNumber + 1) + "ReadyUp").attr("disabled", true);
}

gamePageElements = ["gamePage", "ctx", "readyUpWindow", "backButton", "answerBox", "racetrack"];
homePageElements = ["homePage"];

loadHomePage = function(){
    // Hide Game Page Elements
    for (let element in gamePageElements){
        $("#" + gamePageElements[element]).attr("style", "display: none");
    }

    // Reveal Home Page Elements
    $("#homePage").attr("style", "display: block");
}

loadGamePage = function(){
    // Hide Home Page Elements
    $("#homePage").attr("style", "display: none");

    // Reveal Game Page Elements
    for (let element in gamePageElements){
        $("#" + gamePageElements[element]).attr("style", "display: block");
    }

    lockAnswers(true);
}

startCountDown = function(data){
    $("#carList, #playerList").attr("style",  "filter: blur(4px)");
    $("#countdowntimer").attr("style", "display: block");
    let downloadTimer = setInterval(function(){
        $("#countdowntimer").html(data.time);
        data.time--;
        if(data.time <= -1){
            clearInterval(downloadTimer);
            $("#countdowntimer").attr("style", "display: none");
            displayQuestion(data);
        }
    },1000);
}

startTimer = function(time){
    $("#stopwatch").attr("style", "display: block");
    let downloadTimer = setInterval(function(){
        $("#stopwatch").html(time);
        time--;
        if(time <= -2){
            clearInterval(downloadTimer);
            $("#stopwatch").attr("style", "display: none");
            $("#stopwatch").html(10);
            lockAnswers(true);
            socket.emit("checkAnswers", name);
        }
    },1000);
    
};

setAnswerChoices = function(data){
    for (let i = 0; i < 4; i++){
        document.getElementById("answer" + i).innerHTML = data['question']["shuffledAnswers"][i];
    }
};                

answerMsg = function(value){
    socket.emit("answer", [name, value]);
    lockAnswers(true);
}

displayQuestion = function(data){
    $("#carList, #playerList").attr("style",  "filter: blur(4px)");
    $("#question").attr("style", "display: block");
    $("#question").html(data.question['question']);
    setAnswerChoices(data);
    startTimer(10);
}

movePlayers = function(data){
    $("#question").attr("style", "dispay: none");
    $("#carList, #playerList").attr("style",  "filter: blur(0)");
    let sizeFactor = (document.getElementById("carList").clientHeight) / (parseInt(data.scoreToWin) + 2);
    console.log("window height: " + document.getElementById("carList").clientHeight);

    let answerIndex = revealAnswer(data.correct);
    setTimeout(function(){
        for (let i = 0; i < 4; i++){
            $("#car" + i).animate({
                marginBottom: "" + (sizeFactor * data.score[i][1]) + "%"
            });
        }
    }, 1000);

    setTimeout(function(){
        socket.emit("playerReady", name);
        $("#answer" + answerIndex).removeClass("highlight");
    }, 2000, name);   
}

lockAnswers = function(bool){
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

revealAnswer = function(data){
    for (let i = 0; i < 4; i++){
        if ($("#answer" + [i]).text() == data){
            $("#answer" + [i]).addClass("highlight");
            return i;
        }
    }
}

increment = function(){
    if ($("#scoreToWin").val() < 20){
        $("#scoreToWin").get(0).value++;
        socket.emit("scoreToWinChange", [name, $("#scoreToWin").val()]);
    }
}

decrement = function(){
    if ($("#scoreToWin").val() > 1){
        $("#scoreToWin").get(0).value--;
        socket.emit("scoreToWinChange", [name, $("#scoreToWin").val()]);
    }
}

updateScoreToWin = function(quantity){
    $("#scoreToWin").val(quantity);
}

winnerAnimation = function(data){
    $(".pyro").attr("style", "display: block");
    $("#winner").attr("style", "display: block");
    setTimeout(function(){
        //$("#resultsWindow").attr("style", "display: block");
    }, 2000);
    
    console.log("made it");
}

loserAnimation = function(data){
    console.log("loser");
}