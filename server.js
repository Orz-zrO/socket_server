var socketIO = require('socket.io');
var fs = require('fs');

var server = null;

if (fs.existsSync('/etc/letsencrypt/live/h5mota.com/privkey.pem')) {
    var options = {
        key: fs.readFileSync('/etc/letsencrypt/live/h5mota.com/privkey.pem'),
        cert: fs.readFileSync('/etc/letsencrypt/live/h5mota.com/fullchain.pem')
    }
    server = require('https').createServer(options);
}
else {
    server = require('http').createServer();
}

var io = socketIO(server);

server.listen(5050, function () {
    console.log(getTime()+'Starting server on port 5050');
});

var isset = function (t) {
    if (t == undefined || t == null || (typeof t == "number" && isNaN(t)))
        return false;
    return true;
}

var getTime = function() {
    var date = new Date();
    var setTwoDigits = function(x) {return parseInt(x)<10?("0"+x):x;}
    return "[" + 
    date.getFullYear()+"-"+setTwoDigits(date.getMonth()+1)+"-"+setTwoDigits(date.getDate())+" "
    +setTwoDigits(date.getHours())+":"+setTwoDigits(date.getMinutes())+":"+setTwoDigits(date.getSeconds())+
    "] "
}

const wuziqi = io.of('/wuziqi');
wuziqi.on('connection', function (socket) {

    var wait = function (socket) {
        if (!isset(wuziqi.adapter.rooms['waiting'])) {
            console.log(getTime()+'Waiting '+socket.id);
            socket.join('waiting');
            return;
        }

        var room = wuziqi.adapter.rooms['waiting'];

        if (room.length > 0) {
            var temp = wuziqi.connected[Object.keys(room.sockets)[0]];

            var rand = parseInt(Math.random() * 2147483647) + 100;
            while (isset(wuziqi.adapter.rooms[rand]) && wuziqi.adapter.rooms[rand].length > 0) {
                rand = parseInt(Math.random() * 2147483647) + 100;
            }

            socket.join(rand);
            temp.leave('waiting');
            temp.join(rand);

            console.log(getTime()+'Match '+rand+": "+temp.id+" with "+socket.id);

            temp.emit('start', 1, rand);
            socket.emit('start', 2, rand);
            console.log(getTime()+rand+" start!");

            var curr = wuziqi.adapter.rooms[rand];
            
            curr.first = temp.id;
            curr.second = socket.id;
            curr.board = [];
            for (var i=0;i<169;i++) curr.board.push(0);
            curr.pos = [];

            return;
        }

        socket.join('waiting');
    }

    socket.on('join', function (id) {
        if (id == 0) {
            wait(socket);
            return;
        }
        var room = wuziqi.adapter.rooms[id];
        if (isset(room) && (room.length >= 2 || isset(room.first) || isset(room.second))) {
            // wuziqi.in(socket.id).emit('error', '房间已满');
            console.log(getTime()+id+" visitor: "+socket.id);
            socket.join(id);
            socket.emit('start', -1, id, room.board.join(""), room.pos);
            wuziqi.in(id).emit('msg', ["目前观战人数："+(room.length-2), 0]);
            return;
        }
        var first = null;
        if (isset(room) && room.length == 1) {
            first = wuziqi.connected[Object.keys(room.sockets)[0]];
        }
        socket.join(id);
        console.log(getTime()+id+" player: "+socket.id);
        if (isset(first)) {
            room = wuziqi.adapter.rooms[id];
            first.emit('start', 1, id);
            socket.emit('start', 2, id);
            console.log(getTime()+id+" start!");
            room.first = first.id;
            room.second = socket.id;
            room.board = [];
            for (var i=0;i<169;i++) room.board.push(0);
            room.pos = [];
        }
    });

    socket.on('ready', function (id) {
        var room = wuziqi.adapter.rooms[id];
        if (!isset(room)) {
            wuziqi.in(id).emit('error', '未知错误');
            return;
        }
        if (!isset(room.count)) room.count = 0;
        room.count++;
        console.log(getTime()+id+" ready: "+socket.id);
        if (room.count == 2) {
            delete room.count;
            wuziqi.in(id).emit('ready');
            room.board = [];
            for (var i=0;i<169;i++) room.board.push(0);
            room.pos = [];
            wuziqi.in(id).emit('board', room.board.join(""), room.pos);
        }
    })

    socket.on('put', function (id, data) {
        console.log(getTime()+id+": "+data);
        wuziqi.in(id).emit('put', data);

        var room = wuziqi.adapter.rooms[id];
        if (!isset(room) || !isset(room.board) || !isset(room.pos)) return;
        var x = data[0], y = data[1];
        room.board[13*x+y] = data[2];
        room.pos = [x,y];
        wuziqi.in(id).emit('board', room.board.join(""), room.pos);
    })

    socket.on('msg', function (id, data) {
        console.log(getTime()+id+": "+data);
        wuziqi.in(id).emit('msg', data);
    })

    socket.on('disconnecting', function () {
        Object.keys(socket.rooms).forEach(function (id) {
            // wuziqi.in(id).emit('error', '对方断开了链接');
            var room = wuziqi.adapter.rooms[id];
            if (id!=socket.id)
                console.log(getTime()+id+" disconnect: "+socket.id);
            if (isset(room) && isset(room.first) && isset(room.second)) {
                if (room.first==socket.id || room.second==socket.id) {
                    wuziqi.in(id).emit('error', '对方断开了连接');
                    return;
                }
                wuziqi.in(id).emit('msg', ["目前观战人数："+(wuziqi.adapter.rooms[id].length-3), 0]);
                return;
            }
            wuziqi.in(id).emit('error', '对方断开了连接');
        });
    })
});


