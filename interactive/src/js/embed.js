import iframeMessenger from 'guardian/iframe-messenger'
import results from '../renderer/results_parsed.json!json'
import * as d3 from './lib/d3'
import { roundPathCorners } from './lib/roundPathCorners'
import athletesList from '../renderer/athletesList.json!json'

let illuOffsets = [0.65, 0.35, 0.85, 0.85,0.7,0.85,0.85]
let horOffsets = [0, -0.15, 0.25, 0, 0, 0, 0]

let showTotal = true

Array.prototype.flatMap = function (lambda) {
    return Array.prototype.concat.apply([], this.map(lambda))
}

Array.prototype.uniqueWith = function (lambda) {
    return this.filter((e1, i) => {
        return this.findIndex(e2 => lambda(e1, e2)) === i
    })
}

Array.prototype.sortBy = function (lambda) {
    return this.slice().sort( (a, b) => lambda(a) > lambda(b) ? 1 : -1 )
}

Array.prototype.immutableReverse = function () {
    return this.slice().reverse()
}

let formatDiff = (d, arr) => {
    if(d){
        let diff = d - Math.min(...arr.filter(d => d))
        return diff > 0 ? `${d}s (+${diff.toFixed(2)})` : `${d}s`
    }
    return ''
}

let justSecs = (d) => {
    return (d % 60).toFixed(2)
}

let currentId = null

let windowWidth = window.innerWidth

let disciplines = [
    {
        'name' : '100m hurdles',
        'resMapper' : d => d,
        'format' : formatDiff,
        'reverseScale' : true
    },{
        'name' : 'High jump',
        'resMapper' : d => d,
        'format' : d => d ? d + 'm' : '' 
    },{
        'name' : 'Shot put',
        'resMapper' : d => d,
        'format' : d => d ? d + 'm' : ''
    },{
        'name' : '200m run',
        'resMapper' : d => d,
        'format' : formatDiff,
        'reverseScale' : true
    },{
        'name' : 'Long jump',
        'resMapper' : d => d,
        'format' : d => d ? d + 'm' : ''
    },{
        'name' : 'Javelin throw',
        'resMapper' : d => d,
        'format' : d => d ? d + 'm' : ''
    },{
        'name' : '800m run',
        'resMapper' : (r) => {
            if(r) {
                let [mins, secs] = r.split(':')
                return parseInt(mins)*60 + parseFloat(secs)
            }
            return undefined
        },
        'format' : (d, arr) => {

            if(d) {
                let [mins, secs] = d.split(':')
                let total = parseInt(mins)*60 + parseFloat(secs)
                let min = Math.min(...arr.filter(d => d).map(d => {
                    let [mins, secs] = d.split(':')
                    return parseInt(mins)*60 + parseFloat(secs)
                }))

                let diff = total - min
                return diff > 0 ? `${d} (+${ justSecs(diff) })` : d
            }
            return ''
        },
        'reverseScale' : true
    }
]

if(!showTotal) {
    disciplines = disciplines.slice(1)
}

let dNum = disciplines.length

function $(el, s) {
    if (!s) { s = el; el = document; }
    return el.querySelector(s);
}

function $$(el, s) {
    if (!s) { s = el; el = document; }
    return [].slice.apply(el.querySelectorAll(s));
}


let illuWidth = null

let drawIllus = (height, path, el) => {
    illuOffsets.forEach((offset, i) => {
        let img = document.createElement('img')
        img.setAttribute('src', `${path}/heptathlon-0${i+1}.svg`)
        img.setAttribute('class', 'hepta-illu')

        let topOffset = disciplines.length === 8 ? height : 0

        img.style.top = margin + (i+0.5)*height + topOffset - offset*illuWidth + 'px'
        img.style.left = horOffsets[i]*illuWidth + 'px'
        img.style.width = illuWidth + 'px'
        img.style.height = illuWidth + 'px'
        el.appendChild(img)
    })
}

let cubicEasing = t => {
    return x => {
        let a = -2/(t*t*t)
        let b = 3/(t*t)
        let d = 1
        return a*x*x*x + b*x*x + d
    }
}

let anims = {}

let start = null

let r = 5

let medalIds = [athletesList[0]._id] // highlight just the gold medal

let easeInOut = null

let margin = 16

let circles = null
let labels = null
let titles = null

