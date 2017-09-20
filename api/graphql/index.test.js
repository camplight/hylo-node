import { createRequestHandler } from './index'
import '../../test/setup'
import factories from '../../test/setup/factories'
import { sortBy } from 'lodash/fp'
import { updateNetworkMemberships } from '../models/post/util'

describe('graphql request handler', () => {
  var handler, req, res, user, user2, community, network, post, comment, media

  before(() => {
    handler = createRequestHandler()

    user = factories.user()
    user2 = factories.user()
    community = factories.community()
    network = factories.network()
    post = factories.post()
    comment = factories.comment()
    media = factories.media()
    return network.save()
    .then(() => community.save({network_id: network.id}))
    .then(() => user.save())
    .then(() => user2.save())
    .then(() => post.save({user_id: user.id}))
    .then(() => comment.save({post_id: post.id}))
    .then(() => media.save({comment_id: comment.id}))
    .then(() => Promise.all([
      community.posts().attach(post),
      community.users().attach({
        user_id: user.id,
        active: true,
        created_at: new Date(new Date().getTime() - 86400000)}),
      community.users().attach({user_id: user2.id, active: true})
    ]))
    .then(() => updateNetworkMemberships(post))
  })

  beforeEach(() => {
    req = factories.mock.request()
    req.method = 'POST'
    req.session = {userId: user.id}
    res = factories.mock.response()
  })

  describe('with a simple query', () => {
    beforeEach(() => {
      req.body = {
        query: `{
          me {
            name
            memberships {
              community {
                name
              }
            }
            posts {
              title
              communities {
                name
              }
            }
          }
        }`
      }
    })

    it('responds as expected', () => {
      return handler(req, res).then(() => {
        expectJSON(res, {
          data: {
            me: {
              name: user.get('name'),
              memberships: [
                {
                  community: {
                    name: community.get('name')
                  }
                }
              ],
              posts: [
                {
                  title: post.get('name'),
                  communities: [
                    {
                      name: community.get('name')
                    }
                  ]
                }
              ]
            }
          }
        })
      })
    })
  })

  describe('with a complex query', () => {
    var thread, message

    before(() => {
      thread = factories.post({type: Post.Type.THREAD})

      return thread.save()
      .then(() => {
        message = factories.comment({post_id: thread.id, user_id: user2.id})
        return Promise.all([
          comment.save({user_id: user2.id}),
          message.save(),
          post.followers().attach(user2),
          thread.followers().attach(user)
        ])
        .then(() => thread.followers().attach(user2))
      })
    })

    beforeEach(() => {
      req.body = {
        query: `{
          me {
            name
            memberships {
              community {
                name
              }
            }
            posts {
              title
              communities {
                name
              }
              comments {
                items {
                  text
                  creator {
                    name
                  }
                }
              }
              followers {
                name
              }
              followersTotal
            }
            messageThreads {
              total
              hasMore
              items {
                id
                messages {
                  items {
                    text
                    creator {
                      name
                    }
                  }
                }
                participants {
                  name
                }
                participantsTotal
              }
            }
          }
        }`
      }
    })

    it('responds as expected', () => {
      return handler(req, res).then(() => {
        expectJSON(res, {
          data: {
            me: {
              name: user.get('name'),
              memberships: [
                {
                  community: {
                    name: community.get('name')
                  }
                }
              ],
              posts: [
                {
                  title: post.get('name'),
                  communities: [
                    {
                      name: community.get('name')
                    }
                  ],
                  comments: {
                    items: [
                      {
                        text: comment.get('text'),
                        creator: {
                          name: user2.get('name')
                        }
                      }
                    ]
                  },
                  followers: [
                    {
                      name: user2.get('name')
                    }
                  ],
                  followersTotal: 1
                }
              ],
              messageThreads: {
                hasMore: false,
                total: 1,
                items: [
                  {
                    id: thread.id,
                    messages: {
                      items: [
                        {
                          text: message.get('text'),
                          creator: {
                            name: user2.get('name')
                          }
                        }
                      ]
                    },
                    participants: [
                      {
                        name: user.get('name')
                      },
                      {
                        name: user2.get('name')
                      }
                    ],
                    participantsTotal: 2
                  }
                ]
              }
            }
          }
        })
      })
    })
  })

  describe('querying Comment attachments', () => {
    beforeEach(() => {
      req.body = {
        query: `{
          post (id: ${post.id}) {
            comments {
              items {
                text
                attachments {
                  id
                  type
                  position
                  url
                }
              }
            }
          }
        }`
      }
    })

    it('responds as expected', () => {
      return handler(req, res).then(() => {
        expectJSON(res, {
          data: {
            post: {
              comments: {
                items: [
                  {
                    text: comment.get('text'),
                    attachments: [
                      {
                        id: media.id,
                        type: media.get('type'),
                        position: media.get('position'),
                        url: media.get('url')
                      }
                    ]
                  }
                ]
              }
            }
          }
        })
      })
    })
  })

  describe('without a logged-in user', () => {
    beforeEach(() => {
      req.session = {}
    })

    it('shows "not logged in" errors for most queries', () => {
      req.body = {
        query: `{
          me {
            name
          }
          community(id: 9) {
            name
          }
        }`
      }

      return handler(req, res).then(() => {
        expectJSON(res, {
          data: {
            me: null,
            community: null
          },
          errors: [
            {
              locations: [
                {column: 11, line: 2}
              ],
              message: 'not logged in',
              path: ['me']
            },
            {
              locations: [
                {column: 11, line: 5}
              ],
              message: 'not logged in',
              path: ['community']
            }
          ]
        })
      })
    })

    it('allows checkInvitation', () => {
      req.body = {
        query: `{
          checkInvitation(invitationToken: "foo") {
            valid
          }
        }`
      }
      return handler(req, res).then(() => {
        expectJSON(res, {
          data: {
            checkInvitation: {
              valid: false
            }
          }
        })
      })
    })
  })

  describe('querying community data', () => {
    it('works as expected', () => {
      req.body = {
        query: `{
          community(id: "${community.id}") {
            slug
            members(first: 2, sortBy: "join") {
              items {
                name
              }
            }
            posts(first: 1) {
              items {
                title
              }
            }
          }
        }`
      }

      return handler(req, res).then(() => {
        expectJSON(res, {
          data: {
            community: {
              slug: community.get('slug'),
              members: {
                items: [
                  {name: user2.get('name')},
                  {name: user.get('name')}
                ]
              },
              posts: {
                items: [
                  {title: post.get('name')}
                ]
              }
            }
          }
        })
      })
    })

    describe('with an invalid sort option', () => {
      it('shows an error', () => {
        req.body = {
          query: `{
            community(id: "${community.id}") {
              members(first: 2, sortBy: "height") {
                items {
                  name
                }
              }
            }
          }`
        }

        return handler(req, res).then(() => {
          expectJSON(res, {
            data: {
              community: {
                members: null
              }
            },
            errors: [
              {
                locations: [
                  {column: 15, line: 3}
                ],
                message: 'Cannot sort by "height"',
                path: ['community', 'members']
              }
            ]
          })
        })
      })
    })
  })

  describe('querying network data', () => {
    it('works as expected', () => {
      req.body = {
        query: `{
          network(id: "${network.id}") {
            slug
            members(first: 2, sortBy: "name") {
              items {
                name
              }
            }
            posts(first: 1) {
              items {
                title
              }
            }
          }
        }`
      }

      return handler(req, res).then(() => {
        expectJSON(res, {
          data: {
            network: {
              slug: network.get('slug'),
              members: {
                items: sortBy('name', [
                  {name: user2.get('name')},
                  {name: user.get('name')}
                ])
              },
              posts: {
                items: [
                  {title: post.get('name')}
                ]
              }
            }
          }
        })
      })
    })
  })

  describe('search', () => {
    beforeEach(() => {
      return FullTextSearch.dropView().catch(() => {})
      .then(() => FullTextSearch.createView())
    })

    it('works', () => {
      req.body = {
        query: `{
          search(term: "${post.get('name').substring(0, 4)}") {
            items {
              content {
                __typename
                ... on Post {
                  title
                }
              }
            }
          }
        }`
      }

      return handler(req, res).then(() => {
        expectJSON(res, {
          data: {
            search: {
              items: [
                {
                  content: {
                    __typename: 'Post',
                    title: post.get('name')
                  }
                }
              ]
            }
          }
        })
      })
    })
  })
})

function expectJSON (res, expected) {
  expect(res.body).to.exist
  return expect(JSON.parse(res.body)).to.deep.equal(expected)
}
