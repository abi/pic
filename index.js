var concat = require('concat-stream')
var debug = require('debug')('test-app')
var marked = require('marked')
var models = require('./models')
var mongoose = require('mongoose')
var path = require('path')
var SimpleApp = require('./lib/SimpleApp')
var timeago = require('timeago')
var _ = require('underscore')

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

  app.get('/new', self.auth, function (req, res) {
    res.render('new')
  })

  app.post('/photos/upload', self.auth, function (req, res) {
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

  // app.post('/edit', self.auth, function (req, res) {
  //   var id = req.body.id
  //   models.Post.findById(id, function (err, post) {
  //     if (post === null || post.user.toString() !== req.user.id) {
  //       console.error(new Error('Post #' + id + ' could not found.'))
  //       res.render('error', {error: 'That post could not be found. Did you delete it perhaps?'})
  //     } else if (err) {
  //       console.error(err)
  //       res.render('error', {error: 'Oops, something bad happening. We\' looking into it. Sorry!'})
  //     } else {
  //       res.render('edit', {post: post})
  //     }
  //   })
  // })
  //

  // API to get a single image information
  app.get('/photos/:id', function (req, res) {

  })

  // Blog page
  app.get('/photos/:id', function (req, res) {
    var username = req.params.username
    models.User.findOne({username: username}, function (err, blogger) {
      if (blogger === null) {
        res.render('404')
      } else if (err) {
        res.send(500, {error: err})
      } else {
        models.Post
          .find({user: blogger})
          .sort('-created').limit(10)
          .exec(function (err, posts) {
          res.render('blog', {posts: posts,
                              blogger: blogger,
                              isBlogger: req.user ? (req.user.id === blogger.id) : false})
        })
      }
    })
  })
}

exports.App = App

/* Start the app */
if (require.main === module) {
  new App()
}