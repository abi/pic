var md5 = require('MD5')
var mongoose = require('mongoose')

var User = mongoose.Schema({
  created: { type: Date, default: Date.now },
  name: String,
  username: { type: String, index: true },
  email: String,
  password: String
})

User.virtual('firstName').get(function () {
  return this.name.split(' ')[0]
})

User.virtual('gravatarUrl').get(function() {
  var hash = md5(this.email.trim().toLowerCase())
  return '//www.gravatar.com/avatar/' + hash + '?size=32&default=blank'
})

var Pic = mongoose.Schema({
  created: { type: Date, default: Date.now },
  title: { type: String, default: ''},
  caption: String,
  user: {type: mongoose.Schema.Types.ObjectId, required: true, index: true},
  numLikes: { type: Number, default: 0 },
})

var Like = mongoose.Schema({
  created: { type: Date, default: Date.now },
  user: {type: mongoose.Schema.Types.ObjectId, required: true, index: true},
  pic: {type: mongoose.Schema.Types.ObjectId, required: true, index: true}
})

exports.User = mongoose.model('User', User)
exports.Pic = mongoose.model('Pic', Pic)
exports.Like = mongoose.model('Like', Like)