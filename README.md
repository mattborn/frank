# Fantasy Football Data Compilation

## Data Sources

### Fantasy Football Calculator
- API defaults to current year and position=all
- Uses proprietary mock draft data, not consensus/composite like FantasyPros

### Other Sources (Documentation Only)
- FantasyData.com and SportsData.io require API keys for production use

## Player Images
- ESPN IDs sourced from [mayscopeland/ffb_ids](https://github.com/mayscopeland/ffb_ids) for active 2025 fantasy rosters
- Sleeper API tested but missing too many ESPN IDs for complete coverage
- Run `node ids` to download/update player ID mappings

## Rookies
- Generate rookies file:
```bash
jq '[.[] | select(.metadata and .metadata.rookie_year == "0") | .full_name] | sort' ./data/YYYY-MM-DD/api.sleeper.app-players.json > ./data/rookies.json
```

## Notes
- Player name normalization preserves hyphens, periods, and spaces (e.g., "Amon-Ra St. Brown")