const Store = require('electron-store')

module.exports = new Store({
  name: 'cp-settings',
  defaults: {
    llmProvider: 'openai',
    llmModel: 'gpt-4o-mini',
    theme: 'light'
  }
})
