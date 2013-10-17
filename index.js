var concat = require('concat-stream')
var debug = require('debug')('test-app')
var marked = require('marked')
var models = require('./models')
var mongoose = require('mongoose')
var path = require('path')
var SimpleApp = require('./lib/SimpleApp')
var timeago = require('timeago')
var _ = require('underscore')

function d (msg) {
  console.log(msg)
}

function App (cb, opts_) {
  var self = this

  self.cb = cb

  var opts = {
    name: 'Pic',
    port: 9999,
    csrf: true,
    dbPath: path.join(__dirname, './app-db'),
    cookieSecret: 'secret'
  }

  _(opts).extend(opts_)

  // Call the parent constructor
  SimpleApp.call(self, opts, self.init.bind(self))
}
App.prototype = Object.create(SimpleApp.prototype)

/* Setup app-specific routes and middleware */
App.prototype.init = function () {
  var self = this
  var app = self.app

  self.cb && self.cb()

  app.locals.timeago = function (ts) {
    return timeago(new Date(ts))
  }

  app.locals.markdown = function (str) {
    return marked(str)
  }

  // API
  // ========

  var PICS_PER_PAGE = 20

  // Get most recent pics
  // Params
  //  * page: page number
  // Possible errors:
  //  * Internal error (when could this happen?)
  app.get('/pics/new', function (req, res) {
    var page = req.query.page || 1

    models.Pic
      .find({})
      .skip((page - 1) * PICS_PER_PAGE)
      .sort('-created').limit(PICS_PER_PAGE)
      .exec(function (err, pics) {
        if (err) {
          d(error)
          res.send(500, {code: 'INTERNAL_ERROR'})
        } else {
          res.send(200, {pics: pics, page: page})
        }
    })
  })

  // Get most popular pics
  // Params
  //  * page: page number
  // Possible errors:
  //  * Internal error (when could this happen?)
  //  For now, it's the same as /pics/new
  app.get('/pics/popular', function (req, res) {
    var page = req.query.page || 1

    models.Pic
      .find({})
      .skip((page - 1) * PICS_PER_PAGE)
      .sort('-created').limit(PICS_PER_PAGE)
      .exec(function (err, pics) {
        if (err) {
          d(error)
          res.send(500, {code: 'INTERNAL_ERROR'})
        } else {
          res.send(200, {pics: pics, page: page})
        }
    })
  })

  // Get most pics posted by a particular user
  // Params
  //  * page: page number
  // Possible errors:
  //  * Internal error (when could this happen?)
  //  * User not found
  app.get('/pics/user/:id', function (req, res) {
    var page = req.query.page || 1
    var userId = req.params.id

    models.User.findById(userId, function (err, user) {
      var idCastError = err &&
                        (err.name === 'CastError') &&
                        (err.type === 'ObjectId')

      if (user === null || idCastError) {
        res.send(500, {code: 'ID_NOT_FOUND', detail: 'User ID not found'})
      } else if (err) {
        d(err)
        res.send(500, {code: 'INTERNAL_ERROR'})
      } else {
        models.Pic
          .find({user: user})
          .skip((page - 1) * PICS_PER_PAGE)
          .sort('-created').limit(PICS_PER_PAGE)
          .exec(function (err, pics) {
            if (err) {
              d(err)
              res.send(500, {code: 'INTERNAL_ERROR'})
            } else {
              res.send(200, {pics: pics, page: page})
            }
        })
      }
    })
  })

  // Get a pic by its id.
  // Returns all metadata associated with that pic
  // Possible errors:
  //  * ID does not exist
  //  * Internal error
  app.get('/pics/:id', function (req, res) {
    models.Pic.findById(req.params.id, function (err, pic) {
      var idCastError = err &&
                        (err.name === 'CastError') &&
                        (err.type === 'ObjectId')

      if (pic === null || idCastError) {
        res.send(500, {code: 'ID_NOT_FOUND', detail: 'Pic ID not found'})
      } else if (err) {
        d(err)
        res.send(500, {code: 'INTERNAL_ERROR'})
      } else {
        res.send(200, pic.toJSON())
      }
    })
  })

  app.post('/pics/upload', self.auth, function (req, res) {
    var pic = new models.Pic({
      title: req.body.title,
      caption: req.body.caption,
      user: req.user
    })

    pic.save(function (err, pic) {
      if (err) {
        next(err)
      } else {
        res.send(200, pic.toJSON())
      }
    })
  })

}

exports.App = App

/* Start the app */
if (require.main === module) {
  new App(function(){}, {})
}