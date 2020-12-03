let $ = function(id){
    return document.getElementById(id);
}

let socket = io();
let ctx = $('ctx').getContext("2d");
let name = "Player";

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
        $("lobbyRow" + data.lobbyID).remove();
        $("createLobbyButton").removeAttribute("disabled");
    }
    if (data.type == "playerHop"){
        playerHop(data.lobbyID, data.size, data.host);
    }
    if (data.type == "lobbyFull"){
        lockLobby(data.lobbyID);
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
    newLobby.innerHTML = "<td><span>" + nameFromServer + "</span></td><td id='lobbyCount" + lobbyID + "' value='" + size + "'>" + size + "/4</td><td>" + 
    "<label></label>" + categoryOptions + "</td><td>" + joinButton + "</td>";
    table.appendChild(newLobby);
    $("category" + lobbyID).value = category;
    if (nameFromServer != name){
        $("category" + lobbyID).setAttribute("disabled", true);
    }
    else{
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
    $("lobbyCount" + lobbyID).value = size;
    $("lobbyCount" + lobbyID).innerHTML = size + "/4";
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

playerHop = function(lobbyID, size, host){
    $("lobbyCount" + lobbyID).innerHTML = size + "/4";
    console.log("name: " + name + " host: " + host);
    if (name != host){
        console.log("made it");
        $("joinButton" + lobbyID).removeAttribute("disabled");
    }
}

lockLobby = function(lobbyID){
    $("joinButton" + lobbyID).setAttribute("disabled", true);
}

startGame = function(){
    let questions = "";
    let party = [];
    let temp = "";
    socket.emit("startGame", name);
    socket.on("startGame", function(data){
        for (let result in data.questions['results']){
            temp += data.questions['results'][result]['question'] + "\n\n";
        }
        $("question").innerHTML = temp;
        assignPlayers(data.party);
    });

    // Load Game Page HTML
    loadGamePage();
}

assignPlayers = function(party){
    $("player1").innerHTML = party[0];
    $("player2").innerHTML = party[1];
    $("player3").innerHTML = party[2];
    $("player4").innerHTML = party[3];
}

gamePageElements = ["gamePage", "ctx", "playerBox", "backButton"];
homePageElements = ["homePage"];

loadHomePage = function(){
    // Hide Game Page Elements
    for (let element in gamePageElements){
        $(gamePageElements[element]).setAttribute("style", "display: none");
    }

    // Reveal Home Page Elements
    $("homePage").setAttribute("style", "display: block");
}

loadGamePage = function(){
    // Hide Home Page Elements
    $("homePage").setAttribute("style", "display: none");

    // Reveal Game Page Elements
    for (let element in gamePageElements){
        $(gamePageElements[element]).setAttribute("style", "display: block");
    }
}