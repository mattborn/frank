#!/usr/bin/env node

const fs = require('fs')
const {
  animateProgress,
  colors,
  DELAY,
  ghost,
  GHOST,
  HUNDO,
  log,
} = require('./shared')

// Load source configuration
const limit = parseInt(process.argv[3])
const config = JSON.parse(fs.readFileSync('./sources.json', 'utf-8'))
const sources = limit ? config.sources.slice(0, limit) : config.sources

async function main() {
  let sourceIndex = 0
  let totalPlayers = 0
  let totalReads = 0
  let totalRequests = 0

  // Process each source
  for (const source of sources) {
    sourceIndex++
    let sourceReads = 0
    let sourceRequests = 0

    log(
      `📡 Compiling source ${sourceIndex} of ${config.sources.length} → ${source.name}`,
    )
    console.log(ghost(`  ${source.baseUrl}`))
    console.log()

    // Process each format (defaults to current year and position=all)
    for (const format of source.formats) {
      // Use default teams [8, 10, 12, 14] unless overridden
      const teams = format.teams || [8, 10, 12, 14]

      // Process each team size
      for (const team of teams) {
        const url = `/${format.name}?teams=${team}`
        const domain = new URL(source.baseUrl).hostname
        const today = new Date().toLocaleDateString('en-CA')
        const fileName = `./data/${today}/${domain}-${format.name}-${team}.json`

        // Check if we already have today's data
        const cacheExists = Math.random() > 0.5 // Simulate 50% cache hit

        if (cacheExists) {
          console.log(ghost(`Read ${fileName}`))
          const players = 150 + Math.floor(Math.random() * 100)
          totalPlayers += players
          totalReads++
          sourceReads++
        } else {
          const animation = animateProgress(`Fetching`, url)
          await new Promise(r => setTimeout(r, DELAY))
          animation.stop()

          const players = 150 + Math.floor(Math.random() * 100)
          totalPlayers += players
          totalRequests++
          sourceRequests++

          console.log(ghost(`Write ${fileName}`))
        }
      }
    }

    log(
      `✓ ${source.name} complete ${ghost(
        `(${sourceReads} reads, ${sourceRequests} requests)`,
      )}`,
    )
    console.log()
  }

  // Build matrix
  log('🔨 Building player matrix...')

  const matrixAnimation = animateProgress(
    'Normalizing names',
    'Amon-Ra St. Brown format',
  )
  await new Promise(r => setTimeout(r, DELAY))
  matrixAnimation.stop()

  const mergeAnimation = animateProgress(
    'Merging data',
    `${totalRequests} datasets`,
  )
  await new Promise(r => setTimeout(r, DELAY))
  mergeAnimation.stop()

  // Summary
  console.log()
  log('📊 Compilation Complete:')
  console.log(`${ghost('• API requests:')} ${totalRequests}`)
  console.log(`${ghost('• Cache reads:')} ${totalReads}`)
  console.log(`${ghost('• Data sources:')} ${sources.length}`)
  console.log(`${ghost('• Player records:')} ${totalPlayers.toLocaleString()}`)
  console.log(`${ghost('• Unique players:')} 712`)
  console.log()

  const today = new Date().toLocaleDateString('en-CA')
  log(`✓ Matrix ready ${ghost(`→ ./data/${today}/players.json`)}`)
}

main().catch(console.error)
