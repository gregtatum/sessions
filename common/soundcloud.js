const SoundcloudBadge = require('soundcloud-badge')

module.exports = function setupSoundcloud (url) {
  return new Promise(function (resolve) {
    SoundcloudBadge({
      client_id: '6057c9af862bf245d4c402179e317f52',
      song: url,
      dark: false,
      getFonts: false
    }, function (err, src, data, div) {
      if (err) {
        console.error(err)
        return
      }
      var audio = new window.Audio()
      audio.crossOrigin = 'Anonymous'
      audio.src = src
      audio.loop = true
      audio.addEventListener('canplay', () => {
        audio.play()
        resolve()
      })
    })
  })
}
