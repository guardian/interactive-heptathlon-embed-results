import {jsdom} from 'jsdom'
import * as d3 from 'd3'
import fs from 'fs'
import fp from 'lodash/fp'
import _ from 'lodash'
import {roundPathCorners} from './roundPathCorners'
import result from './result.json'

let forceArray = x => _.isArray(x) ? x : [x]

let parseEntrant = e => {

	let medalProp = forceArray(e.property).find(p => p.type === 'Medal Awarded')

	let medal = medalProp ? medalProp.value.toLowerCase() : null

	return {
		name : e.participant.competitor.fullName,
		identifier : e.participant.competitor.identifier,
		medal : medal
	}
}

let doc = jsdom(`<svg></svg>`, {})
let svgEl = doc.defaultView.document.querySelector('svg')
let svg = d3.select(svgEl)

let lineGroup = svg.append('g')
	.attr('class', 'hepta-lines')

let entrant = result.olympics.event.result.entrant

let allResultsByDiscipline = _(entrant)
	.map(e => {
		return e.phaseResult.map(pr => {
			return { e, pr }
		})
	})
	.flatten()
	.groupBy(o => o.pr.identifier)

	.map(o => {
		return _(o)
			.map(o => {
				return {
					e : parseEntrant(o.e),
					pr : o.pr
				}
			})
			.orderBy([
				o => ['bronze', 'silver', 'gold'].indexOf(o.e.medal),
				o => o.pr.value
			], ['asc', 'desc'])
			.valueOf()
	})
	.valueOf()

let athletes = entrant.map(e => e.participant.competitor.identifier)

let athletesDict = _(entrant.map(e => {
		return [e.participant.competitor.identifier, e.participant.competitor.fullName]
	}))
	.fromPairs()
	.valueOf()

fs.writeFileSync('athletes.json', JSON.stringify(athletesDict, null, 2))

let athletesList = entrant.map(e => {

	let medalProp = forceArray(e.property).find(p => p.type === 'Medal Awarded')
	let medal = medalProp ? medalProp.value.toLowerCase() : null

	return {
		'_id' : e.participant.competitor.identifier,
		'name' : e.participant.competitor.fullName,
		'country' : e.country.identifier,
		'rank' : e.rank,
		'score' : parseInt(e.value),
		'medal' : medal
	} 
})

console.log(athletesList)

fs.writeFileSync('athletesList.json', JSON.stringify(athletesList, null, 2))

let height = 100
let width = 1024

let margin = 16

let disciplines = [
	{
		'name' : '100m hurdles',
		'resMapper' : d => d,
		'format' : (r, arr) => {
			return 'heya'
		},
		'reverseScale' : true
	},{
		'name' : 'High jump',
		'resMapper' : d => d,
		'format' : d => d
	},{
		'name' : 'Shot put',
		'resMapper' : d => d,
		'format' : d => d
	},{
		'name' : '200m run',
		'resMapper' : d => d,
		'format' : d => d,
		'reverseScale' : true
	},{
		'name' : 'Long jump',
		'resMapper' : d => d,
		'format' : d => d
	},{
		'name' : 'Javelin throw',
		'resMapper' : d => d,
		'format' : d => d
	},{
		'name' : '800m run',
		'resMapper' : (r) => {
			if(r) {
				let [mins, secs] = r.split(':')
				return parseInt(mins)*60 + parseFloat(secs)
			}
			return undefined
		},
		'format' : d => d,
		'reverseScale' : true
	}
]

let drawDiscipline = (discipline, namesAndResults, i, svg) => {

	let results = namesAndResults

	svg.append('line')
		.attr('x1', margin)
		.attr('x2', width-margin)
		.attr('y1', height*i + height/2)
		.attr('y2', height*i + height/2)
		.attr('class', 'hepta-axis')

	let nodeGroup = svg.append('g')
		.attr('class', 'hepta-discipline')

	svg.append('text')
		.text(discipline.name)
		.attr('y', height*i + height/2 - 16)
		.attr('x', 16)
		.attr('class', 'hepta-discipline-title')

	let extent = d3.extent(results.map(r => discipline.resMapper(r.pr.value)))
	let range = discipline.reverseScale ? [width-margin, margin] : [margin, width-margin] 

	let yScale = d3.scaleLinear()
		.domain(extent)
		.range(range)

	let groups = nodeGroup.selectAll('.hepta-result-group')
		.data(results)
		.enter()
		.append('g')
		.attr('class', 'hepta-result-group')
		.attr('data-id', d => d.e.identifier)
		.attr('data-finished', d => d.pr.value)

	groups
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
		.attr('cy', i*height + height/2)
		.attr('r', 4)

	groups
		.append('text')
		.attr('class', 'hepta-result-label hepta-hidden')
		.text(d => d.pr.value)
		.attr('x', d => {
			let x = d.pr.value ? yScale(discipline.resMapper(d.pr.value)) : 0
			return x
		})
		.attr('y', i*height + height/2 + 32)

}

disciplines.forEach((d,i) => {

	let namesAndResults = allResultsByDiscipline[i]

	drawDiscipline(d, namesAndResults, i, svg)

})

let outJson = disciplines.map( (d, i) => {
	return {
		'name' : d.name,
		'resMapper' : d.resMapper,
		'format' : d.format,
		'reverseScale' : d.reverseScale,
		'data' : allResultsByDiscipline[i]
	}
})

fs.writeFileSync('results_parsed.json', JSON.stringify(allResultsByDiscipline, null, 2))

let lineGen = d3.line()
	.x(d => d.x)
	.y(d => d.y)
	.defined(d => d.finished)

let nodes = athletes.map(identifier => {
	let nodes = _(svg.selectAll(`.hepta-result-group[data-id="${identifier}"]`).nodes())
		.map(n => {
			return {
				_id : n.getAttribute('data-id'),
				finished : n.getAttribute('data-finished'),
				x : n.querySelector('circle').getAttribute('cx'),
				y : n.querySelector('circle').getAttribute('cy')
			}
		})
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
		.valueOf()

	return nodes
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


let voronoi = d3.voronoi()
	.extent([[0, 0], [width, height*7]])
	.x(d => d.x)
	.y(d => d.y)

let voronoiNodes = _(svg.selectAll('.hepta-result-group').nodes())
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
	.reverse()
	.map(x => {
		return x
	})
	.uniqWith((a,b) => {
		return a.x === b.x && a.y === b.y
	})
	.valueOf()

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


let interpolSvg = svgEl.outerHTML

fs.writeFileSync('heptathlon.svg', svgEl.outerHTML)
