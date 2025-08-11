let players = []
let filteredPlayers = []
let rookieNames = new Set()
let colors = {}

// Current filter states
const defaults = { format: 'standard', teams: '12', colors: 'team', size: 'sm', view: 'board' }
const filters = { ...defaults, ...JSON.parse(localStorage.getItem('filters') || '{}') }
let currentFormat = filters.format
let currentTeams = filters.teams
let currentPosition = 'all'
let currentColors = filters.colors
let currentSize = filters.size
let currentView = filters.view

// Load colors
async function loadColors() {
  try {
    const response = await fetch('./colors.json')
    colors = await response.json()
  } catch (error) {
    console.error('Error loading colors:', error)
  }
}

// Load rookies list
async function loadRookies() {
  try {
    const response = await fetch('./data/rookies.json')
    const rookies = await response.json()
    rookieNames = new Set(rookies)
  } catch (error) {
    console.error('Error loading rookies:', error)
  }
}

// Load players data
async function loadPlayers() {
  try {
    const today = new Date().toLocaleDateString('en-CA')
    const response = await fetch(`./data/${today}/players.json`)
    const data = await response.json()
    players = data.players.filter(player => Object.keys(player.formats).length > 0)
    
    // Populate filter options
    populateFilters()
    
    // Apply initial filtering and sorting
    filterAndSortPlayers()
  } catch (error) {
    console.error('Error loading players:', error)
  }
}

// Populate filter buttons
function populateFilters() {
  // Formats (reversed order)
  const formats = [
    { value: 'standard', label: 'Standard' },
    { value: 'half-ppr', label: 'Half PPR' },
    { value: 'ppr', label: 'PPR' },
    { value: '2qb', label: '2QB' }
  ]
  populateFilterGroup('formats', formats)
  
  // Teams (8, 10, 12, 14)
  const teams = ['8', '10', '12', '14']
  populateFilterGroup('teams', teams.map(t => ({ value: t, label: t })))
  
  // Positions - All first, then standard order
  const positionOrder = ['QB', 'RB', 'WR', 'TE', 'PK', 'DEF']
  const positions = new Set()
  players.forEach(player => {
    if (player.position) positions.add(player.position)
  })
  const availablePositions = positionOrder.filter(pos => positions.has(pos))
  const positionList = ['all', ...availablePositions]
  populateFilterGroup('positions', positionList.map(p => ({
    value: p,
    label: p === 'all' ? 'All' : p
  })))
  
  // Colors
  populateFilterGroup('colors', [
    { value: 'team', label: 'Team' },
    { value: 'position', label: 'Position' }
  ])
  
}

function populateFilterGroup(groupId, options) {
  const container = document.getElementById(groupId)
  
  options.forEach(option => {
    const button = document.createElement('button')
    button.textContent = option.label
    button.dataset.value = option.value
    
    // Set active states from current values
    if ((groupId === 'formats' && option.value === currentFormat) ||
        (groupId === 'teams' && option.value === currentTeams) ||
        (groupId === 'positions' && option.value === 'all') ||
        (groupId === 'colors' && option.value === currentColors)) {
      button.classList.add('active')
    }
    
    button.addEventListener('click', () => handleFilterClick(groupId, option.value, button))
    container.appendChild(button)
  })
}

function handleFilterClick(groupId, value, button) {
  // Update active state
  const siblings = button.parentElement.children
  Array.from(siblings).forEach(sibling => sibling.classList.remove('active'))
  button.classList.add('active')
  
  // Update current state and localStorage
  switch (groupId) {
    case 'formats':
      currentFormat = value
      break
    case 'teams':
      currentTeams = value
      break
    case 'positions':
      currentPosition = value
      break
    case 'colors':
      currentColors = value
      break
  }
  
  const filters = { format: currentFormat, teams: currentTeams, colors: currentColors, size: currentSize, view: currentView }
  localStorage.setItem('filters', JSON.stringify(filters))
  
  filterAndSortPlayers()
}

// Filter and sort players
function filterAndSortPlayers() {
  // Filter players
  filteredPlayers = players.filter(player => {
    if (currentPosition !== 'all' && player.position !== currentPosition) return false
    
    // Check if player has the selected format/team combination
    const formatKey = currentFormat === '2qb' ? '2qb' : 
                    currentFormat === 'ppr' ? 'ppr' :
                    currentFormat === 'half-ppr' ? 'half-ppr' : 'standard'
    
    const hasMatchingFormat = Object.keys(player.formats).some(format => {
      return format === `${formatKey}-${currentTeams}` || format === formatKey
    })
    
    return hasMatchingFormat
  })
  
  // Sort by ADP rank
  filteredPlayers.sort((a, b) => {
    const aRank = getBestRank(a)
    const bRank = getBestRank(b)
    return aRank - bRank
  })
  
  renderPlayers()
}

// Get best (lowest) ADP rank for a player
function getBestRank(player) {
  let bestRank = Infinity
  const formatKey = currentFormat === '2qb' ? '2qb' : 
                   currentFormat === 'ppr' ? 'ppr' :
                   currentFormat === 'half-ppr' ? 'half-ppr' : 'standard'
  
  Object.entries(player.formats).forEach(([format, rank]) => {
    if (format === `${formatKey}-${currentTeams}` || format === formatKey) {
      bestRank = Math.min(bestRank, rank)
    }
  })
  
  return bestRank === Infinity ? 999 : bestRank
}

