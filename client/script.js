let $ = function(id){
    return document.getElementById(id);
}

let socket = io();
let ctx = $('ctx').getContext("2d");

socket.on('newPositions', function(data){
    ctx.font = '20px Arial';
    ctx.clearRect(0, 0, 500, 500);
    for (var i = 0; i < data.length; i++){
        ctx.fillText(data[i].number, data[i].x, data[i].y + (i * 30));
    }
});

socket.on('addToChat', function(data){
    if (data.substring(0, 6) == "SYSTEM"){
        chatText.innerHTML += "<div class='systemMsg'>" + data + "</div>";
    }
    else{
        chatText.innerHTML += '<div>' + data + '</div>';
    }
    var xH = chatText.scrollHeight; 
    chatText.scrollTo(0, xH);
});

chatForm.onsubmit = function(e){
    e.preventDefault();
    socket.emit('sendMsgToServer', chatInput.value);
    chatInput.value = '';
}
