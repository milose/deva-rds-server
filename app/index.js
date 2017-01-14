'use strict'

const path = require('path')

exports.start = function (express, port, io, previous) {
  var app = express()
  var df = require('dateformat')

  app.set('port', (port || 5000))

  app.use(express.static(path.join(__dirname, 'public')))

    // views is directory for all template files
  app.set('views', path.join(__dirname, 'views'))
  app.set('view engine', 'ejs')

  app.get('/', function (request, response) {
    var data = {
      io: io,
      sockets: io.sockets.sockets,
      df: df,
      previous
    }

        // console.log(require('util').inspect(io.engine.clients, {depth:null}))

    response.render('pages/index', data)
  })

  app.listen(app.get('port'), function () {
    console.log('Front-end server is running on port', app.get('port'))
  })
}
