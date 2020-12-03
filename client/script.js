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
    let categoryOptions = "<select id='category" + lobbyID + "' onchange='changeCategory(" + lobbyID + ")' value='" + category + "'>" + "<option value='General Knowledge'>General Knowledge</option>" +
    "<option value='Film'>Film</option>" + "<option value='Music'>Music</option>" + "<option value='Television'>Television</option>" +
    "<option value='Video Games'>Video Games</option>" + "<option value='Science & Nature'>Science & Nature</option>" + "<option value='Science: Computers'>Computers</option>" +
    "<option value='Science: Mathetmatics'>Mathematics</option>" + "<option value='Sports'>Sports</option>" + "<option value='Geography'>Geography</option>" +
    "<option value='History'>History</option>" + "<option value='Politics'>Politics</option>" + "<option value='Art'>Art</option>" +
    "<option value='Celebrities'>Celebrities</option>" + "<option value='Animals'>Animals</option>" + "<option value='Vehicles'>Vehicles</option>" + 
    "<option value='Anime & Manga'>Anime & Manga</option>" + "<option value='Cartoon & Animations'>Cartoon & Animations</option>" + "</select>";
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
    }
}

joinLobby = function(value){
    socket.emit("joinLobby", {
        lobbyID: value,
        name: name
    });
    $("joinButton" + value).setAttribute("disabled", true);
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