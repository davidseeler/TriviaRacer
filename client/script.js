let socket = io();
let username = "Player";
let playerNum = "";
let party = "";
let timeRemaining = 0;
let timer = "";

document.getElementById("chatForm").onsubmit = function(e){
    e.preventDefault();
    socket.emit("sendMsg", $("#chatMessage").val());
    $("#chatMessage").val("");
}

socket.on("playerInfo", function(data){
    username = data;
    $("#nameInput").val(data);
});

socket.on("unavailableName", function(data){
    $("#nameSpinner").hide();
    $("#nameTaken").html("'" + data + "' is unavailable.")
    $("#nameInput").attr("style", "border: 1px solid red");
    $("#nameTaken").attr("style", "display: block");
    $("#nameInput").click(function(){
        $("#nameInput").val("");
        $("#nameInput").attr("style", "border: none");
        $("#nameTaken").attr("style", "display: none");
    });
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
    if (data.type == "updatePlayerCount"){
        $("#playerCount").html(data.count);
    }
    if (data.type == "addToChat"){
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
        if (data.party.includes(username)){
            startGame(data);
        }
    }
    if (data.type == "disconnection"){
        $("#lobbyRow" + data.lobbyID).remove();
    }
});

socket.on("partyMessage", function(data){
    if (data.type == "playerReady"){
        playerReadyUp(data.player);
    }
    if (data.type == "setGameStage"){
        $("#readyUpWindow").attr("style", "display: none");
        socket.emit("playGame", username);
    }
    if (data.type == "scoreToWinChange"){
        updateScoreToWin(data.value);
    }
    if (data.type == "colorChange"){
        colorUpdate(data);
    }
    if (data.type == "clientConfirmation"){
        socket.emit("playerReady", username);
    }
    if (data.type == "displayQuestion"){
        if (data.time == 3 ? startCountDown(data) : displayQuestion(data));
    }
    if (data.type == "movePlayers"){
        movePlayers(data);
    }
    if (data.type == "gameOver"){
        setResults(data);
        if (username == data.winner){
            winnerAnimation(data);
        }
        else{
            loserAnimation(data);
        }
    }
    if (data.type == "disconnection"){
        if (data.disconnected != username){
            disconnection(data.disconnected);
        }
    }
    if (data.type == "playerAnswer"){
        if (Array.isArray(data.playerIndex)){
            for (let index in data.playerIndex){
                $("#readyTag" + (data.playerIndex[index] + 1)).attr("style", "opacity: 100%");
            }
        }
        else{
            $("#readyTag" + (data.playerIndex + 1)).attr("style", "opacity: 100%");
        }
    }
    if (data.type == "allPlayersAnswered"){
        stopTheClock();
    }
});

sendName = function(){
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
    else{
        $("#nameSpinner").show();
        let desiredName = $("#nameInput").val();
        setTimeout(function(){
            socket.emit("updateName", desiredName);
        }, 500);
    }
}

