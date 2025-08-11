#!/usr/bin/env node

const fs = require('fs')
const { animateProgress, ghost, log } = require('./shared')

// Fetch CSV data and convert to JSON
async function fetchCSV(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const text = await response.text()
  
  const lines = text.trim().split('\n')
  const headers = lines[0].split(',')
  
  return lines.slice(1).map(line => {
    const values = line.split(',')
    const obj = {}
    headers.forEach((header, i) => {
      obj[header.trim()] = values[i]?.trim() || null
    })
    return obj
  })
}

// Write JSON to file
function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
}

async function main() {
  const filePath = './data/player_ids.json'
  
  if (fs.existsSync(filePath)) {
    log('✓ Player IDs already cached')
    return
  }
  
  log('🆔 Downloading player ID mappings...')
  
  const animation = animateProgress('Fetching', 'player_ids.csv')
  try {
    const playerIds = await fetchCSV('https://raw.githubusercontent.com/mayscopeland/ffb_ids/refs/heads/main/player_ids.csv')
    animation.stop()
    
    writeJSON(filePath, playerIds)
    console.log(ghost(`Write ${filePath}`))
    log(`✓ Cached ${playerIds.length} player ID mappings`)
  } catch (err) {
    animation.stop(false)
    console.error(`Error: ${err.message}`)
  }
}

main().catch(console.error)