function grow(circles, _id, ts) {

    if(!anims[_id]) {
        anims[_id] = { 'grow' : ts }
    } else if (!anims[_id].grow) {
        anims[_id].grow = ts
    }

    let progress = ts - anims[_id].grow

    if(progress < 150) {
        circles.forEach(c => c.setAttribute('r', r*easeInOut(progress)))
        window.requestAnimationFrame(ts => {
            grow(circles, _id, ts)
        })
    } else {
        circles.forEach(c => c.setAttribute('r', r*easeInOut(150)))
        delete anims[_id].grow
    }
}

function shrink(circles, _id, ts) {

    if(!anims[_id]) {
        anims[_id] = { 'shrink' : ts }
    } else if(!anims[_id].shrink) {
        anims[_id].shrink = ts
    }
    let progress = ts - anims[_id].shrink
    if(progress < 150) {
        circles.forEach(c => c.setAttribute('r', r/easeInOut(progress)*2))
        window.requestAnimationFrame(ts => {
            shrink(circles, _id, ts)
        })
    } else {
        circles.forEach(c => c.setAttribute('r', r/easeInOut(150)*2))
        delete anims[_id].shrink
    }
}

let highlight = (_id, redrawn) => {

    if(_id !== currentId || redrawn ){
        if(currentId !== null){
            unhighlight(currentId)
        }

        currentId = _id
        let athlete = athletesList.find(a => a._id === _id)

        $('.hepta-select').selectedIndex = athletesList.findIndex(a => a._id === _id)

        $('.hepta-select').className = athlete.medal ?
            `hepta-select hepta-select--${athlete.medal}` : 'hepta-select'

        $(`.hepta-tr[data-id="${_id}"]`).classList.add('hepta-hl')

        $(`.hepta-line[data-id="${_id}"]`).classList.remove('hepta-hidden')

        $$(`.hepta-discipline`).forEach(d => {
            d3.select(d).selectAll('.hepta-result-group')
            .sort((a, b) => {

                let cmp = [_id].indexOf(a.e.identifier) - [_id].indexOf(b.e.identifier)

                return cmp !== 0 ?
                    cmp :
                    ['bronze', 'silver', 'gold'].indexOf(a.e.medal) - ['bronze', 'silver', 'gold'].indexOf(b.e.medal)
            })

        })

        let circles = $$(`.hepta-result-group[data-id="${_id}"] circle`)
        let labels = $$(`.hepta-result-group[data-id="${_id}"] text`)

        let rank = athlete.rank ? athlete.rank + '.' : ''

        window.requestAnimationFrame(ts => {
            grow(circles, _id, ts)
        })

        circles.forEach(c => {
            c.classList.add('hepta-hl')
        })
        labels.forEach(l => {
            l.classList.remove('hepta-hidden')
        })
    }
}

let unhighlight = (_id) => {

    $(`.hepta-tr[data-id="${_id}"]`).classList.remove('hepta-hl')
    $(`.hepta-line[data-id="${_id}"`).classList.add('hepta-hidden')
    let circles = $$(`.hepta-result-group[data-id="${_id}"] circle`)
    let labels = $$(`.hepta-result-group[data-id="${_id}"] text`)

    window.requestAnimationFrame(ts => {
        shrink(circles, _id, ts)
    })
    circles.forEach(c => {
        c.classList.remove('hepta-hl')
    })
    labels.forEach(l => {
        l.classList.add('hepta-hidden')
    })
}

let highlightMedals = () => {
    medalIds.forEach( _id => {
        highlight(_id, true)
    })
}