updateName = function(data){
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

createLobbyMsg = function(){
    socket.emit("createLobby", username);
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

joinLobby = function(value){
    socket.emit("joinLobby", {
        lobbyID: value,
        name: username
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

changeColor = function(id){
    $("#car" + (id - 1)).attr("src", "client/images/" + $("#color" + id).val() + "Car.png");
    socket.emit("changeColor", [id, $("#color" + id).val()]);
}

colorUpdate = function(data){
    $("#car" + (data.car - 1)).attr("src", "client/images/" + data.color + "Car.png");
    $("#color" + (data.car)).val(data.color);
}

playerHop = function(lobbyID, size, host){
    $("#lobbyCount" + lobbyID).html(size + "/4");
    if (username != host){
        $("#joinButton" + lobbyID).removeAttr("disabled");
    }
}

lockLobby = function(lobbyID){
    $("#joinButton" + lobbyID).attr("disabled", true);
}

startGameMsg = function(){
    socket.emit("startGame", username);
}

startGame = function(data){
    party = data.party;
    assignPlayers(data.party);

    // Load Game Page HTML
    loadGamePage();
}

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

    // Ready up empty players and assign columns
    for (let i = 0; i < 4; i++){
        if (party[i] == "Empty"){
            $("#p" + (i + 1) + "ReadyUp").prop("checked", true);
        }
        else{
            if (i == 0){
                $("#car0").attr("src", "client/images/redCar.png");
                $("#color1").val("red");
            }
            else if (i == 1){
                $("#car1").attr("src", "client/images/blueCar.png");
                $("#color2").val("blue");
            }
            else if (i == 2){
                $("#car2").attr("src", "client/images/yellowCar.png");
                $("#color3").val("yellow");
            }
            else{
                $("#car3").attr("src", "client/images/greenCar.png");
                $("#color4").val("green");
            }
        }
        $("#player" + (i + 1) + "Tag").html(party[i]);
    }
}

readyUp = function(){
    socket.emit("initialReadyUp", username);
}

playerReadyUp = function(playerNumber){
    $("#p" + (playerNumber + 1) + "ReadyUp").prop("checked", true);
    $("#p" + (playerNumber + 1) + "ReadyUp").attr("disabled", true);
}

gamePageElements = ["gamePage", "ctx", "readyUpWindow", "backButton", "answerBox", "racetrack"];
homePageElements = ["homePage"];

loadHomePage = function(data){
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

loadGamePage = function(){
    // Hide Home Page Elements
    $("#homePage").attr("style", "display: none");

    // Reveal Game Page Elements
    for (let element in gamePageElements){
        $("#" + gamePageElements[element]).attr("style", "display: block");
    }

    lockAnswers(true);
}

resetGameState = function(){
    for (let i = 0; i < 4; i++){
        $("#car" + i).attr("style", "margin-bottom: 0");
        $("#car" + i).attr("src", "client/images/whiteCar.png");
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

startCountDown = function(data){
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

startTimer = function(time){
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

function stopTheClock(){
    clearInterval(timer);
    $("#stopwatch").removeClass("blink_me");
    $("#stopwatch").attr("style", "display: none");
    $("#stopwatch").html(10);
    lockAnswers(true);
    socket.emit("checkAnswers", username);
}

setAnswerChoices = function(data){
    for (let i = 0; i < 4; i++){
        document.getElementById("answer" + i).innerHTML = data['question']["shuffledAnswers"][i];
    }
};                

answerMsg = function(value){
    socket.emit("playerAnswer", value);
    $("readyTag1").attr("style", "opacity: 100%");
    lockAnswers(true);
}

displayQuestion = function(data){
    lockAnswers(false);
    $("#carList, #finishLine, #playerList").attr("style",  "filter: blur(4px)");
    $("#question").html(data.question['question']);
    $("#question").attr("style", "display: block");
    setAnswerChoices(data);
    startTimer(10);
}

movePlayers = function(data){
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
    if ($("#scoreToWin").val() < 10){
        $("#scoreToWin").get(0).value++;
        socket.emit("scoreToWinChange", [username, $("#scoreToWin").val()]);
    }
}

decrement = function(){
    if ($("#scoreToWin").val() > 1){
        $("#scoreToWin").get(0).value--;
        socket.emit("scoreToWinChange", [username, $("#scoreToWin").val()]);
    }
}

updateScoreToWin = function(quantity){
    $("#scoreToWin").val(quantity);
}

convertMatrix = function(data){
    let arr = [];
    for (let i = 0; i < 4; i++){
        arr.push(data.scores[i][1]);
    }
}

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

winnerAnimation = function(data){
    $(".pyro").attr("style", "display: block");
    $("#winner").attr("style", "display: block");
    setTimeout(function(){
        $("#resultsWindow").attr("style", "display: block");
        $("#resultsWindow").animate({
            marginTop: "65%"
        }, 1000);
    }, 3000);
}

loserAnimation = function(data){
    setTimeout(function(){
        $("#resultsWindow").attr("style", "display: block");
        $("#resultsWindow").animate({
            marginTop: "65%"
        }, 1000);

    }, 3000);
}

disconnection = function(player){
    loadHomePage();
    $("#modal-text").html("" + player + " left the game.");
    $("#myModal").modal();
}

const circles = document.querySelectorAll('.circle')
let activeLight = 0;
$("#stoplight").hide();

changeLight = function(){
  circles[activeLight].className = 'circle';
  activeLight++;
  
  if(activeLight > 2) {
    activeLight = 0;
  }
  
  const currentLight = circles[activeLight]
  
  currentLight.classList.add(currentLight.getAttribute('color'));
}