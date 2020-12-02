let $ = function(id){
    return document.getElementById(id);
}

let socket = io();
let ctx = $('ctx').getContext("2d");
let name = "Player";

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

socket.on("broadcast", function(data){
    if (data.type == "createLobby"){
        createLobby(data.lobbyID, data.name);
    }
    if (data.type == "updateLobbies"){
        updateLobbies(data.lobbyID, data.size);
    }
});

sendName = function(){
    name = $("nameInput").value;
    socket.emit("updateName", name);
}

createLobbyMsg = function(){
    socket.emit("createLobby", name);
}

createLobby = function(lobbyID, userID){
    let table = $("lobbyTable");
    let joinButton = "<button value='" + lobbyID + "' onclick='joinLobby(value)' id='joinButton'>Join</button>";
    let categoryOptions = "<select>" + "<option value='General Knowledge'>General Knowledge</option>" +
    "<option value='Film'>Film</option>" + "<option value='Music'>Music</option>" + "<option value='Television'>Television</option>" +
    "<option value='Video Games'>Video Games</option>" + "<option value='Science & Nature'>Science & Nature</option>" + "<option value='Science: Computers'>Computers</option>" +
    "<option value='Science: Mathetmatics'>Mathematics</option>" + "<option value='Sports'>Sports</option>" + "<option value='Geography'>Geography</option>" +
    "<option value='History'>History</option>" + "<option value='Politics'>Politics</option>" + "<option value='Art'>Art</option>" +
    "<option value='Celebrities'>Celebrities</option>" + "<option value='Animals'>Animals</option>" + "<option value='Vehicles'>Vehicles</option>" + 
    "<option value='Anime & Manga'>Anime & Manga</option>" + "<option value='Cartoon & Animations'>Cartoon & Animations</option>" + "</select>";
    table.innerHTML += "<tr><td><span>" + userID + "</span></td><td id='lobbyCount" + lobbyID + "'>1/5</td><td>" + 
    "<label></label>" + categoryOptions + "</td><td>" + joinButton + "</td></tr>";
}

joinLobby = function(value){
    socket.emit("joinLobby", {
        lobbyID: value,
        name: name
    });
};

updateLobbies = function(lobbyID, size){
    $("lobbyCount" + lobbyID).innerHTML = size + "/5";
}