let drawDiscipline = (discipline, width, height, offset, svg) => {

    let nodeGroup = svg.append('g')
        .attr('class', discipline.total ? 'hepta-discipline hepta-discipline--total' : 'hepta-discipline')

    nodeGroup
        .append('line')
        .attr('x1', margin)
        .attr('x2', width - margin)
        .attr('y1', offset + height/2)
        .attr('y2', offset + height/2)
        .attr('class', 'hepta-axis')

    let extent = d3.extent(discipline.data.map(r => discipline.resMapper(r.pr.value)))
    let range = discipline.reverseScale ? [width-margin, margin+illuWidth] : [margin+illuWidth, width-margin] 

    let yScale = d3.scaleLinear()
        .domain(extent)
        .range(range)

    console.log(nodeGroup.node())

    let groups = nodeGroup.selectAll('.hepta-result-group')
        .data(discipline.data)
        .enter()
        .append('g')
        .attr('class', discipline.total ? 'hepta-result-group hepta-result-group--total' : 'hepta-result-group')
        .attr('data-id', d => d.e.identifier)
        .attr('data-finished', d => d.pr.value)

    let circles = groups
        .append('circle')
        .attr('class', 'hepta-result')
        .attr('class', d => {
            let clazz = 'hepta-result'

            if(!d.pr.value) {
                clazz += ' hepta-hidden'
            }
            if(d.e.medal) {
                clazz += ` hepta-medal--${d.e.medal}`
            }
            return clazz
        })
        .attr('cx', d => {
            let cx = d.pr.value ? yScale(discipline.resMapper(d.pr.value)) : 0
            return cx
        })
        .attr('cy', offset + height/2)
        .attr('r', 4)
        .attr('data-id', d => d.e.identifier)

    groups
        .append('text')
        .attr('class', 'hepta-result-label hepta-hidden')
        .text( (d) => {

            if(discipline.total){
                return `${d.e.name} (${d.e.country})`
            }
            return discipline.format(d.pr.value, discipline.data.map(d => d.pr.value))
        })
        .attr('x', d => {

            let labelOffset = yScale(discipline.resMapper(d.pr.value)) > width/2 ? -8 : 8

            let x = d.pr.value ? yScale(discipline.resMapper(d.pr.value)) + labelOffset : 0
            return x
        })

        .attr('text-anchor', d => {
            return yScale(discipline.resMapper(d.pr.value)) > width/2 ? 'end' : 'start'
        })

        .attr('y', offset + height/2 + 32)

    nodeGroup.append('text')
        .text(discipline.name)
        .attr('y', offset + height/2 - 8)
        .attr('x', 15)
        .attr('class', 'hepta-discipline-title')

}

let drawLines = (width, height, lineGroup, svg) => {

    let lineGen = d3.line()
        .x(d => d.x)
        .y(d => d.y)
        .defined(d => d.finished)

    let groups = athletesList.map(a => a._id).map(identifier => {
        return svg.selectAll(`.hepta-result-group[data-id="${identifier}"]`).nodes()
            .filter(n => !n.classList.contains('hepta-result-group--total'))
            .map(n => {
                return {
                    _id : n.getAttribute('data-id'),
                    finished : n.getAttribute('data-finished'),
                    x : n.querySelector('circle').getAttribute('cx'),
                    y : n.querySelector('circle').getAttribute('cy')
                }
            })

    })

    let nodes =
        groups.map(group => {
            return group
                    .flatMap((node, i, arr) => {
                        if(arr[i+1]){
                            let nextNode = arr[i+1]
                            return [
                                node,
                                {
                                    x : node.x ,
                                    y : parseFloat(node.y) + height/2,
                                    _id : node._id,
                                    finished : node.finished && nextNode.finished
                                },
                                {
                                    x : nextNode.x ,
                                    y : parseFloat(node.y) + height/2,
                                    _id : node._id,
                                    finished : node.finished
                                }
                            ]
                        }
                        return node
                    })
        })

    lineGroup.selectAll('.hepta-line')
        .data(nodes)
        .enter()
        .append('path')
        .attr('d', d => {
            return roundPathCorners(lineGen(d).replace(/([A-Za-z])/g, ' $1 ').replace(/,/g, ' ').slice(1), 20)
        })
        .attr('data-id', d => d[0]._id)
        .attr('class', 'hepta-line hepta-hidden')

}

let drawVoronoi = (width, height, svg) => {
    let voronoi = d3.voronoi()
        .extent([[0, 0], [width, height*dNum]])
        .x(d => d.x)
        .y(d => d.y)

    let voronoiNodes = svg.selectAll('.hepta-result-group').nodes()
        .filter(g => g.getAttribute('data-finished'))
        .map(node => {

            let m = node.querySelector('circle').classList.toString().match(/medal--(.*)/)
            m = m ? m[1] : null

            return {
                x : parseFloat(node.querySelector('circle').getAttribute('cx')),
                y : parseFloat(node.querySelector('circle').getAttribute('cy')),
                _id : node.getAttribute('data-id'),
                medal : m
            }
        })
        .sortBy(
            n => ['bronze', 'silver', 'gold'].indexOf(n.medal)
        )
        .immutableReverse()
        .uniqueWith((a,b) => {
            return a.x === b.x && a.y === b.y
        })

    let polys = voronoi(voronoiNodes).polygons()

    svg.selectAll('.hepta-voronoi')
        .data(polys)
        .enter()
        .append('path')
        .attr('d', (d, i) => {
            return "M" + d.join("L") + "Z";
        })
        .attr('class', 'hepta-voronoi')
        .attr('data-id', d => d.data._id)
}

