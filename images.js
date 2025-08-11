#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { animateProgress, ghost, log } = require('./shared')

// Fetch image from URL and save to file
async function downloadImage(url, filePath) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const buffer = await response.arrayBuffer()
  fs.writeFileSync(filePath, Buffer.from(buffer))
}

// Ensure directory exists
function ensureDir(filePath) {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

async function main() {
  const today = new Date().toLocaleDateString('en-CA')
  const playersPath = `./data/${today}/players.json`
  const imagesDir = `./data/images`
  
  if (!fs.existsSync(playersPath)) {
    console.error('Players file not found. Run frank.js first.')
    process.exit(1)
  }
  
  const data = JSON.parse(fs.readFileSync(playersPath, 'utf-8'))
  const playersWithImages = data.players.filter(player => player.espn_id)
  
  log(`📷 Downloading ${playersWithImages.length} player images...`)
  
  let downloaded = 0
  let skipped = 0
  
  for (const player of playersWithImages) {
    const imageUrl = `https://a.espncdn.com/i/headshots/nfl/players/full/${player.espn_id}.png`
    const imagePath = `${imagesDir}/${player.espn_id}.png`
    
    if (fs.existsSync(imagePath)) {
      console.log(ghost(`Skip ${player.name}`))
      skipped++
    } else {
      const animation = animateProgress('Downloading', player.name)
      try {
        ensureDir(imagePath)
        await downloadImage(imageUrl, imagePath)
        animation.stop()
        console.log(ghost(`Save ${imagePath}`))
        downloaded++
      } catch (err) {
        animation.stop(false)
        console.error(ghost(`Error downloading ${player.name}: ${err.message}`))
      }
    }
  }
  
  log(`✓ Images complete: ${downloaded} downloaded, ${skipped} skipped`)
}

main().catch(console.error)