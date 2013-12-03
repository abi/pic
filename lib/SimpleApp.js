module.exports = SimpleApp

var bcrypt = require('bcrypt')
var config = require('../config')
var debug = require('debug')('simple-app')
var express = require('express')
var expressValidator = require('express-validator')
var flash = require('connect-flash')
var fs = require('fs')
var http = require('http')
var jade = require('jade')
var mongoose = require('mongoose')
var MongoStore = require('connect-mongo')(express)
var passport = require('passport')
var passport_local = require('passport-local')
var path = require('path')
var User = require('../models').User
var util = require('./util')

function SimpleApp (opts, cb) {

  var self = this

  /**
   * @type {string}
   */
  self.name = (opts && opts.name) || 'SimpleApp'

  /**
   * @type {number}
   */
  self.port = opts && opts.port

  self.opts = opts

  /**
   * @type {string}
   */
  self.cookieSecret = (opts && opts.cookieSecret) || 'notsecret'

  self.start(cb)
}

SimpleApp.prototype.start = function (cb) {
  var self = this

  // Connect to the MongoDB
  mongoose.set('debug', true)
  mongoose.connect('mongodb://' + config.mongo.host + ':' +
    config.mongo.port + '/' + (self.opts.database || config.mongo.database), {
      server: { poolSize: 20 }
  })
  mongoose.connection.on('error', function (err) {
    console.error('Mongoose connection error')
    console.error(err)
  })
  mongoose.connection.on('open', function () {
    debug('Opened mongoose connection')
  })

  // Set up the HTTP server.
  var app = express()
  self.app = app
  self.server = http.createServer(app)

  app.disable('x-powered-by') // disable advertising
  app.use(util.expressLogger(debug)) // readable logs
  app.use(express.compress()) // gzip
  app.use(expressValidator()) // validate user input
  app.use(express.bodyParser()) // parse POST parameters
  app.use(express.cookieParser(self.cookieSecret)) // parse cookies
  app.use(express.session({
    proxy: true, // trust the reverse proxy
    secret: self.cookieSecret, // prevent cookie tampering
    store: new MongoStore({
      db: (self.opts.database || config.mongo.database),
      host: config.mongo.host,
      port: config.mongo.port
    })
  }))

  if (self.opts.csrf) {
    app.use(express.csrf()) // protect against CSRF
  }

  app.use(passport.initialize()) // use passport for user auth
  app.use(passport.session()) // have passport use cookies for user auth
  app.use(flash()) // errors during login are propogated by passport using `req.flash`

  // Use jade for templating
  app.set('views', path.join(config.rootPath, '/static/views'))
  app.set('view engine', 'jade')

  // CSRF helper
  if (self.opts.csrf) {
    app.use(function (req, res, next) {
      res.locals.token = req.session._csrf
      next()
    })
  }

  // Setup passport
  passport.serializeUser(function (user, done) {
    done(null, user.username)
  })

  passport.deserializeUser(function (username, done) {
    User.findOne({username: username}, function (err, user) {
      if (user === null) {
        done(null, null)
      } else {
        done(err, user)
      }
    })
  })

  passport.use(new passport_local.Strategy(
    function (username, password, done) {
      User.findOne({username: username}, function (err, user) {
        if (user === null) {
          done(null, false, {message: 'Username not found' })
        } else if (err) {
          done(err)
        } else {
          bcrypt.compare(password, user.password, function (err, res) {
            if (res) {
              done(null, user)
            } else {
              done(null, false, { message: 'Wrong password' })
            }
          })
        }
      })
    }
  ))

  self.auth = function auth (req, res, next) {
    if (req.isAuthenticated()) {
      return next()
    }
    res.redirect('/login')
  }

  // Always set the `user` variable in the context of the templates
  // If no user is logged in, then it's `null`.
  app.use(function (req, res, next) {
    res.locals.user = req.user
    next()
  })

  // Routes

  app.get('/login', function (req, res) {
    if (req.user) {
      res.redirect('/')
    } else {
      res.render('login', {messages: req.flash('error')})
    }
  })

  app.post('/login', passport.authenticate('local', {
    failureRedirect: '/login',
    successRedirect: '/',
    failureFlash: true
  }))

  app.post('/logout', function (req, res) {
    req.logout()
    res.redirect('/')
  })

  app.get('/signup', function (req, res) {
    if (req.user) {
      res.redirect('/')
    } else {
      res.render('signup', {messages: req.flash('error')})
    }
  })

  app.post('/signup', function (req, res, next) {

    req.assert('name', 'Name must be greater than 2 characters').len(2).notEmpty()
    req.assert('username', 'Username must be greater than 2 characters').len(2).notEmpty()
    req.assert('email', 'Invalid email').isEmail().notEmpty()
    req.assert('password', 'Password must be greater than 4 characters').len(4).notEmpty()

    var errors = req.validationErrors()
    if (errors) {
      errors.forEach(function (error) {
        req.flash('error', error.msg)
      })
      res.redirect('/signup')
      return
    }

    var username = req.body.username

    User.findOne({username : username}, function (err, user) {
      if (user === null) {
        // Hash the password and store it
        bcrypt.hash(req.body.password, 8, function (err, hash) {
          var user = new User({
            name: req.body.name,
            username: username,
            email: req.body.email,
            password: hash
          })

          user.save(function (err, user) {
            if (err) {
              next(err)
            } else {
              req.login(user, function (err) {
                if (err) { return next(err) }
                return res.redirect('/')
              })
            }
          })
        })
      } else if (err) {
        req.flash('error', err.name + ': ' + err.message)
        res.redirect('/signup')
      } else {
        req.flash('error', 'Username is already signed up.')
        res.redirect('/signup')
      }
    })

  })

  app.get('/', function (req, res) {
    res.render('index')
  })

  // Static files
  app.use(express.static(path.join(config.rootPath, 'static')))
  app.use('/components', express.static(path.join(config.rootPath, 'components')))

  // Call the callback so the subclass can implement its own routes
  // and add middleware or static files
  cb && cb()

  app.use(express.errorHandler())

  self.server.listen(self.port, function (err) {
    if (!err) {
      debug(self.name + ' started on port ' + self.port)
    } else {
      throw new Error(err)
    }
  })
}


SimpleApp.prototype.close = function (done) {
  var self = this

  self.server.close(function (err) {
    if (!err) debug(self.name + ' closed on port ' + self.port)
    done && done(err)
  })
}