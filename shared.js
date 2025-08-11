const DELAY = 3000
const GHOST = '\x1b[90m'
const HUNDO = '\x1b[0m'

const colors = [
  '\x1b[38;2;255;102;153m', // #f69
  '\x1b[38;2;255;136;102m', // #f86
  '\x1b[38;2;255;187;102m', // #fb6
  '\x1b[38;2;102;204;153m', // #6c9
  '\x1b[38;2;51;204;255m', // #3cf
  '\x1b[38;2;51;119;255m', // #37f
  '\x1b[38;2;170;102;255m', // #a6f
]

let colorIndex = 0

const log = text => {
  const color = colors[colorIndex]
  colorIndex = (colorIndex + 1) % colors.length
  console.log(`${color}${text}${HUNDO}`)
}

const ghost = text => `${GHOST}${text}${HUNDO}`

function animateProgress(actionName, ghostText = '') {
  const animationChars = ['⚡', '⭐', '💎', '🏈', '🎯', '🔥', '📊', '📈']
  let animationIndex = 0
  let animationCounter = 0
  const startTime = Date.now()
  const color = colors[colorIndex]
  colorIndex = (colorIndex + 1) % colors.length

  const interval = setInterval(() => {
    animationCounter++
    if (animationCounter >= 2) {
      animationIndex = (animationIndex + 1) % animationChars.length
      animationCounter = 0
    }
    const seconds = Math.ceil((Date.now() - startTime) / 1000)
    const animChar = animationChars[animationIndex]
    const message = `${color}${animChar} ${actionName} ${seconds}s${HUNDO}`
    const ghostSuffix = ghostText ? ` ${ghost(ghostText)}` : ''
    process.stdout.write(`\r${message}${ghostSuffix}`)
  }, 100)

  return {
    stop: (success = true, newline = true) => {
      clearInterval(interval)
      const seconds = Math.ceil((Date.now() - startTime) / 1000)
      const icon = success ? '✓' : '✗'
      const pastTense = actionName.replace(/ing$/, 'ed').replace(/e$/, 'ed')
      const suffix = newline ? '\n' : ''
      const ghostSuffix = ghostText ? ` ${ghost(ghostText)}` : ''
      process.stdout.write(
        `\r\x1b[K${color}${icon} ${pastTense} in ${seconds}s${HUNDO}${ghostSuffix}${suffix}`,
      )
    },
  }
}

module.exports = {
  animateProgress,
  colors,
  DELAY,
  ghost,
  GHOST,
  HUNDO,
  log,
}