let drawViz = (width, height, svg) => {

    let lineGroup = svg
        .selectAll('.hepta-lines')
        .data([width])
        .enter()
        .append('g')
        .attr('class', 'hepta-lines')

    if(disciplines.length === 8) {
        svg.append('rect')
            .attr('class', 'hepta-total-background')
            .attr('x', margin)
            .attr('y', margin)
            .attr('width', width)
            .attr('height', height)
    }

    disciplines.forEach((d, i) => {
        d.data = disciplines.length === 8 ? results[i] : results[i+1]
        drawDiscipline(d, width, height, margin + height*i, svg)
     })
    drawLines(width, height, lineGroup, svg)
    drawVoronoi(width, height, svg)

}

window.init = function init(el, config) {

    iframeMessenger.enableAutoResize();

    let topDiv = document.createElement('div')
    topDiv.classList.add('hepta-top')

    let athleteName = document.createElement('h2')
    athleteName.classList.add('hepta-athlete-name')

    let select = $('.hepta-select')
    let tbody = $('.hepta-tbody')

    athletesList.forEach(a => {

        // table (desktop)

        let tr = document.createElement('tr')
        tr.className = a.medal ? `hepta-tr hepta-tr--${a.medal}` : 'hepta-tr'
        tr.setAttribute('data-id', a._id)
        let rank = document.createElement('td')
        rank.className = 'hepta-td hepta-td--rank'
        let name = document.createElement('td')
        name.className = 'hepta-td hepta-td--athlete'
        let score = document.createElement('td')
        score.className = 'hepta-td hepta-td--score'
        score.innerHTML = a.score ? a.score : '-'

        rank.innerHTML = a.medal ? 
            `<span class='hepta-table-medal hepta-medal--${a.medal}'></span>`:
            (a.rank ? a.rank + '.' : 'DNF')
        name.innerHTML = `${a.name} (${a.country})`
        tr.appendChild(rank)
        tr.appendChild(name)
        tr.appendChild(score)
        tr.addEventListener('mouseenter', function(e) {
            highlight(a._id)
        })
        tbody.appendChild(tr)

        //select (mobile)

        let o = document.createElement('option')
        o.setAttribute('value', a._id)
        o.className = a.medal ? `hepta-option hepta-option--${a.medal}` : 'hepta-option'
        o.innerHTML = a.rank ? a.rank + '. ' + `${a.name} (${a.country})` : `${a.name} (${a.country})`
        select.appendChild(o)
    })

    select.addEventListener('change', () => {
        highlight(select.value)
    })

    let vizDiv = $('.hepta-viz-container')
    window.addEventListener('resize', () => {

        let curWidth = window.innerWidth
        if(Math.abs(curWidth-windowWidth) > 50) {
            windowWidth = curWidth
            $('.hepta-viz-container').innerHTML = ''
            drawEverything(vizDiv, config)
            highlightMedals()
        }
    })
    window.addEventListener('load', () => {
        drawEverything(vizDiv, config)
        highlightMedals()
    })
};

let drawEverything = (vizDiv, config) => {

    let svg = d3.select(vizDiv)
        .append('svg')
        .attr('class', 'hepta-svg')

    let overallHeight = 700
    let width = parseFloat(window.getComputedStyle($('.hepta-svg')).width)
    illuWidth = windowWidth < 740 ? 80 : 120
    drawViz(width, overallHeight/dNum, svg)

    circles = $$('.hepta-result')
    labels = $$('.hepta-result-label')
    titles = $$('.hepta-discipline-title')

    easeInOut = cubicEasing(150)

    // drawIllus(overallHeight/dNum, `${config.assetPath}/assets/imgs`, vizDiv)

    $$('.hepta-voronoi').forEach(function(e) {

        let _id = e.getAttribute('data-id')

        e.addEventListener('mouseenter', function(e) {
            highlight(_id)
        })
    })

}