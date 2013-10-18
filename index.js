var concat = require('concat-stream')
var debug = require('debug')('test-app')
var marked = require('marked')
var models = require('./models')
var mongoose = require('mongoose')
var path = require('path')
var sanitize = require('validator').sanitize
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

  // POST APIs
  // ---------

  function escapeTrim (str) {
    return sanitize(sanitize(str).escape()).trim()
  }

  // Upload a picture
  // Requires auth
  // Returns all metadata associated with the pic after it's saved
  // Possible errors:
  //  * Internal error (Mongo)
  // TODO: Actually upload photos
  app.post('/pics/upload', self.auth, function (req, res) {

    var title = escapeTrim(req.body.title || '')
    var caption = escapeTrim(req.body.caption || '')

    var pic = new models.Pic({
      title: title,
      caption: caption,
      user: req.user
    })

    pic.save(function (err, pic) {
      if (err) {
        res.send(500, {code: 'INTERNAL_ERROR'})
      } else {
        res.send(200, pic.toJSON())
      }
    })
  })

  function findLike (picId, req, res, cb) {
    models.Pic.findById(picId, function (err, pic) {
      var idCastError = err &&
                        (err.name === 'CastError') &&
                        (err.type === 'ObjectId')

      if (pic === null || idCastError) {
        res.send(500, {code: 'ID_NOT_FOUND', detail: 'Pic ID not found'})
      } else if (err) {
        res.send(500, {code: 'INTERNAL_ERROR'})
      } else {
        models.Like.findOne({user: req.user, pic: pic}, function (err, like) {
          if (err) {
           res.send(500, {code: 'INTERNAL_ERROR'})
           return
          } else {
            cb(like, pic)
          }
        })
      }
    })
  }

  app.post('/pics/:id/like', self.auth, function (req, res) {
    var picId = req.params.id
    findLike (picId, req, res, function (like, pic) {
      if (like === null) {

        // Create a new like
        var like = new models.Like({
          user: req.user,
          pic: pic
        })

        like.save(function (err, like) {
          if (err) {
            d(err)
           res.send(500, {code: 'INTERNAL_ERROR'})
          } else {

            // Update numLikes for the pic
            // Handle pic not found error (race condition if someone deleted the pic)
            models.Pic.findByIdAndUpdate(pic._id, {$inc: {numLikes: 1}}, function (err, pic) {
              var output = pic.toJSON()
              if (err) {
                d(err)
                res.send(500, {code: 'INTERNAL_ERROR'})
              } else {
                res.send(200, output)
              }
            })
          }
        })

      } else {
        res.send(200, pic.toJSON())
      }
    })
  })

  app.post('/pics/:id/unlike', self.auth, function (req, res) {
    var picId = req.params.id
    findLike (picId, req, res, function (like, pic) {
      if (like === null) {
        res.send(200, pic.toJSON())
      } else {
        // Delete the like
        like.remove(function (err) {
          if (err) {
            d(err)
            res.send(500, {code: 'INTERNAL_ERROR'})
          } else {

            // Update numLikes for the pic
            models.Pic.findByIdAndUpdate(pic._id, {$inc: {numLikes: -1}}, function (err, pic) {
              var output = pic.toJSON()
              if (err) {
                d(err)
                res.send(500, {code: 'INTERNAL_ERROR'})
              } else {
                res.send(200, output)
              }
            })
          }
        })
      }
    })
  })
}

exports.App = App

/* Start the app */
if (require.main === module) {
  new App(function(){}, {})
}