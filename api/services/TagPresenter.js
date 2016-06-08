import { filter, includes, map, merge, find } from 'lodash'

export const fetchAndPresentTagJoins = (joinClass, communityId, userId) =>
  joinClass.where({community_id: communityId, user_id: userId})
  .fetchAll({withRelated: 'tag'})
  .then(joins =>
    joins.map(join => ({
      name: join.relations.tag.get('name'),
      new_post_count: join.get('new_post_count')
    })))

export const fetchAndPresentFollowed = (communityId, userId) =>
  fetchAndPresentTagJoins(TagFollow, communityId, userId)

export const fetchAndPresentCreated = (communityId, userId) =>
  fetchAndPresentTagJoins(CommunityTag, communityId, userId)

export const withRelatedSpecialPost = {
  withRelated: [
    {posts: q => {
      q.where('posts_tags.selected', true)
      q.where('post.type', 'in', ['event', 'project'])
    }}
  ]
}

export const presentWithPost = tag => {
  const post = tag.relations.posts.first()
  return {
    id: tag.id,
    name: tag.get('name'),
    post: post ? {id: post.id} : null
  }
}

export const fetchAndPresentForLeftNav = (communityId, userId) =>
  Promise.join(
    fetchAndPresentFollowed(communityId, userId),
    fetchAndPresentCreated(communityId, userId),
    (followed, created) => ({
      followed: filter(followed, f => !includes(map(created, 'name'), f.name)),
      created: map(created, c =>
        includes(map(followed, 'name'), c.name)
        ? merge(c, {new_post_count: find(followed, f => f.name === c.name).new_post_count})
        : c)
    }))

const mostActiveMembers = (community, tag) => {
  return User.query(q => {
    q.select(bookshelf.knex.raw('users.name, users.id, users.avatar_url, count(*)'))
    q.join('post', 'post.user_id', '=', 'users.id')
    q.join('posts_tags', 'posts_tags.post_id', '=', 'post.id')
    q.where('tag_id', '=', tag.id)
    q.groupBy('users.id')
    q.orderBy('count', 'desc')
    q.limit(3)
  })
  .fetchAll()
  .then(users => Promise.map(users.models, user => ({
    id: user.id,
    name: user.get('name'),
    avatar_url: user.get('avatar_url'),
    post_count: user.get('count')
  })))
}

export const fetchAndPresentForPopover = (community, tag) =>
  Promise.join(
    CommunityTag.where({community_id: community.id, tag_id: tag.id})
    .fetch(),
    TagFollow.where({community_id: community.id, tag_id: tag.id})
    .fetchAll(),
    Search.forPosts({
      communities: [community.id],
      tag: tag.id
    }).fetchAll(),
    mostActiveMembers(community, tag),
    (communityTag, tagFollows, posts, activeMembers) => ({
      description: communityTag.get('description'),
      follower_count: tagFollows.length,
      post_count: posts.length > 0 ? posts.first().get('total') : 0,
      active_members: activeMembers
    }))
