var format = require('util').format
var Promise = require('bluebird')
var ZeroPush = require('nzero-push')
var rollbar = require('rollbar')

module.exports = bookshelf.Model.extend({
  tableName: 'push_notifications',

  send: function (options) {
    if (process.env.NODE_ENV === 'test') return

    var zeroPushToken = this.zeroPushTokenFromPlatform()
    var zeroPush = new ZeroPush(zeroPushToken)
    var notify = Promise.promisify(zeroPush.notify, zeroPush)
    var deviceTokens = [this.get('device_token')]
    var platform = this.getPlatform()
    var notification = this.notificationForZP()

    this.set('time_sent', (new Date()).toISOString())
    return this.save({}, options)
      .then(pn => notify(platform, deviceTokens, notification))
      .catch(e => rollbar.handleErrorWithPayloadData(e, {custom: {server_token: process.env.ZEROPUSH_PROD_TOKEN, device_token: deviceTokens}}))
  },

  notificationForZP: function () {
    var notification
    if (this.getPlatform() === 'ios_macos') {
      notification = {
        alert: this.get('alert'),
        info: {path: this.get('path')},
        badge: this.get('badge_no')
      }
      return notification
    } else {
      var data = {alert: this.get('alert'), path: this.get('path')}
      notification = {
        data: data
      }
      return notification
    }
  },

  getPlatform: function () {
    var platform = this.get('platform')
    if (platform) {
      return platform
    } else {
      return 'ios_macos'
    }
  },

  zeroPushTokenFromPlatform: function () {
    if (this.getPlatform() === 'ios_macos') {
      return process.env.ZEROPUSH_PROD_TOKEN
    } else {
      return process.env.ZEROPUSH_PROD_TOKEN_ANDROID
    }
  }

}, {
  textForComment: function (comment, version, userId) {
    var post = comment.relations.post
    var commenter = comment.relations.user
    var postName, relatedUser

    if (version === 'mention') {
      return commenter.get('name') + ' mentioned you in a comment'
    }

    if (post.isWelcome()) {
      relatedUser = post.relations.relatedUsers.first()
      if (relatedUser.id === userId) {
        postName = 'your welcome post'
      } else {
        postName = format("%s's welcome post", relatedUser.get('name'))
      }
    } else {
      postName = format('"%s"', post.get('name'))
    }
    return format('%s commented on %s', commenter.get('name'), postName)
  },

  textForNewPost: function (post, community, userId) {
    var relatedUser
    var creator = post.relations.creator

    if (post.isWelcome()) {
      relatedUser = post.relations.relatedUsers.first()
      if (relatedUser.id === userId) {
        return format('You joined %s!', community.get('name'))
      } else {
        return format('%s joined %s', relatedUser.get('name'), community.get('name'))
      }
    } else {
      return format('%s posted "%s" in %s', creator.get('name'), post.get('name'), community.get('name'))
    }
  }

})
