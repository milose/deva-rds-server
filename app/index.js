'use strict';

exports.start = function(express, port, io) {
    var app = express();
    var df = require('dateformat');

    app.set('port', (port || 5000));

    app.use(express.static(__dirname + '/public'));

    // views is directory for all template files
    app.set('views', __dirname + '/views');
    app.set('view engine', 'ejs');

    var sessions = getSessions(io);

    app.get('/', function(request, response) {
        var data = {
            io: io,
            sockets: io.sockets.sockets,
            df: df,
        };

        // console.log(require('util').inspect(io.engine.clients, {depth:null}))

        response.render('pages/index', data);
    });

    app.listen(app.get('port'), function() {
        console.log('Front-end server is running on port', app.get('port'));
    });
}

function getSessions(io) {
    var sockets = io.sockets.sockets;
    var sessions = [];

    Object.keys(sockets).forEach(function(key, index) {
        Console.log(key, index);
    });

    for (var prop in sockets) {
        console.log(prop, sockets[prop].nsp.username);

        sessions.push({
            socket: prop,
            name: sockets[prop].username || '(none)',
            connected: sockets[prop].connected,
            rooms: sockets[prop].rooms,
            time: sockets[prop].handshake.time,
            address: sockets[prop].handshake.address,
        });
    }

    return sessions;
}