// Group players
function groupPlayers(players) {
  const groups = {}
  
  players.forEach((player, index) => {
    let groupKey
    if (currentGroup === 'position') {
      groupKey = player.position || 'Unknown'
    } else if (currentGroup === 'team') {
      groupKey = player.team || 'Unknown'
    } else if (currentGroup === 'round') {
      const teamSize = parseInt(currentTeams)
      const round = Math.floor(index / teamSize) + 1
      groupKey = `Round ${round}`
    }
    
    if (!groups[groupKey]) groups[groupKey] = []
    groups[groupKey].push(player)
  })
  
  return groups
}

// Render players in current view
function renderPlayers() {
  const container = document.getElementById('players')
  container.className = currentView
  container.innerHTML = ''
  
  if (currentView === 'list') {
    renderTableView(container)
  } else {
    renderBoardView(container)
  }
}

function renderBoardView(container) {
  container.classList.add(`size-${currentSize}`)
  filteredPlayers.forEach(player => {
    const card = createPlayerCard(player)
    container.appendChild(card)
  })
}

function renderTableView(container) {
  // Create headers
  const headers = ['', 'ADP', 'Name', 'Position', 'Team', '2024 Rank']
  headers.forEach((headerText, index) => {
    const header = document.createElement('div')
    header.className = 'list-header'
    header.textContent = headerText
    if (headerText === 'Name') header.style.textAlign = 'left'
    container.appendChild(header)
  })
  
  // Create rows
  filteredPlayers.forEach(player => {
    const row = document.createElement('div')
    row.className = 'list-row'
    
    // Image cell
    if (player.espn_id) {
      const img = document.createElement('img')
      img.alt = player.name
      img.src = `./data/images/${player.espn_id}.png`
      row.appendChild(img)
    } else {
      const placeholder = document.createElement('div')
      row.appendChild(placeholder)
    }
    
    // ADP cell
    const adpCell = document.createElement('div')
    adpCell.textContent = getBestRank(player)
    row.appendChild(adpCell)
    
    // Name cell
    const nameCell = document.createElement('div')
    nameCell.style.textAlign = 'left'
    nameCell.textContent = player.name
    row.appendChild(nameCell)
    
    // Position cell
    const posCell = document.createElement('div')
    posCell.textContent = player.position || ''
    row.appendChild(posCell)
    
    // Team cell
    const teamCell = document.createElement('div')
    teamCell.textContent = player.team || ''
    row.appendChild(teamCell)
    
    // 2024 Rank cell
    const rankCell = document.createElement('div')
    rankCell.textContent = '0'
    row.appendChild(rankCell)
    
    container.appendChild(row)
  })
}

// Create player card element
function createPlayerCard(player) {
  const card = document.createElement('div')
  card.className = 'player-card'
  
  // Set CSS variable for color
  const colorValue = currentColors === 'team' ? 
    colors.teams[player.team] : 
    colors.positions[player.position]
  
  if (colorValue) {
    card.style.setProperty('--card-color', colorValue)
  }
  
  // Add img tag if available
  if (player.espn_id) {
    const img = document.createElement('img')
    img.alt = player.name
    img.src = `./data/images/${player.espn_id}.png`
    card.appendChild(img)
  }
  
  // Add rank badge
  const rank = document.createElement('div')
  rank.className = 'player-rank'
  rank.textContent = getBestRank(player)
  card.appendChild(rank)
  
  const info = document.createElement('div')
  info.className = 'player-info'
  info.style.position = 'relative'
  
  // Add rookie badge above name
  if (rookieNames.has(player.name)) {
    const badge = document.createElement('div')
    badge.className = 'rookie-badge'
    badge.textContent = 'ROOKIE'
    info.appendChild(badge)
  }
  
  const name = document.createElement('div')
  name.className = 'player-name'
  name.textContent = player.name
  info.appendChild(name)
  
  // Position and team without field names
  if (player.position || player.team) {
    const meta = document.createElement('div')
    meta.className = 'player-meta'
    const parts = []
    if (player.position) parts.push(player.position)
    if (player.team) parts.push(player.team)
    meta.textContent = parts.join(' • ')
    info.appendChild(meta)
  }
  
  card.appendChild(info)
  return card
}

// Set up view toggle
function initViewToggle() {
  const boardBtn = document.getElementById('board-view')
  const listBtn = document.getElementById('list-view')
  
  boardBtn.addEventListener('click', () => {
    if (currentView !== 'board') {
      currentView = 'board'
      boardBtn.classList.add('active')
      listBtn.classList.remove('active')
      renderPlayers()
    }
  })
  
  listBtn.addEventListener('click', () => {
    if (currentView !== 'list') {
      currentView = 'list'
      listBtn.classList.add('active')
      boardBtn.classList.remove('active')
      renderPlayers()
    }
  })
}

// Set up size toggle
function initSizeToggle() {
  const sizeButtons = document.querySelectorAll('#sizes button')
  
  sizeButtons.forEach(button => {
    button.addEventListener('click', () => {
      sizeButtons.forEach(btn => btn.classList.remove('active'))
      button.classList.add('active')
      currentSize = button.dataset.value
      if (currentView === 'board') {
        renderPlayers()
      }
    })
  })
}

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
  await loadColors()
  await loadRookies()
  initViewToggle()
  initSizeToggle()
  await loadPlayers()
})