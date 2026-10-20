// 从高德地铁图拉取最新线路与站点，更新 datasource/data.json
// 用法: node scripts/update-data.mjs [--dry-run]
// 设置 AMAP_KEY（高德 Web 服务 Key）后会同时拉取线路真实走向；否则复用旧数据或用站点连线兜底
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const DATA_FILE = fileURLToPath(new URL('../datasource/data.json', import.meta.url))
const SUBWAY_API = 'https://map.amap.com/service/subway?srhdata='
const LINE_API = 'https://restapi.amap.com/v3/bus/lineid'
const AMAP_KEY = process.env.AMAP_KEY
const DRY_RUN = process.argv.includes('--dry-run')

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function getJSON(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      if (!res.ok)
        throw new Error(`HTTP ${res.status}`)
      return await res.json()
    }
    catch (err) {
      if (attempt >= 3)
        throw new Error(`${url}: ${err.message}`)
      await sleep(1000 * attempt)
    }
  }
}

function shortCityName(name) {
  return name.replace(/(土家族苗族自治州|特别行政区|市)$/, '')
}

function parseCoord(sl) {
  const [lng, lat] = sl.split(',').map(Number)
  return { lat, lng }
}

async function fetchRealPolyline(lineId) {
  const url = `${LINE_API}?id=${lineId}&extensions=all&output=json&key=${AMAP_KEY}`
  const res = await getJSON(url)
  if (res.status !== '1')
    throw new Error(`高德 Web 服务返回错误: ${res.info}`)
  const polyline = res.buslines?.[0]?.polyline
  await sleep(200)
  return polyline ? polyline.split(';').map(p => p.split(',').map(Number)) : null
}

// 高德会改换乘站的 id，按站名比较
function sameStations(a, b) {
  const names = new Set(a.map(s => s.name))
  return a.length === b.length && b.every(s => names.has(s.name))
}

async function buildLine(raw, oldLine, stats) {
  const stations = raw.st
    .filter(s => s.su === '1')
    .map(s => ({ id: s.sid, name: s.n, ...parseCoord(s.sl) }))

  const line = { id: raw.ls, name: raw.ln, color: raw.cl, stations, polyline: [], fullPolyline: [] }

  if (AMAP_KEY) {
    const real = await fetchRealPolyline(raw.ls)
    if (real) {
      line.fullPolyline = real
      stats.real++
      return line
    }
  }

  if (oldLine && sameStations(oldLine.stations, stations)) {
    line.polyline = oldLine.polyline
    line.fullPolyline = oldLine.fullPolyline
    stats.reused++
    return line
  }

  // 没有真实走向时，按站点顺序连线（环线首尾相接）
  line.fullPolyline = stations.map(s => [s.lng, s.lat])
  if (raw.lo === '1' && stations.length)
    line.fullPolyline.push([stations[0].lng, stations[0].lat])
  stats.straight.push(`${raw.ln}`)
  return line
}

async function main() {
  const oldData = JSON.parse(await readFile(DATA_FILE, 'utf8'))
  const oldCities = new Map(oldData.map(c => [c.id, c]))
  const { citylist } = await getJSON(`${SUBWAY_API}citylist.json`)

  const cities = []
  const report = []
  for (const meta of citylist) {
    const raw = await getJSON(`${SUBWAY_API}${meta.adcode}_drw_${meta.spell}.json`)
    await sleep(300)

    const oldCity = oldCities.get(meta.adcode)
    const oldLines = new Map((oldCity?.lines ?? []).map(l => [l.id, l]))
    const stats = { real: 0, reused: 0, straight: [] }
    const lines = []
    for (const rawLine of raw.l.filter(l => l.su === '1'))
      lines.push(await buildLine(rawLine, oldLines.get(rawLine.ls), stats))

    const city = { id: meta.adcode, name: oldCity?.name ?? shortCityName(meta.cityname), cityname: meta.spell, lines }
    cities.push(city)

    const added = lines.filter(l => !oldLines.has(l.id)).map(l => l.name)
    const removed = [...oldLines.values()].filter(l => !lines.some(n => n.id === l.id)).map(l => l.name)
    const changed = lines
      .filter(l => oldLines.has(l.id) && !sameStations(oldLines.get(l.id).stations, l.stations))
      .map(l => `${l.name}(${oldLines.get(l.id).stations.length}→${l.stations.length}站)`)
    report.push({ city: city.name, isNew: !oldCity, added, removed, changed, straight: stats.straight })
  }

  // 保持原有城市顺序，新城市排在后面
  const order = oldData.map(c => c.id)
  cities.sort((a, b) => {
    const ia = order.indexOf(a.id)
    const ib = order.indexOf(b.id)
    return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib)
  })

  for (const r of report) {
    const parts = []
    if (r.isNew)
      parts.push('新城市')
    if (r.added.length)
      parts.push(`新增: ${r.added.join('、')}`)
    if (r.changed.length)
      parts.push(`站点变化: ${r.changed.join('、')}`)
    if (r.removed.length)
      parts.push(`移除: ${r.removed.join('、')}`)
    if (r.straight.length)
      parts.push(`走向为站点连线: ${r.straight.join('、')}`)
    if (parts.length)
      console.log(`${r.city}  ${parts.join(' | ')}`)
  }
  const lineCount = cities.reduce((n, c) => n + c.lines.length, 0)
  console.log(`\n共 ${cities.length} 个城市、${lineCount} 条线路（原 ${oldData.length} 个城市）`)

  if (!DRY_RUN) {
    await writeFile(DATA_FILE, `${JSON.stringify(cities, null, 2)}\n`)
    console.log(`已写入 ${DATA_FILE}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
