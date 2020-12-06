let socket = io();
let name = "Player";
let playerNum = "";
let party = "";
let ctx = $("#ctx").get(0).getContext("2d");

socket.on("playerInfo", function(data){
    name = data;
    $("#nameInput").val(data);
});


socket.on('newPositions', function(data){
    ctx.font = '20px Arial';
    ctx.clearRect(0, 0, 500, 500);
    for (let i = 0; i < data.length; i++){
        ctx.fillText(data[i].number, data[i].x, data[i].y + (i * 30));
    }
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
    if (data.type == "playGame"){
        $("#readyUpWindow").attr("style", "display: none");
        socket.emit("fetchQuestions", name);
        
    }
    if (data.type == "preparationConfirmation"){
        console.log(data.clock);
        startTimer(data.clock);
        socket.emit("preparationConfirmation", name);
    }
    if (data.type == "fetchQuestionsRes"){
        fetchQuestions(data);
        setAnswerChoices(data);
        
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
    let newLobby = $("<tr id='lobbyRow" + lobbyID + "'><td><span>" + nameFromServer + "</span></td><td id='lobbyCount" + lobbyID + "' value='" + size + "'>" + size + "/4</td><td>" + 
    "<label></label>" + categoryOptions + "</td><td>" + joinButton + "</td></tr>");
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

fetchQuestions = function(data){
    $("#question").html(data.question['question']);
}

assignPlayers = function(party){
    $("#player1").html("<div>" + party[0] + "<input type='checkbox' id='p1ReadyUp' onclick='readyUp()' disabled></div>");
    $("#player2").html("<div>" + party[1] + "<input type='checkbox' id='p2ReadyUp' onclick='readyUp()' disabled></div>");
    $("#player3").html("<div>" + party[2] + "<input type='checkbox' id='p3ReadyUp' onclick='readyUp()' disabled></div>");
    $("#player4").html("<div>" + party[3] + "<input type='checkbox' id='p4ReadyUp' onclick='readyUp()' disabled></div>");

    // Assign ready up permissions
    switch(name){
        case party[0]: 
            $("#p1ReadyUp").removeAttr("disabled");
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

    // Ready up empty players
    for (let i = 0; i < 4; i++){
        if (party[i] == "Empty"){
            $("#p" + (i + 1) + "ReadyUp").attr("checked", true);
        }
    }
}

readyUp = function(){
    socket.emit("readyUp", name);
}

playerReadyUp = function(playerNumber){
    $("#p" + (playerNumber + 1) + "ReadyUp").attr("checked", true);
    $("#p" + (playerNumber + 1) + "ReadyUp").attr("disabled", true);
}

gamePageElements = ["gamePage", "ctx", "readyUpWindow", "backButton", "answerBox"];
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
}


startTimer = function(time){
    console.log(time);
    let clock = "";
    if (time == 4){
        clock = $("#countdowntimer");
    }
    else{
        clock = $("#stopwatch");
    }
    clock.attr("style", "display: block");
    let timeleft = time;
    let downloadTimer = setInterval(function(){
        timeleft--;
        clock.html(timeleft);
        if(timeleft <= 0){
            clearInterval(downloadTimer);
            clock.attr("style", "display: none");
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
}

