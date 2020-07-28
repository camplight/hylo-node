
exports.up = function(knex, Promise) {
  return knex.schema.createTable('saved_searches', table => {
    table.increments().primary()

    table.bigInteger('user_id').references('id').inTable('users').notNullable()
    table.string('name')
    table.bigInteger('community_id').references('id').inTable('communities')
    table.bigInteger('network_id').references('id').inTable('networks')
    table.boolean('is_public')
    table.boolean('active').defaultTo(true)
    table.string('search_text')
    table.specificType('post_types', 'character varying(255)[]')
    table.specificType('bounding_box', 'geometry(polygon, 4326)')
    table.bigInteger('last_post_id').references('id').inTable('posts')

    table.timestamp('created_at')
    table.timestamp('updated_at')
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTable('saved_searches')
}