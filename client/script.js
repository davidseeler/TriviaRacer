let $ = function(id){
    return document.getElementById(id);
}

let socket = io();
let ctx = $('ctx').getContext("2d");
let name = "Player";
let host = false;

socket.on("playerInfo", function(data){
    name = data;
    $("nameInput").value = data;
});

socket.on('newPositions', function(data){
    ctx.font = '20px Arial';
    ctx.clearRect(0, 0, 500, 500);
    for (var i = 0; i < data.length; i++){
        ctx.fillText(data[i].number, data[i].x, data[i].y + (i * 30));
    }
});

socket.on('count', function(data){
    $("playerCount").innerHTML = data;
});

socket.on("fetchExistingLobbies", function(data){
    let lobbies = data;
    for (let lobby in lobbies){
        createLobby(lobby, lobbies[lobby]['players'][0], 
        lobbies[lobby]['players'].length, lobbies[lobby]['category']);    
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
        $("lobbyRow" + data.lobbyID).remove();
        $("createLobbyButton").removeAttribute("disabled");
    }
    if (data.type == "playerHop"){
        playerHop(data.lobbyID, data.name, data.size);
    }
});

sendName = function(){
    name = $("nameInput").value;
    socket.emit("updateName", name);
}

createLobbyMsg = function(){
    socket.emit("createLobby", name);
}

createLobby = function(lobbyID, nameFromServer, size, category){
    let table = $("lobbyTable");
    let newLobby = document.createElement('tr');
    newLobby.setAttribute("id", "lobbyRow" + lobbyID);
    let joinButton = "<button value='" + lobbyID + "' onclick='joinLobby(value)' id='joinButton" + lobbyID + "'>Join</button>";
    let categoryOptions = "<select id='category" + lobbyID + "' onchange='changeCategory(" + lobbyID + ")'>" + "<option value='9' selected>General Knowledge</option>" +
    "<option value='11'>Film</option>" + "<option value='12'>Music</option>" + "<option value='14'>Television</option>" +
    "<option value='15'>Video Games</option>" + "<option value='17'>Science & Nature</option>" + "<option value='18'>Computers</option>" +
    "<option value='19'>Mathematics</option>" + "<option value='21'>Sports</option>" + "<option value='22'>Geography</option>" +
    "<option value='23'>History</option>" + "<option value='24'>Politics</option>" + "<option value='25'>Art</option>" +
    "<option value='26'>Celebrities</option>" + "<option value='27'>Animals</option>" + "<option value='28'>Vehicles</option>" + 
    "<option value='31'>Anime & Manga</option>" + "<option value='32'>Cartoon & Animations</option>" + "</select>";
    newLobby.innerHTML = "<td><span>" + nameFromServer + "</span></td><td id='lobbyCount" + lobbyID + "'>" + size + "/5</td><td>" + 
    "<label></label>" + categoryOptions + "</td><td>" + joinButton + "</td>";
    table.appendChild(newLobby);
    $("category" + lobbyID).value = category;
    if (nameFromServer != name){
        $("category" + lobbyID).setAttribute("disabled", true);
    }
    else{
        host = true;
        $("createLobbyButton").setAttribute("disabled", true);
        $("joinButton" + lobbyID).setAttribute("disabled", true);
        $("startButton").removeAttribute("disabled");
    }
}

joinLobby = function(value){
    socket.emit("joinLobby", {
        lobbyID: value,
        name: name
    });
    $("joinButton" + value).setAttribute("disabled", true);
    $("startButton").setAttribute("disabled", true);
};

updateLobbyCount = function(lobbyID, size){
    $("lobbyCount" + lobbyID).innerHTML = size + "/5";
}

updateLobbyCategory = function(lobbyID, category){
    $("category" + lobbyID).value = category;
}

changeCategory = function(id){
    socket.emit("changeCategory", {
        lobbyID: id,
        category: $("category" + id).value
    });
}

playerHop = function(lobbyID, name, size){
    $("lobbyCount" + lobbyID).innerHTML = size + "/5";
    $("joinButton" + lobbyID).removeAttribute("disabled");
}

// Call Open Trivia Database API to retrieve question data
getData = function(category){
    return fetch("https://opentdb.com/api.php?amount=10&" + category)
        .then(res => res.json())
        .then(posts => console.log(posts));
}

startGame = function(){
    let category = "category=";
    let data = "";
    socket.emit("startGame", name);
    socket.on("startGame", function(data){
        category += $("category" + data.lobbyID).value;
        data = getData(category);
    });

    $("homePage").setAttribute("style", "display: none");
    $("gamePage").setAttribute("style", "display: block");

    console.log(data);
}

goBackHome = function(){
    $("gamePage").setAttribute("style", "display: none");
    $("homePage").setAttribute("style", "display: block");
}