const $ = require('../assets/functions')

class Helper {
  constructor(message, defaults = {}) {
    this.server = this.player = defaults
    this.message = message
    this.log = content => {
      $.log(content, message)
    }
    this.send = async (text, timeout = null) => {
      let m = await message.channel.send(text)

      if (timeout) {
        m.delete({ timeout }).catch(() => {})
      }

      return m
    }
  }
}

module.exports = Helper
