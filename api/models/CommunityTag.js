module.exports = bookshelf.Model.extend({
  tableName: 'communities_tags',

  owner: function () {
    return this.belongsTo(User, 'owner_id')
  },

  community: function () {
    return this.belongsTo(Community)
  },

  tag: function () {
    return this.belongsTo(Tag)
  }

})