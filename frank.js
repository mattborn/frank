#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { animateProgress, colors, DELAY, ghost, log } = require('./shared')

// Parse arguments
const args = process.argv.slice(2)
const includeTeams = args.includes('-teams')
const limitIndex = args.indexOf('-limit')
const limit = limitIndex !== -1 && args[limitIndex + 1] ? parseInt(args[limitIndex + 1]) : null
const verbose = args.includes('-verbose')

// Load source configuration
const config = JSON.parse(fs.readFileSync('./sources.json', 'utf-8'))
const sources = limit ? config.sources.slice(0, limit) : config.sources

// Fetch JSON from URL
async function fetchJSON(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

// Ensure directory exists
function ensureDir(filePath) {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

// Check if file exists
function fileExists(filePath) {
  return fs.existsSync(filePath)
}

// Write JSON to file
function writeJSON(filePath, data) {
  ensureDir(filePath)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
}

// Read JSON from file
function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

// Normalize player name for matching
function normalizePlayerName(name) {
  return name.trim().replace(/\s+/g, ' ')
}

// Process players from data source
function processPlayers(data, source, format, includeTeams, playerMatrix) {
  const players = data.players || []
  
  players.forEach(player => {
    const key = normalizePlayerName(player.name)
    const existing = playerMatrix.get(key) || { 
      formats: {},
      name: key
    }
    
    // Extract all fields from config
    source.fields.forEach(field => {
      const value = player[field]
      if (value && !existing[field]) {
        existing[field] = value
      }
    })
    
    // Initialize format if needed
    const formatKey = includeTeams ? `${format.name}-${existing.team}` : format.name
    if (!existing.formats[formatKey]) existing.formats[formatKey] = {}
    
    // Store raw data temporarily - will be processed later
    const domain = new URL(source.baseUrl).hostname
    existing.formats[formatKey][domain] = {
      adp: player.adp,
      adp_formatted: player.adp_formatted,
      high: player.high,
      low: player.low,
      stdev: player.stdev,
      times_drafted: player.times_drafted
    }
    
    playerMatrix.set(key, existing)
  })
  
  return { total: players.length, processed: players.length }
}

async function main() {
  let playerMatrix = new Map()
  let sourceIndex = 0
  let totalPlayers = 0
  let totalReads = 0
  let totalRequests = 0

  // Process each source
  for (const source of sources) {
    sourceIndex++
    let sourceReads = 0
    let sourceRequests = 0
    
    if (source.skip) {
      log(`Skipping source ${sourceIndex} of ${config.sources.length} → ${source.name}`)
      continue
    }
    
    log(`📡 Compiling source ${sourceIndex} of ${config.sources.length} → ${source.name}`)
    console.log(ghost(`  ${source.baseUrl}`))
    console.log()

    // Process each format (defaults to current year and position=all)
    for (const format of source.formats || []) {
      // Use default teams [8, 10, 12, 14] unless overridden
      const teams = format.teams || [8, 10, 12, 14]
      
      // Process each team size
      for (const team of teams) {
        const url = `${source.baseUrl}/${format.name}?teams=${team}`
        const domain = new URL(source.baseUrl).hostname
        const today = new Date().toLocaleDateString('en-CA')
        const fileName = `./data/${today}/${domain}-${format.name}-${team}.json`
        
        // Check if we already have today's data
        if (fileExists(fileName)) {
          console.log(ghost(`Read ${fileName}`))
          const data = readJSON(fileName)
          
          const { total, processed } = processPlayers(data, source, format, includeTeams, playerMatrix)
          totalPlayers += total
          
          totalReads++
          sourceReads++
        } else {
          const animation = animateProgress(`Fetching`, url)
          
          try {
            const data = await fetchJSON(url)
            animation.stop()
            
            // Write to file
            writeJSON(fileName, data)
            console.log(ghost(`Write ${fileName}`))
            
            const { total, processed } = processPlayers(data, source, format, includeTeams, playerMatrix)
            totalPlayers += total
            
            totalRequests++
            sourceRequests++
          } catch (err) {
            animation.stop(false)
            console.error(ghost(`Error: ${err.message}`))
          }
        }
      }
    }

    log(
      `✓ ${source.name} complete ${ghost(`(${sourceReads} reads, ${sourceRequests} requests)`)}`,
    )
    console.log()
  }

  // Load player IDs and map ESPN IDs
  if (fileExists('./data/player_ids.json')) {
    const playerIds = readJSON('./data/player_ids.json')
    const espnMap = new Map()
    
    playerIds.forEach(player => {
      if (player.espn_name && player.espn_id && player.espn_id !== 'NULL') {
        espnMap.set(normalizePlayerName(player.espn_name), player.espn_id)
      }
    })
    
    // Add ESPN IDs to players
    let espnMatches = 0
    playerMatrix.forEach(player => {
      const espnId = espnMap.get(player.name)
      if (espnId && !player.espn_id) {
        player.espn_id = espnId
        espnMatches++
      }
    })
    
    log(`✓ Mapped ${espnMatches} ESPN IDs from external source`)
  }

  // Process rankings for each format
  log('📊 Calculating format rankings...')
  
  // Get all unique format keys
  const allFormats = new Set()
  playerMatrix.forEach(player => {
    Object.keys(player.formats).forEach(format => allFormats.add(format))
  })

  // Calculate rankings for each format
  allFormats.forEach(formatKey => {
    // Get all players for this format with their ADP
    const playersWithADP = Array.from(playerMatrix.values())
      .filter(player => player.formats[formatKey])
      .map(player => {
        // Get the lowest ADP across all sources for this format
        const sources = player.formats[formatKey]
        const adps = Object.values(sources).map(data => data.adp)
        const bestADP = Math.min(...adps)
        
        return { player, bestADP }
      })
    
    // Sort by ADP (lower is better)
    playersWithADP.sort((a, b) => a.bestADP - b.bestADP)
    
    // Assign sequential rankings
    playersWithADP.forEach(({ player }, index) => {
      const ranking = index + 1
      
      // Update player data based on verbose mode  
      if (!verbose) {
        // Replace with clean ranking only
        player.formats[formatKey] = ranking
      }
      // In verbose mode, keep all source data as-is
      // Rankings can be calculated on-the-fly from ADP
    })
  })

  // Build matrix
  log('🔨 Building player matrix...')

  const matrixAnimation = animateProgress(
    'Normalizing names',
    `${playerMatrix.size} unique players`,
  )
  await new Promise(r => setTimeout(r, 1000))
  matrixAnimation.stop()

  const mergeAnimation = animateProgress(
    'Merging data',
    `${totalRequests + totalReads} datasets`,
  )
  await new Promise(r => setTimeout(r, 1000))
  mergeAnimation.stop()

  // Write final matrix
  const today = new Date().toLocaleDateString('en-CA')
  const matrixPath = `./data/${today}/players.json`
  const matrixData = {
    date: today,
    sources: sources.length,
    totalPlayers: playerMatrix.size,
    players: Array.from(playerMatrix.values()).map(player => {
      // Sort object keys alphabetically
      const sorted = {}
      Object.keys(player).sort().forEach(key => {
        sorted[key] = player[key]
      })
      return sorted
    })
  }
  writeJSON(matrixPath, matrixData)

  // Summary
  console.log()
  log('📊 Compilation Complete:')
  console.log(`  ${ghost('• API requests:')} ${totalRequests}`)
  console.log(`  ${ghost('• Cache reads:')} ${totalReads}`)
  console.log(`  ${ghost('• Data sources:')} ${sources.length}`)
  console.log(`  ${ghost('• Player records:')} ${totalPlayers.toLocaleString()}`)
  console.log(`  ${ghost('• Unique players:')} ${playerMatrix.size}`)
  console.log()
  
  log(`✓ Matrix ready ${ghost(`→ ${matrixPath}`)}`)
}

main().catch(console.error)