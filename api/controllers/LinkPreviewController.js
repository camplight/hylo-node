/* globals LinkPreview */

module.exports = {
  findOne: (req, res) => {
    const url = req.param('url')

    return LinkPreview.find(url).then(preview => {
      if (!preview) {
        return LinkPreview.queue(url)
        .then(() => res.ok({status: 'queued'}))
      }

      if (!preview.get('done')) {
        return res.ok({status: 'loading'})
      }

      return res.ok(preview.pick('image_url', 'title', 'description'))
    })
  }
}